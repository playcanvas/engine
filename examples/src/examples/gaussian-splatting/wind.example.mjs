// @config
//
// Realistic wind swaying of the trees in a gaussian splat scene, driven by the reusable
// GsplatTrees script. Each tree is marked by a sphere over its green canopy - the bottom of the
// sphere is where the trunk connects, so the trunk stays put and the sway grows up and out
// towards the branch tips. The script bakes each splat's binding to a tree into an extra work
// buffer stream during the copy stage (cheap, not per-frame, and re-run automatically for
// streamed LOD data), then a small per-frame vertex modifier applies the sway. Toggle Edit mode
// to position the tree spheres with gizmos, and add or remove trees.
//
// @credit
// title: Knock Community Hall
// author: scbenoit
// source: https://superspl.at/scene/0ff2e6dc
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    GSplatComponentSystem,
    GSplatHandler,
    Gizmo,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScaleGizmo,
    ScriptComponentSystem,
    ScriptHandler,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    TranslateGizmo,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { GsplatTrees } from 'playcanvas/scripts/esm/gsplat/gsplat-trees.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    GSplatComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, GSplatHandler];

const app = new AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assets = {
    hall: new Asset('gsplat', 'gsplat', { url: './assets/splats/knock-community-hall.sog' }),
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    envAtlas: new Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// soft environment for the background and any reflections
app.scene.envAtlas = assets.envAtlas.resource;
app.scene.skyboxMip = 2;
app.scene.skyboxIntensity = 0.8;
app.scene.exposure = 1.2;

// default UI values
data.set('strength', 0.25);
data.set('speed', 1.0);
data.set('direction', 45);
data.set('gustiness', 0.4);
data.set('flutter', 0.3);
data.set('edit', false);

// the splat scene
const hall = new Entity('hall');
hall.addComponent('gsplat', {
    asset: assets.hall
});
hall.setLocalEulerAngles(180, 0, 0);
app.root.addChild(hall);

// The GsplatTrees script drives the wind.
hall.addComponent('script');
const treesScript = /** @type {GsplatTrees} */ (hall.script.create(GsplatTrees));

// Each tree is a helper entity whose world position is the sphere center and whose uniform scale
// is the sphere radius; the gizmos move/scale these. The two default trees of this scene were
// located by clustering the green foliage splats (their canopies sit around world Y ~ 5.4, with
// the sphere bottom at the trunk/canopy junction).
/** @type {Entity[]} */
const treeItems = [];

const createTreeItem = (center, radius) => {
    const entity = new Entity(`Tree ${treeItems.length + 1}`);
    entity.setLocalPosition(center);
    entity.setLocalScale(radius, radius, radius);
    app.root.addChild(entity);
    treeItems.push(entity);
    return entity;
};

createTreeItem(new Vec3(-4.3, 5.4, 5.65), 3.6);
createTreeItem(new Vec3(-4.6, 5.4, -2.64), 3.8);

// push the current tree helper entities to the script as spheres (triggers a re-bake)
const pushSpheres = () => {
    treesScript.setSpheres(treeItems.map(e => ({
        center: e.getPosition(),
        radius: e.getLocalScale().x
    })));
};
pushSpheres();

// drive the wind from the UI
const applyControls = () => {
    treesScript.strength = data.get('strength');
    treesScript.speed = data.get('speed');
    treesScript.direction = data.get('direction');
    treesScript.gustiness = data.get('gustiness');
    treesScript.flutter = data.get('flutter');
};
applyControls();
data.on('*:set', applyControls);

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    fov: 60,
    toneMapping: TONEMAP_ACES
});
camera.setLocalPosition(6, 4, 10);

camera.addComponent('script');
camera.script?.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: hall,
        distanceMin: 3,
        distanceMax: 40,
        frameOnStart: true
    }
});
const orbitInputMouse = camera.script?.create('orbitCameraInputMouse');
camera.script?.create('orbitCameraInputTouch');
app.root.addChild(camera);

const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.samples = 4;
cameraFrame.rendering.toneMapping = TONEMAP_ACES;
cameraFrame.bloom.intensity = 0.02;
cameraFrame.update();

// ---------- Edit mode: gizmos + tree list ----------
const gizmoLayer = Gizmo.createLayer(app);
const translateGizmo = new TranslateGizmo(camera.camera, gizmoLayer);
const scaleGizmo = new ScaleGizmo(camera.camera, gizmoLayer);
scaleGizmo.uniform = true;

let editMode = false;
let gizmoMode = 'move';
let selectedIndex = 0;
let spheresDirty = false;

const activeGizmo = () => (gizmoMode === 'move' ? translateGizmo : scaleGizmo);

const attachGizmo = () => {
    translateGizmo.detach();
    scaleGizmo.detach();
    if (editMode && selectedIndex >= 0 && selectedIndex < treeItems.length) {
        activeGizmo().attach(treeItems[selectedIndex]);
    }
};

// disable the orbit camera while dragging a gizmo, and re-bake on release
const onGizmoDown = (_x, _y, meshInstance) => {
    if (meshInstance && orbitInputMouse) {
        orbitInputMouse.enabled = false;
    }
};
const onGizmoUp = () => {
    if (orbitInputMouse) {
        orbitInputMouse.enabled = true;
    }
    pushSpheres();
    spheresDirty = false;
};
translateGizmo.on('pointer:down', onGizmoDown);
translateGizmo.on('pointer:up', onGizmoUp);
scaleGizmo.on('pointer:down', onGizmoDown);
scaleGizmo.on('pointer:up', onGizmoUp);

// ---------- Tree list UI (shown only in edit mode) ----------
const style = document.createElement('style');
style.textContent = `
    .trees-panel {
        position: absolute; top: 50%; left: 10px; transform: translateY(-50%);
        background: rgba(30, 30, 30, 0.9); border: 1px solid #444; border-radius: 5px;
        padding: 10px; color: white; font-family: Arial, sans-serif; font-size: 12px;
        min-width: 170px; z-index: 1000; display: none;
    }
    .trees-title { font-weight: bold; margin-bottom: 8px; padding-bottom: 5px; border-bottom: 1px solid #555; }
    .trees-row { display: flex; gap: 6px; margin-bottom: 8px; }
    .trees-btn { flex: 1; background: #333; border: 1px solid #555; color: white; padding: 4px; border-radius: 3px; cursor: pointer; }
    .trees-btn.active { background: #446; }
    .trees-item { display: flex; align-items: center; justify-content: space-between; padding: 5px 8px; margin: 2px 0; background: #333; border-radius: 3px; cursor: pointer; }
    .trees-item.active { background: #446; }
    .trees-item span { flex-grow: 1; }
    .trees-del { background: #833; border: none; color: white; padding: 2px 6px; border-radius: 3px; cursor: pointer; margin-left: 8px; }
`;
document.head.appendChild(style);

const panel = document.createElement('div');
panel.className = 'trees-panel';
app.on('destroy', () => {
    panel.remove();
    style.remove();
});

const title = document.createElement('div');
title.className = 'trees-title';
title.textContent = 'Trees';
panel.appendChild(title);

// gizmo mode buttons
const modeRow = document.createElement('div');
modeRow.className = 'trees-row';
const moveBtn = document.createElement('button');
moveBtn.className = 'trees-btn';
moveBtn.textContent = 'Move';
const sizeBtn = document.createElement('button');
sizeBtn.className = 'trees-btn';
sizeBtn.textContent = 'Size';
modeRow.appendChild(moveBtn);
modeRow.appendChild(sizeBtn);
panel.appendChild(modeRow);

// add button
const addRow = document.createElement('div');
addRow.className = 'trees-row';
const addBtn = document.createElement('button');
addBtn.className = 'trees-btn';
addBtn.textContent = '+ Add tree';
addRow.appendChild(addBtn);
panel.appendChild(addRow);

const listContainer = document.createElement('div');
panel.appendChild(listContainer);
document.body.appendChild(panel);

const updateList = () => {
    moveBtn.className = gizmoMode === 'move' ? 'trees-btn active' : 'trees-btn';
    sizeBtn.className = gizmoMode === 'size' ? 'trees-btn active' : 'trees-btn';

    listContainer.innerHTML = '';
    treeItems.forEach((entity, i) => {
        const item = document.createElement('div');
        item.className = i === selectedIndex ? 'trees-item active' : 'trees-item';

        const name = document.createElement('span');
        name.textContent = entity.name;
        name.onclick = () => {
            selectedIndex = i;
            attachGizmo();
            updateList();
        };
        item.appendChild(name);

        const del = document.createElement('button');
        del.className = 'trees-del';
        del.textContent = 'X';
        del.onclick = (e) => {
            e.stopPropagation();
            treeItems[i].destroy();
            treeItems.splice(i, 1);
            selectedIndex = Math.min(selectedIndex, treeItems.length - 1);
            pushSpheres();
            attachGizmo();
            updateList();
        };
        item.appendChild(del);

        listContainer.appendChild(item);
    });
};

moveBtn.onclick = () => {
    gizmoMode = 'move';
    attachGizmo();
    updateList();
};
sizeBtn.onclick = () => {
    gizmoMode = 'size';
    attachGizmo();
    updateList();
};
addBtn.onclick = () => {
    // add a new tree in front of the camera focus, at a default canopy height
    const entity = createTreeItem(new Vec3(0, 5, 0), 3.5);
    selectedIndex = treeItems.indexOf(entity);
    pushSpheres();
    attachGizmo();
    updateList();
};

const setEditMode = (value) => {
    editMode = value;
    panel.style.display = value ? 'block' : 'none';
    attachGizmo();
    if (value) {
        updateList();
    }
};
data.on('edit:set', () => setEditMode(data.get('edit')));

// re-bake at a modest rate while a sphere is being dragged (full re-bake also happens on release)
let sinceBake = 0;
app.on('update', (dt) => {
    if (!editMode) {
        return;
    }

    // visualize each tree sphere; sync the dragged entity back into the (throttled) re-bake
    treeItems.forEach((entity, i) => {
        const center = entity.getPosition();
        const radius = entity.getLocalScale().x;
        const selected = i === selectedIndex;
        app.drawWireSphere(center, radius, selected ? Color.YELLOW : Color.GRAY, 24);
    });

    if (!orbitInputMouse?.enabled) {
        // a gizmo is being dragged
        spheresDirty = true;
    }
    sinceBake += dt;
    if (spheresDirty && sinceBake > 0.12) {
        pushSpheres();
        sinceBake = 0;
        spheresDirty = false;
    }
});

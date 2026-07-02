// @config
//
// GSplat editor with AABB selection, deletion, and cloning using GSplatProcessor.
//
// `Select button` Show selection box · `Gizmo` Move selection box · `LMB` Orbit
//
// @credit
// title: SA3D_R&D_XP47
// author: Stephane Agullo
// source: https://superspl.at/view?id=cdcec084
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

import * as pc from 'playcanvas';

import { data, deviceType } from 'examples/context';

import { copyProcessor } from './copy-processor.mjs';
import { deleteProcessor } from './delete-processor.mjs';
import { selectionProcessor } from './selection-processor.mjs';
import { workBufferModifier } from './workbuffer-modifier.mjs';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.GSplatHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// initialize control data
data.set('boxSize', 0.67);

const assets = {
    orbit: new pc.Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    biker: new pc.Asset('biker', 'gsplat', { url: './assets/splats/biker.compressed.ply' }),
    apartment: new pc.Asset('apartment', 'gsplat', { url: './assets/splats/apartment.sog' })
};

await new Promise((resolve) => {
    new pc.AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

data.on('renderer:set', () => {
    app.scene.gsplat.renderer = data.get('renderer');
    const current = app.scene.gsplat.currentRenderer;
    if (current !== data.get('renderer')) {
        setTimeout(() => data.set('renderer', current), 0);
    }
});
data.set('renderer', pc.GSPLAT_RENDERER_AUTO);

// store all editable gsplat entities
const editables = [];
let cloneCounter = 0;
let activeGizmoEntity = null;

// gizmo will be created after camera
let gizmoLayer = null;
let gizmo = null;

// selection box state
let selectionBox = null;
let selectionBoxVisible = false;
const selectionBoxEntity = new pc.Entity('SelectionBox');
app.root.addChild(selectionBoxEntity);

// inject css styles for ui
const style = document.createElement('style');
style.textContent = `
        .gsplat-panel {
            position: absolute; top: 50%; left: 10px; transform: translateY(-50%);
            background: rgba(30, 30, 30, 0.9); border: 1px solid #444; border-radius: 5px;
            padding: 10px; color: white; font-family: Arial, sans-serif; font-size: 12px;
            min-width: 180px; z-index: 1000;
        }
        .gsplat-title { font-weight: bold; margin-bottom: 8px; padding-bottom: 5px; border-bottom: 1px solid #555; }
        .gsplat-list { max-height: 300px; overflow-y: auto; }
        .gsplat-item {
            display: flex; align-items: center; justify-content: space-between;
            padding: 5px 8px; margin: 2px 0; background: #333; border-radius: 3px; cursor: pointer;
        }
        .gsplat-item.active { background: #446; }
        .gsplat-item span { flex-grow: 1; }
        .gsplat-delete {
            background: #833; border: none; color: white;
            padding: 2px 6px; border-radius: 3px; cursor: pointer; margin-left: 8px;
        }
    `;
document.head.appendChild(style);

// html ui for entity list
const uiPanel = document.createElement('div');
uiPanel.className = 'gsplat-panel';

const uiTitle = document.createElement('div');
uiTitle.textContent = 'GSplat Entities';
uiTitle.className = 'gsplat-title';
uiPanel.appendChild(uiTitle);

const listContainer = document.createElement('div');
listContainer.className = 'gsplat-list';
uiPanel.appendChild(listContainer);

document.body.appendChild(uiPanel);

// show/hide gizmo for an entity
const showGizmoFor = (entity) => {
    if (activeGizmoEntity) {
        gizmo.detach();
    }
    activeGizmoEntity = entity;
    if (entity) {
        gizmo.attach(entity);
    }
    updateEntityList();
};

// remove entity from scene
const removeEntity = (editable) => {
    showGizmoFor(null);

    // cleanup processors
    editable.selectionProcessor?.destroy();
    editable.deleteProcessor?.destroy();

    // remove from editables
    const idx = editables.indexOf(editable);
    if (idx !== -1) {
        editables.splice(idx, 1);
    }

    // destroy entity
    editable.entity.destroy();

    updateEntityList();
};

function updateEntityList() {
    listContainer.innerHTML = '';

    for (const editable of editables) {
        const item = document.createElement('div');
        item.className = activeGizmoEntity === editable.entity ? 'gsplat-item active' : 'gsplat-item';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = editable.entity.name;
        nameSpan.onclick = () => showGizmoFor(editable.entity);
        item.appendChild(nameSpan);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'X';
        deleteBtn.className = 'gsplat-delete';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            removeEntity(editable);
        };
        item.appendChild(deleteBtn);

        listContainer.appendChild(item);
    }
}

// sets up textures, creates processors, and sets work buffer modifier
// assumes extra streams already exist on the format
// returns { selectionprocessor, deleteprocessor }
const setupEditableProcessors = (gsplatComponent) => {
    // initialize splatvisible: all visible (255)
    const visibleTexture = gsplatComponent.getInstanceTexture('splatVisible');
    const visibleData = new Uint8Array(visibleTexture.width * visibleTexture.height);
    visibleData.fill(255);
    visibleTexture.lock().set(visibleData);
    visibleTexture.unlock();

    // initialize splatselection: none selected (0)
    const selectionTexture = gsplatComponent.getInstanceTexture('splatSelection');
    const selectionData = new Uint8Array(selectionTexture.width * selectionTexture.height);
    selectionData.fill(0);
    selectionTexture.lock().set(selectionData);
    selectionTexture.unlock();

    // create processors
    const selectionProc = new pc.GSplatProcessor(
        device,
        { component: gsplatComponent },
        { component: gsplatComponent, streams: ['splatSelection'] },
        selectionProcessor
    );

    const deleteProc = new pc.GSplatProcessor(
        device,
        { component: gsplatComponent },
        { component: gsplatComponent, streams: ['splatVisible'] },
        deleteProcessor
    );

    // set work buffer modifier
    gsplatComponent.setWorkBufferModifier(workBufferModifier);

    return { selectionProcessor: selectionProc, deleteProcessor: deleteProc };
};

// creates an editable gsplat entity with splatvisible and splatselection streams
const createEditableSplat = (name, asset, position, rotation, scale) => {
    const entity = new pc.Entity(name);
    const gsplatComponent = entity.addComponent('gsplat', { asset });
    entity.setLocalPosition(...position);
    entity.setLocalEulerAngles(...rotation);
    entity.setLocalScale(...scale);
    app.root.addChild(entity);

    const resource = /** @type {pc.GSplatResource} */ (asset.resource);

    // add splatvisible and splatselection streams if not present
    if (!resource.format.getStream('splatVisible')) {
        resource.format.addExtraStreams([
            { name: 'splatVisible', format: pc.PIXELFORMAT_R8, storage: pc.GSPLAT_STREAM_INSTANCE },
            { name: 'splatSelection', format: pc.PIXELFORMAT_R8, storage: pc.GSPLAT_STREAM_INSTANCE }
        ]);
    }

    // setup textures and processors
    const { selectionProcessor, deleteProcessor } = setupEditableProcessors(gsplatComponent);

    const editable = {
        entity,
        resource,
        component: gsplatComponent,
        selectionProcessor,
        deleteProcessor
    };

    editables.push(editable);
    updateEntityList();
    return editable;
};

// creates a cloned gsplat from selected splats using gpu-based data copy
// aabbcenter is used to make splat positions local (relative to aabbcenter)
const createClonedSplat = (selectedData, aabbCenter) => {
    const { totalCount, centers, aabb, mappings } = selectedData;

    if (totalCount === 0) return null;

    // use built-in default format for full visual preservation
    const format = pc.GSplatFormat.createDefaultFormat(device);

    // add visibility and selection streams (with instance storage)
    format.addExtraStreams([
        { name: 'splatVisible', format: pc.PIXELFORMAT_R8, storage: pc.GSPLAT_STREAM_INSTANCE },
        { name: 'splatSelection', format: pc.PIXELFORMAT_R8, storage: pc.GSPLAT_STREAM_INSTANCE }
    ]);

    const container = new pc.GSplatContainer(device, totalCount, format);
    const dstTextureSize = container.textureDimensions.x;

    // run gsplatprocessor per source editable to copy data
    for (const mapping of mappings) {
        // extract source entity's transform
        const worldTransform = mapping.editable.entity.getWorldTransform();
        const modelScale = new pc.Vec3();
        const modelRotation = new pc.Quat();
        worldTransform.getScale(modelScale);
        modelRotation.setFromMat4(worldTransform);
        if (modelRotation.w < 0) {
            modelRotation.mulScalar(-1);
        }

        // create remapping texture for this source
        const remapTexture = new pc.Texture(device, {
            name: 'RemapTexture',
            width: dstTextureSize,
            height: dstTextureSize,
            format: pc.PIXELFORMAT_R32U,
            mipmaps: false,
            minFilter: pc.FILTER_NEAREST,
            magFilter: pc.FILTER_NEAREST,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE
        });

        // fill remapping texture on cpu
        const remapData = remapTexture.lock();
        remapData.fill(0xffffffff); // mark all as "skip"
        for (let i = 0; i < mapping.srcIndices.length; i++) {
            remapData[mapping.destStartOffset + i] = mapping.srcIndices[i];
        }
        remapTexture.unlock();

        // create processor to copy data from source to destination
        const copyProc = new pc.GSplatProcessor(
            device,
            { component: mapping.editable.component }, // source
            { resource: container, streams: ['dataColor', 'dataCenter', 'dataScale', 'dataRotation'] },
            copyProcessor
        );

        copyProc.setParameter('uRemapTexture', remapTexture);
        copyProc.setParameter('matrix_model', worldTransform.data);
        copyProc.setParameter('model_scale', [modelScale.x, modelScale.y, modelScale.z]);
        copyProc.setParameter('model_rotation', [modelRotation.x, modelRotation.y, modelRotation.z, modelRotation.w]);
        copyProc.setParameter('aabb_center', [aabbCenter.x, aabbCenter.y, aabbCenter.z]);
        copyProc.process();

        // cleanup
        copyProc.destroy();
        remapTexture.destroy();
    }

    // set centers and aabb (make local by subtracting aabbcenter)
    const localCenters = new Float32Array(totalCount * 3);
    for (let i = 0; i < totalCount; i++) {
        localCenters[i * 3 + 0] = centers[i * 3 + 0] - aabbCenter.x;
        localCenters[i * 3 + 1] = centers[i * 3 + 1] - aabbCenter.y;
        localCenters[i * 3 + 2] = centers[i * 3 + 2] - aabbCenter.z;
    }
    container.centers.set(localCenters);

    // make aabb local too
    const localAabb = new pc.BoundingBox();
    localAabb.center.sub2(aabb.center, aabbCenter);
    localAabb.halfExtents.copy(aabb.halfExtents);
    container.aabb.copy(localAabb);

    // create entity at aabbcenter position (with small offset to make clone visible)
    cloneCounter++;
    const name = `clone${cloneCounter}`;
    const entity = new pc.Entity(name);
    const gsplatComponent = entity.addComponent('gsplat', {
        resource: container
    });
    entity.setLocalPosition(aabbCenter.x + 0.1, aabbCenter.y, aabbCenter.z + 0.1);
    app.root.addChild(entity);

    // setup textures and processors
    const { selectionProcessor, deleteProcessor } = setupEditableProcessors(gsplatComponent);

    const editable = {
        entity,
        resource: container,
        component: gsplatComponent,
        selectionProcessor,
        deleteProcessor
    };

    editables.push(editable);
    updateEntityList();

    return editable;
};

// collect selected splat data from all editables (using gpu-computed selection)
const collectSelectedData = async () => {
    if (!selectionBox || !selectionBoxVisible) {
        return { totalCount: 0, centers: null, aabb: null, mappings: [] };
    }

    // run selection processor on all editables to ensure splatselection textures are up to date
    const boxMin = selectionBox.getMin();
    const boxMax = selectionBox.getMax();
    for (const editable of editables) {
        if (!editable.selectionProcessor) continue;
        editable.selectionProcessor.setParameter('uBoxMin', [boxMin.x, boxMin.y, boxMin.z]);
        editable.selectionProcessor.setParameter('uBoxMax', [boxMax.x, boxMax.y, boxMax.z]);
        editable.selectionProcessor.setParameter('matrix_model', editable.entity.getWorldTransform().data);
        editable.selectionProcessor.process();
    }

    let totalCount = 0;
    const mappings = [];

    // read all visibility and selection textures in parallel
    const textureDataArray = await Promise.all(
        editables.map(async (editable) => {
            const visibleTexture = editable.component.getInstanceTexture('splatVisible');
            const selectionTexture = editable.component.getInstanceTexture('splatSelection');
            const [visibleData, selectionData] = await Promise.all([
                visibleTexture.read(0, 0, visibleTexture.width, visibleTexture.height, { immediate: true }),
                selectionTexture.read(0, 0, selectionTexture.width, selectionTexture.height, { immediate: true })
            ]);
            return { visibleData, selectionData };
        })
    );

    // process each editable using gpu-computed selection data
    for (let e = 0; e < editables.length; e++) {
        const editable = editables[e];
        const { visibleData, selectionData } = textureDataArray[e];

        const srcIndices = [];
        for (let i = 0; i < editable.resource.numSplats; i++) {
            // include splats that are both visible and selected (by gpu)
            if (visibleData[i] > 127 && selectionData[i] > 127) {
                srcIndices.push(i);
            }
        }

        if (srcIndices.length > 0) {
            mappings.push({ editable, destStartOffset: totalCount, srcIndices });
            totalCount += srcIndices.length;
        }
    }

    if (totalCount === 0) {
        return { totalCount: 0, centers: null, aabb: null, mappings: [] };
    }

    // collect centers (still needed for aabb/sorting)
    const centers = new Float32Array(totalCount * 3);
    const aabb = new pc.BoundingBox();
    const tempBox = new pc.BoundingBox();
    const point = new pc.Vec3();
    let offset = 0;

    for (const mapping of mappings) {
        const srcCenters = mapping.editable.resource.centers;
        const transform = mapping.editable.entity.getWorldTransform();

        for (const idx of mapping.srcIndices) {
            // get center and transform to world space
            point.set(srcCenters[idx * 3], srcCenters[idx * 3 + 1], srcCenters[idx * 3 + 2]);
            transform.transformPoint(point, point);

            centers[offset * 3 + 0] = point.x;
            centers[offset * 3 + 1] = point.y;
            centers[offset * 3 + 2] = point.z;

            if (offset === 0) {
                aabb.center.copy(point);
                aabb.halfExtents.set(0.01, 0.01, 0.01);
            } else {
                // boundingbox.add expects a boundingbox, not a vec3
                tempBox.center.copy(point);
                tempBox.halfExtents.set(0.01, 0.01, 0.01);
                aabb.add(tempBox);
            }
            offset++;
        }
    }

    return { totalCount, centers, aabb, mappings };
};

// create initial splats
createEditableSplat('biker1', assets.biker, [-1.9, -0.55, 0.6], [180, -90, 0], [0.3, 0.3, 0.3]);
createEditableSplat('biker2', assets.biker, [-3, -0.5, -0.5], [180, 180, 0], [0.3, 0.3, 0.3]);
createEditableSplat('apartment', assets.apartment, [0, -0.5, -3], [180, 0, 0], [0.5, 0.5, 0.5]);

// camera setup
const cameraPos = new pc.Vec3(-0.98, 0.28, -2.31);
const focusPos = new pc.Vec3(-1.1, 0.13, -1.56);

const camera = new pc.Entity('Camera');
camera.addComponent('camera', {
    fov: 90,
    clearColor: new pc.Color(0, 0, 0),
    toneMapping: pc.TONEMAP_LINEAR
});
camera.setLocalPosition(cameraPos);
camera.lookAt(focusPos);
app.root.addChild(camera);

// create gizmo now that camera exists
gizmoLayer = pc.Gizmo.createLayer(app);
gizmo = new pc.TranslateGizmo(camera.camera, gizmoLayer);

camera.addComponent('script');
const orbitCamera = camera.script.create('orbitCamera', {
    attributes: {
        frameOnStart: false,
        inertiaFactor: 0.07
    }
});
const orbitInput = camera.script.create('orbitCameraInputMouse');
orbitCamera.resetAndLookAtPoint(cameraPos, focusPos);

// gizmo interaction - disable camera when using gizmo
gizmo.on('pointer:down', (_x, _y, meshInstance) => {
    if (meshInstance) {
        orbitInput.enabled = false;
    }
});
gizmo.on('pointer:up', () => {
    orbitInput.enabled = true;
});

app.mouse.disableContextMenu();

// update loop - draw selection box, sync position, and update selection highlights
app.on('update', () => {
    // sync selection box center with entity position (gizmo moves the entity)
    if (selectionBox && selectionBoxVisible) {
        selectionBox.center.copy(selectionBoxEntity.getPosition());
        app.drawWireAlignedBox(selectionBox.getMin(), selectionBox.getMax(), pc.Color.YELLOW);

        // update selection highlighting for all editables
        const boxMin = selectionBox.getMin();
        const boxMax = selectionBox.getMax();

        for (const editable of editables) {
            if (!editable.selectionProcessor) continue;
            editable.selectionProcessor.setParameter('uBoxMin', [boxMin.x, boxMin.y, boxMin.z]);
            editable.selectionProcessor.setParameter('uBoxMax', [boxMax.x, boxMax.y, boxMax.z]);
            editable.selectionProcessor.setParameter('matrix_model', editable.entity.getWorldTransform().data);
            editable.selectionProcessor.process();
            editable.component.workBufferUpdate = pc.WORKBUFFER_UPDATE_ONCE;
        }
    }
});

// select button handler - show/create selection box
const defaultBoxCenter = new pc.Vec3(-1.695, -0.302, -0.721);
data.on('select', () => {
    const boxSize = data.get('boxSize');
    const halfSize = boxSize / 2;

    if (!selectionBox) {
        selectionBox = new pc.BoundingBox(defaultBoxCenter.clone(), new pc.Vec3(halfSize, halfSize, halfSize));
    } else {
        selectionBox.halfExtents.set(halfSize, halfSize, halfSize);
    }

    selectionBoxVisible = true;
    selectionBoxEntity.setPosition(selectionBox.center);
    showGizmoFor(selectionBoxEntity);
});

// box size change handler
data.on('boxSize:set', (value) => {
    if (selectionBox) {
        const halfSize = value / 2;
        selectionBox.halfExtents.set(halfSize, halfSize, halfSize);
    }
});

// clear selection - hide box and remove yellow highlighting
const clearSelection = () => {
    selectionBoxVisible = false;
    if (activeGizmoEntity === selectionBoxEntity) {
        showGizmoFor(null);
    }
    // clear selection highlighting on all editables
    for (const editable of editables) {
        const selectionTexture = editable.component.getInstanceTexture('splatSelection');
        if (selectionTexture) {
            const selectionData = new Uint8Array(selectionTexture.width * selectionTexture.height);
            selectionData.fill(0);
            selectionTexture.lock().set(selectionData);
            selectionTexture.unlock();
            editable.component.workBufferUpdate = pc.WORKBUFFER_UPDATE_ONCE;
        }
    }
};

// delete selected button handler
data.on('deleteSelected', () => {
    if (!selectionBox || !selectionBoxVisible) return;

    const boxMin = selectionBox.getMin();
    const boxMax = selectionBox.getMax();

    for (const editable of editables) {
        if (!editable.deleteProcessor) continue;
        editable.deleteProcessor.setParameter('uBoxMin', [boxMin.x, boxMin.y, boxMin.z]);
        editable.deleteProcessor.setParameter('uBoxMax', [boxMax.x, boxMax.y, boxMax.z]);
        editable.deleteProcessor.setParameter('matrix_model', editable.entity.getWorldTransform().data);
        editable.deleteProcessor.process();
        editable.component.workBufferUpdate = pc.WORKBUFFER_UPDATE_ONCE;
    }

    clearSelection();
});

// clone selected button handler
data.on('cloneSelected', async () => {
    const selectedData = await collectSelectedData();
    if (selectedData.totalCount > 0) {
        // use selection box center as the clone's pivot point
        const aabbCenter = selectionBox.center.clone();
        const cloned = createClonedSplat(selectedData, aabbCenter);
        clearSelection();
        if (cloned) {
            showGizmoFor(cloned.entity);
        }
    }
});

// cleanup on destroy
app.on('destroy', () => {
    for (const editable of editables) {
        editable.selectionProcessor?.destroy();
        editable.deleteProcessor?.destroy();
    }
    gizmo.destroy();
    uiPanel.remove();
});

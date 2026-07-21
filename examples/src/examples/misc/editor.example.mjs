// @config
//
// `1` Translate · `2` Rotate · `3` Scale · `X` Toggle world/local · `P` Perspective · `O` Orthographic · Hold `Shift` Snap · Hold `Ctrl` Non-uniform scale

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    Layer,
    LightComponentSystem,
    OutlineRenderer,
    PROJECTION_ORTHOGRAPHIC,
    PROJECTION_PERSPECTIVE,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TextureHandler,
    Vec3,
    Vec4,
    ViewCube,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { Grid } from 'playcanvas/scripts/esm/grid.mjs';

import { data, deviceType } from 'examples/context';

import { GizmoHandler } from './gizmo-handler.mjs';
import { Selector } from './selector.mjs';

/**
 * @import { AssetRegistry, Material } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, FontHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Load assets
const assets = {
    font: new Asset('font', 'font', { url: './assets/fonts/courier.json' })
};
/**
 * @param {Asset[] | number[]} assetList - The asset list.
 * @param {AssetRegistry} assetRegistry - The asset registry.
 * @returns {Promise<void>} The promise.
 */
const loadAssets = (assetList, assetRegistry) => {
    return new Promise((resolve) => {
        const assetListLoader = new AssetListLoader(assetList, assetRegistry);
        assetListLoader.load(resolve);
    });
};
await loadAssets(Object.values(assets), app.assets);

app.start();

/**
 * @param {Color} color - The color.
 * @returns {Material} - The standard material.
 */
const createColorMaterial = (color) => {
    const material = new StandardMaterial();
    material.diffuse = color;
    material.update();
    return material;
};

// Scene settings
app.scene.ambientLight = new Color(0.2, 0.2, 0.2);

// Create entities
const box = new Entity('box');
box.addComponent('render', {
    type: 'box',
    material: createColorMaterial(new Color(0.8, 1, 1))
});
box.setPosition(1, 0, 1);
app.root.addChild(box);

const sphere = new Entity('sphere');
sphere.addComponent('render', {
    type: 'sphere',
    material: createColorMaterial(new Color(1, 0.8, 1))
});
sphere.setPosition(-1, 0, 1);
app.root.addChild(sphere);

const cone = new Entity('cone');
cone.addComponent('render', {
    type: 'cone',
    material: createColorMaterial(new Color(1, 1, 0.8))
});
cone.setPosition(-1, 0, -1);
cone.setLocalScale(1.5, 2.25, 1.5);
app.root.addChild(cone);

const capsule = new Entity('capsule');
capsule.addComponent('render', {
    type: 'capsule',
    material: createColorMaterial(new Color(0.8, 0.8, 1))
});
capsule.setPosition(1, 0, -1);
app.root.addChild(capsule);

// Camera
data.set('camera', {
    proj: PROJECTION_PERSPECTIVE + 1,
    dist: 1,
    fov: 45,
    orthoHeight: 10
});
const camera = new Entity('camera');
camera.addComponent('script');
camera.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.1),
    farClip: 1000
});
const cameraOffset = 4 * camera.camera.aspectRatio;
camera.setPosition(cameraOffset, cameraOffset, cameraOffset);
app.root.addChild(camera);

// Camera controls
const cc = /** @type {CameraControls} */ (camera.script.create(CameraControls));
Object.assign(cc, {
    focusPoint: Vec3.ZERO,
    sceneSize: 5,
    rotateDamping: 0,
    moveDamping: 0
});
app.on('gizmo:pointer', (/** @type {boolean} */ hasPointer) => {
    cc.enabled = !hasPointer;
});

// Outline renderer
const outlineLayer = new Layer({ name: 'OutlineLayer' });
app.scene.layers.push(outlineLayer);
const immediateLayer = /** @type {Layer} */ (app.scene.layers.getLayerByName('Immediate'));
const outlineRenderer = new OutlineRenderer(app, outlineLayer);
app.on('update', () => {
    outlineRenderer.frameUpdate(camera, immediateLayer, false);
});

// Grid
const gridEntity = new Entity('grid');
gridEntity.setLocalScale(8, 1, 8);
app.root.addChild(gridEntity);
gridEntity.addComponent('script');
const grid = /** @type {Grid} */ (gridEntity.script.create(Grid));
data.set('grid', {
    colorX: Object.values(grid.colorX),
    colorZ: Object.values(grid.colorZ),
    resolution: grid.resolution + 1
});

// Create light entity
const light = new Entity('light');
light.addComponent('light', {
    intensity: 1
});
app.root.addChild(light);
light.setEulerAngles(0, 0, -60);

// Gizmos
let skipObserverFire = false;
const gizmoHandler = new GizmoHandler(camera.camera);
const setGizmoControls = () => {
    skipObserverFire = true;
    data.set('gizmo', {
        type: gizmoHandler.type,
        size: gizmoHandler.gizmo.size,
        snapIncrement: gizmoHandler.gizmo.snapIncrement,
        colorAlpha: gizmoHandler.gizmo.colorAlpha,
        coordSpace: gizmoHandler.gizmo.coordSpace
    });
    skipObserverFire = false;
};
gizmoHandler.switch('translate');
setGizmoControls();

// View cube
const viewCube = new ViewCube(new Vec4(0, 1, 1, 0));
viewCube.dom.style.margin = '20px';
data.set('viewCube', {
    colorX: Object.values(viewCube.colorX),
    colorY: Object.values(viewCube.colorY),
    colorZ: Object.values(viewCube.colorZ),
    radius: viewCube.radius,
    textSize: viewCube.textSize,
    lineThickness: viewCube.lineThickness,
    lineLength: viewCube.lineLength
});
const tmpV1 = new Vec3();
let aligned = false;
viewCube.on(ViewCube.EVENT_CAMERAALIGN, (/** @type {Vec3} */ dir) => {
    const cameraPos = camera.getPosition();
    const focusPoint = cc.focusPoint;
    const cameraDist = focusPoint.distance(cameraPos);
    const cameraStart = tmpV1.copy(dir).mulScalar(cameraDist).add(focusPoint);
    cc.reset(focusPoint, cameraStart);
    aligned = true;
});
app.on('prerender', () => {
    viewCube.update(camera.getWorldTransform());
});

// Selector
const layers = app.scene.layers;
const selector = new Selector(app, camera.camera, [layers.getLayerByName('World')]);
selector.on('select', (/** @type {Entity} */ node, /** @type {boolean} */ clear) => {
    gizmoHandler.add(node, clear);
    if (clear) {
        outlineRenderer.removeAllEntities();
    }
    outlineRenderer.addEntity(node, Color.WHITE);
});
selector.on('deselect', () => {
    // Do not deselect when view cube has just aligned the camera
    if (aligned) {
        aligned = false;
        return;
    }
    gizmoHandler.clear();
    outlineRenderer.removeAllEntities();
});

// Ensure canvas is resized when window changes size + keep gizmo size consistent to canvas size
const resize = () => {
    app.resizeCanvas();
    const bounds = canvas.getBoundingClientRect();
    const dim = camera.camera.horizontalFov ? bounds.width : bounds.height;
    gizmoHandler.size = 1024 / dim;
    data.set('gizmo.size', gizmoHandler.size);
};
window.addEventListener('resize', resize);
resize();

// Key event handlers
const keydown = (/** @type {KeyboardEvent} */ e) => {
    gizmoHandler.gizmo.snap = !!e.shiftKey;
    gizmoHandler.gizmo.uniform = !e.ctrlKey;

    switch (e.key) {
        case 'f': {
            const point = gizmoHandler.gizmo.root.getPosition();
            const start = tmpV1.copy(camera.forward).mulScalar(-cameraOffset).add(point);
            cc.reset(point, start);
            break;
        }
        case 'r': {
            cc.focus(Vec3.ZERO, true);
            break;
        }
    }
};
const keyup = (/** @type {KeyboardEvent} */ e) => {
    gizmoHandler.gizmo.snap = !!e.shiftKey;
    gizmoHandler.gizmo.uniform = !e.ctrlKey;
};
const keypress = (/** @type {KeyboardEvent} */ e) => {
    switch (e.key) {
        case 'x':
            data.set('gizmo.coordSpace', data.get('gizmo.coordSpace') === 'world' ? 'local' : 'world');
            break;
        case '1':
            data.set('gizmo.type', 'translate');
            break;
        case '2':
            data.set('gizmo.type', 'rotate');
            break;
        case '3':
            data.set('gizmo.type', 'scale');
            break;
        case 'p':
            data.set('camera.proj', PROJECTION_PERSPECTIVE + 1);
            break;
        case 'o':
            data.set('camera.proj', PROJECTION_ORTHOGRAPHIC + 1);
            break;
    }
};
window.addEventListener('keydown', keydown);
window.addEventListener('keyup', keyup);
window.addEventListener('keypress', keypress);

// Gizmo and camera set handler
const tmpC1 = new Color();
data.on('*:set', (/** @type {string} */ path, /** @type {any} */ value) => {
    const [category, key] = path.split('.');
    switch (category) {
        case 'camera': {
            switch (key) {
                case 'proj':
                    camera.camera.projection = value - 1;
                    break;
                case 'fov':
                    camera.camera.fov = value;
                    break;
            }
            break;
        }
        case 'gizmo': {
            if (skipObserverFire) {
                return;
            }
            if (key === 'type') {
                gizmoHandler.switch(value);
                setGizmoControls();
                return;
            }
            gizmoHandler.gizmo[key] = value;
            break;
        }
        case 'grid': {
            switch (key) {
                case 'colorX':
                    grid.colorX = tmpC1.set(value[0], value[1], value[2]);
                    break;
                case 'colorZ':
                    grid.colorZ = tmpC1.set(value[0], value[1], value[2]);
                    break;
                case 'resolution':
                    grid.resolution = value - 1;
                    break;
            }
            break;
        }
        case 'viewCube': {
            switch (key) {
                case 'colorX':
                    viewCube.colorX = tmpC1.set(value[0], value[1], value[2]);
                    break;
                case 'colorY':
                    viewCube.colorY = tmpC1.set(value[0], value[1], value[2]);
                    break;
                case 'colorZ':
                    viewCube.colorZ = tmpC1.set(value[0], value[1], value[2]);
                    break;
                case 'radius':
                    viewCube.radius = value;
                    break;
                case 'textSize':
                    viewCube.textSize = value;
                    break;
                case 'lineThickness':
                    viewCube.lineThickness = value;
                    break;
                case 'lineLength':
                    viewCube.lineLength = value;
                    break;
            }
            break;
        }
    }
});

// Destroy handlers
app.on('destroy', () => {
    gizmoHandler.destroy();
    selector.destroy();
    viewCube.destroy();

    window.removeEventListener('resize', resize);
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('keyup', keyup);
    window.removeEventListener('keypress', keypress);
});

// Initial selection
selector.fire('select', box, true);

// Focus canvas
window.focus();

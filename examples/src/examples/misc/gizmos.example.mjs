// @config DESCRIPTION <div style='text-align:center'><div>Translate (1), Rotate (2), Scale (3)</div><div>World/Local (X)</div><div>Perspective (P), Orthographic (O)</div></div>
import * as pc from 'playcanvas';
import { data } from 'examples/observer';
import { deviceType, rootPath, localImport } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// class for handling gizmo
const { GizmoHandler } = await localImport('gizmo-handler.mjs');
const { Grid } = await localImport('grid.mjs');
const { Selector } = await localImport('selector.mjs');

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.keyboard = new pc.Keyboard(window);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.ScreenComponentSystem,
    pc.ElementComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.FontHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);

// load assets
const assets = {
    script: new pc.Asset('script', 'script', { url: rootPath + '/static/scripts/camera/orbit-camera.js' }),
    font: new pc.Asset('font', 'font', { url: rootPath + '/static/assets/fonts/courier.json' })
};
/**
 * @param {pc.Asset[] | number[]} assetList - The asset list.
 * @param {pc.AssetRegistry} assetRegistry - The asset registry.
 * @returns {Promise<void>} The promise.
 */
function loadAssets(assetList, assetRegistry) {
    return new Promise((resolve) => {
        const assetListLoader = new pc.AssetListLoader(assetList, assetRegistry);
        assetListLoader.load(resolve);
    });
}
await loadAssets(Object.values(assets), app.assets);

app.start();
/**
 * @param {pc.Color} color - The color.
 * @returns {pc.Material} - The standard material.
 */
function createColorMaterial(color) {
    const material = new pc.StandardMaterial();
    material.diffuse = color;
    material.update();
    return material;
}

// scene settings
app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

// create entities
const box = new pc.Entity('box');
box.addComponent('render', {
    type: 'box',
    material: createColorMaterial(new pc.Color(0.8, 1, 1))
});
box.setPosition(1, 0, 1);
app.root.addChild(box);

const sphere = new pc.Entity('sphere');
sphere.addComponent('render', {
    type: 'sphere',
    material: createColorMaterial(new pc.Color(1, 0.8, 1))
});
sphere.setPosition(-1, 0, 1);
app.root.addChild(sphere);

const cone = new pc.Entity('cone');
cone.addComponent('render', {
    type: 'cone',
    material: createColorMaterial(new pc.Color(1, 1, 0.8))
});
cone.setPosition(-1, 0, -1);
cone.setLocalScale(1.5, 2.25, 1.5);
app.root.addChild(cone);

const capsule = new pc.Entity('capsule');
capsule.addComponent('render', {
    type: 'capsule',
    material: createColorMaterial(new pc.Color(0.8, 0.8, 1))
});
capsule.setPosition(1, 0, -1);
app.root.addChild(capsule);

// create camera entity
data.set('camera', {
    proj: pc.PROJECTION_PERSPECTIVE + 1,
    dist: 1,
    fov: 45,
    orthoHeight: 10
});
const camera = new pc.Entity('camera');
camera.addComponent('camera', {
    clearColor: new pc.Color(0.1, 0.1, 0.1),
    farClip: 1000
});
camera.addComponent('script');
const orbitCamera = camera.script.create('orbitCamera');
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
camera.setPosition(1, 1, 1);
app.root.addChild(camera);
orbitCamera.distance = 5 * camera.camera?.aspectRatio;

// create light entity
const light = new pc.Entity('light');
light.addComponent('light', {
    intensity: 1
});
app.root.addChild(light);
light.setEulerAngles(0, 0, -60);

// create layers
const gizmoLayer = new pc.Layer({
    name: 'Gizmo',
    clearDepthBuffer: true,
    opaqueSortMode: pc.SORTMODE_NONE,
    transparentSortMode: pc.SORTMODE_NONE
});
const layers = app.scene.layers;
layers.push(gizmoLayer);
camera.camera.layers = camera.camera.layers.concat(gizmoLayer.id);

// create gizmo
const gizmoHandler = new GizmoHandler(app, camera.camera, gizmoLayer);
gizmoHandler.switch('translate');
gizmoHandler.add(box);
window.focus();

// wrappers for control state changes
const setType = (/** @type {string} */ value) => {
    data.set('gizmo.type', value);

    // call method from top context (same as controls)
    // @ts-ignore
    window.top.setType?.(value);
};
const setProj = (/** @type {number} */ value) => {
    data.set('camera.proj', value + 1);

    // call method from top context (same as controls)
    // @ts-ignore
    window.top.setProj?.(value);
};

// key event handlers
const keydown = (/** @type {KeyboardEvent} */ e) => {
    gizmoHandler.gizmo.snap = !!e.shiftKey;
    gizmoHandler.gizmo.uniform = !e.ctrlKey;
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
            setType('translate');
            break;
        case '2':
            setType('rotate');
            break;
        case '3':
            setType('scale');
            break;
        case 'p':
            setProj(pc.PROJECTION_PERSPECTIVE);
            break;
        case 'o':
            setProj(pc.PROJECTION_ORTHOGRAPHIC);
            break;
    }
};
window.addEventListener('keydown', keydown);
window.addEventListener('keyup', keyup);
window.addEventListener('keypress', keypress);

// gizmo and camera set handler
const tmpC = new pc.Color();
data.on('*:set', (/** @type {string} */ path, /** @type {any} */ value) => {
    const pathArray = path.split('.');

    switch (pathArray[0]) {
        case 'camera':
            switch (pathArray[1]) {
                case 'proj':
                    camera.camera.projection = value - 1;
                    break;
                case 'fov':
                    camera.camera.fov = value;
                    break;
            }
            return;
        case 'gizmo':
            if (gizmoHandler.skipSetFire) {
                return;
            }
            switch (pathArray[1]) {
                case 'type':
                    gizmoHandler.switch(value);
                    break;
                case 'xAxisColor':
                case 'yAxisColor':
                case 'zAxisColor':
                    // @ts-ignore
                    tmpC.set(...value);
                    gizmoHandler.gizmo[pathArray[1]] = tmpC;
                    break;
                default:
                    gizmoHandler.gizmo[pathArray[1]] = value;
                    break;
            }
            break;
    }
});

// selector
const selector = new Selector(app, camera.camera, [layers.getLayerByName('World')]);
selector.on('select', (/** @type {pc.GraphNode} */ node, /** @type {boolean} */ clear) => {
    if (gizmoHandler.ignorePicker) {
        return;
    }

    gizmoHandler.add(node, clear);
});
selector.on('deselect', () => {
    gizmoHandler.clear();
});

// grid
const grid = new Grid();

app.on('update', (/** @type {number} */ dt) => {
    grid.draw(app);
});

app.on('destroy', () => {
    gizmoHandler.destroy();
    selector.destroy();

    window.removeEventListener('resize', resize);
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('keyup', keyup);
    window.removeEventListener('keypress', keypress);
});

export { app };

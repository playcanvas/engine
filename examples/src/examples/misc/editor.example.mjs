// @config DESCRIPTION <div style='text-align:center'><div>Translate (1), Rotate (2), Scale (3)</div><div>World/Local (X)</div><div>Perspective (P), Orthographic (O)</div></div>
import { data } from 'examples/observer';
import { deviceType, rootPath, localImport, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { CameraControls } = await fileImport(`${rootPath}/static/scripts/esm/camera-controls.mjs`);
const { Grid } = await fileImport(`${rootPath}/static/scripts/esm/grid.mjs`);

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// class for handling gizmo
const { GizmoHandler } = await localImport('gizmo-handler.mjs');
const { Selector } = await localImport('selector.mjs');

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: `${rootPath}/static/lib/glslang/glslang.js`,
    twgslUrl: `${rootPath}/static/lib/twgsl/twgsl.js`
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
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.FontHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// load assets
const assets = {
    script: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    font: new pc.Asset('font', 'font', { url: `${rootPath}/static/assets/fonts/courier.json` })
};
/**
 * @param {pc.Asset[] | number[]} assetList - The asset list.
 * @param {pc.AssetRegistry} assetRegistry - The asset registry.
 * @returns {Promise<void>} The promise.
 */
const loadAssets = (assetList, assetRegistry) => {
    return new Promise((resolve) => {
        const assetListLoader = new pc.AssetListLoader(assetList, assetRegistry);
        assetListLoader.load(resolve);
    });
};
await loadAssets(Object.values(assets), app.assets);

app.start();

/**
 * @param {pc.Color} color - The color.
 * @returns {pc.Material} - The standard material.
 */
const createColorMaterial = (color) => {
    const material = new pc.StandardMaterial();
    material.diffuse = color;
    material.update();
    return material;
};

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

// camera
data.set('camera', {
    proj: pc.PROJECTION_PERSPECTIVE + 1,
    dist: 1,
    fov: 45,
    orthoHeight: 10
});
const camera = new pc.Entity('camera');
camera.addComponent('script');
camera.addComponent('camera', {
    clearColor: new pc.Color(0.1, 0.1, 0.1),
    farClip: 1000
});
const cameraOffset = 4 * camera.camera?.aspectRatio;
camera.setPosition(cameraOffset, cameraOffset, cameraOffset);
app.root.addChild(camera);
const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls, {
    properties: {
        focusPoint: pc.Vec3.ZERO,
        sceneSize: 5,
        rotateDamping: 0,
        moveDamping: 0
    }
}));
app.on('gizmo:pointer', (/** @type {boolean} */ hasPointer) => {
    if (hasPointer) {
        cameraControls.detach();
    } else {
        cameraControls.attach(camera.camera);
    }
});

// grid
const gridEntity = new pc.Entity('grid');
gridEntity.setLocalScale(8, 1, 8);
app.root.addChild(gridEntity);
gridEntity.addComponent('script');
const grid = /** @type {Grid} */ (gridEntity.script.create(Grid));
data.set('grid', {
    colorX: Object.values(grid.colorX),
    colorZ: Object.values(grid.colorZ),
    resolution: grid.resolution + 1
});

// create light entity
const light = new pc.Entity('light');
light.addComponent('light', {
    intensity: 1
});
app.root.addChild(light);
light.setEulerAngles(0, 0, -60);

// gizmos
let skipObserverFire = false;
const gizmoHandler = new GizmoHandler(camera.camera);
const setGizmoControls = () => {
    skipObserverFire = true;
    data.set('gizmo', {
        type: gizmoHandler.type,
        size: gizmoHandler.gizmo.size,
        snapIncrement: gizmoHandler.gizmo.snapIncrement,
        xAxisColor: Object.values(gizmoHandler.gizmo.xAxisColor),
        yAxisColor: Object.values(gizmoHandler.gizmo.yAxisColor),
        zAxisColor: Object.values(gizmoHandler.gizmo.zAxisColor),
        colorAlpha: gizmoHandler.gizmo.colorAlpha,
        coordSpace: gizmoHandler.gizmo.coordSpace
    });
    skipObserverFire = false;
};
gizmoHandler.switch('translate');
setGizmoControls();
gizmoHandler.add(box);
window.focus();

// view cube
const viewCube = new pc.ViewCube(new pc.Vec4(0, 1, 1, 0));
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
const tmpV1 = new pc.Vec3();
viewCube.on(pc.ViewCube.EVENT_CAMERAALIGN, (/** @type {pc.Vec3} */ dir) => {
    const cameraPos = camera.getPosition();
    const focusPoint = cameraControls.focusPoint;
    const cameraDist = focusPoint.distance(cameraPos);
    const cameraStart = tmpV1.copy(dir).mulScalar(cameraDist).add(focusPoint);
    cameraControls.refocus(focusPoint, cameraStart);
});
app.on('prerender', () => {
    viewCube.update(camera.getWorldTransform());
});

// selector
const layers = app.scene.layers;
const selector = new Selector(app, camera.camera, [layers.getLayerByName('World')]);
selector.on('select', (/** @type {pc.GraphNode} */ node, /** @type {boolean} */ clear) => {
    gizmoHandler.add(node, clear);
});
selector.on('deselect', () => {
    gizmoHandler.clear();
});

// ensure canvas is resized when window changes size + keep gizmo size consistent to canvas size
const resize = () => {
    app.resizeCanvas();
    const bounds = canvas.getBoundingClientRect();
    const dim = camera.camera.horizontalFov ? bounds.width : bounds.height;
    gizmoHandler.size = 1024 / dim;
    data.set('gizmo.size', gizmoHandler.size);
};
window.addEventListener('resize', resize);
resize();

// key event handlers
const keydown = (/** @type {KeyboardEvent} */ e) => {
    gizmoHandler.gizmo.snap = !!e.shiftKey;
    gizmoHandler.gizmo.uniform = !e.ctrlKey;

    if (e.key === 'f') {
        cameraControls.refocus(
            gizmoHandler.gizmo.root.getPosition(),
            null,
            cameraOffset
        );
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
            data.set('camera.proj', pc.PROJECTION_PERSPECTIVE + 1);
            break;
        case 'o':
            data.set('camera.proj', pc.PROJECTION_ORTHOGRAPHIC + 1);
            break;
    }
};
window.addEventListener('keydown', keydown);
window.addEventListener('keyup', keyup);
window.addEventListener('keypress', keypress);

// gizmo and camera set handler
const tmpC1 = new pc.Color();
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

app.on('destroy', () => {
    gizmoHandler.destroy();
    selector.destroy();

    window.removeEventListener('resize', resize);
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('keyup', keyup);
    window.removeEventListener('keypress', keypress);
});

export { app };

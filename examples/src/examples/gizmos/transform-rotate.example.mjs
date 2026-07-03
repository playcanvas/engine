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
    Gizmo,
    Keyboard,
    LightComponentSystem,
    Mouse,
    PROJECTION_PERSPECTIVE,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RotateGizmo,
    ScriptComponentSystem,
    ScriptHandler,
    TextureHandler,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { Grid } from 'playcanvas/scripts/esm/grid.mjs';

import { data, deviceType } from 'examples/context';

/**
 * @import { AssetRegistry, MeshInstance } from 'playcanvas'
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
createOptions.mouse = new Mouse(document.body);
createOptions.keyboard = new Keyboard(window);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, FontHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// load assets
const assets = {
    font: new Asset('font', 'font', { url: './assets/fonts/courier.json' })
};
/**
 * @param {Asset[] | number[]} assetList - The asset list.
 * @param {AssetRegistry} assetRegistry - The asset registry.
 * @returns {Promise<void>} The promise.
 */
function loadAssets(assetList, assetRegistry) {
    return new Promise(resolve => {
        const assetListLoader = new AssetListLoader(assetList, assetRegistry);
        assetListLoader.load(resolve);
    });
}
await loadAssets(Object.values(assets), app.assets);

app.start();

// scene settings
app.scene.ambientLight = new Color(0.2, 0.2, 0.2);

// create entities
const box = new Entity('box');
box.addComponent('render', {
    type: 'box'
});
app.root.addChild(box);

// camera
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

// camera controls
const cc = /** @type {CameraControls} */ (camera.script.create(CameraControls));
Object.assign(cc, {
    focusPoint: Vec3.ZERO,
    sceneSize: 5,
    rotateDamping: 0.95,
    moveDamping: 0.95,
    zoomDamping: 0.95,
    pitchRange: new Vec2(-89.999, 89.999),
    zoomRange: new Vec2(2, 10),
    enableFly: false
});
app.on('gizmo:pointer', (/** @type {boolean} */ hasPointer) => {
    cc.enabled = !hasPointer;
});

// create light entity
const light = new Entity('light');
light.addComponent('light');
app.root.addChild(light);
light.setEulerAngles(0, 0, -60);

// create gizmo
const layer = Gizmo.createLayer(app);
const gizmo = new RotateGizmo(camera.camera, layer);
gizmo.on('pointer:down', (_x, _y, /** @type {MeshInstance} */ meshInstance) => {
    app.fire('gizmo:pointer', !!meshInstance);
});
gizmo.on('pointer:up', () => {
    app.fire('gizmo:pointer', false);
});
gizmo.attach(box);
data.set('gizmo', {
    size: gizmo.size,
    snap: gizmo.snap,
    snapIncrement: gizmo.snapIncrement,
    dragMode: gizmo.dragMode,
    rotationMode: gizmo.rotationMode,
    theme: {
        shapeBase: {
            x: gizmo.theme.shapeBase.x.toArray(),
            y: gizmo.theme.shapeBase.y.toArray(),
            z: gizmo.theme.shapeBase.z.toArray(),
            xyz: gizmo.theme.shapeBase.xyz.toArray(),
            f: gizmo.theme.shapeBase.f.toArray()
        },
        shapeHover: {
            x: gizmo.theme.shapeHover.x.toArray(),
            y: gizmo.theme.shapeHover.y.toArray(),
            z: gizmo.theme.shapeHover.z.toArray(),
            xyz: gizmo.theme.shapeHover.xyz.toArray(),
            f: gizmo.theme.shapeHover.f.toArray()
        },
        guideBase: {
            x: gizmo.theme.guideBase.x.toArray(),
            y: gizmo.theme.guideBase.y.toArray(),
            z: gizmo.theme.guideBase.z.toArray()
        },
        guideOcclusion: gizmo.theme.guideOcclusion,
        disabled: gizmo.theme.disabled.toArray()
    },
    coordSpace: gizmo.coordSpace,
    ringTolerance: gizmo.ringTolerance,
    xyzTubeRadius: gizmo.xyzTubeRadius,
    xyzRingRadius: gizmo.xyzRingRadius,
    faceTubeRadius: gizmo.faceTubeRadius,
    faceRingRadius: gizmo.faceRingRadius,
    centerRadius: gizmo.centerRadius,
    angleGuideThickness: gizmo.angleGuideThickness
});

// create grid
const gridEntity = new Entity('grid');
gridEntity.setLocalScale(4, 1, 4);
app.root.addChild(gridEntity);
gridEntity.addComponent('script');
gridEntity.script.create(Grid);

// controls hook
const tmpC = new Color();
data.on('*:set', (/** @type {string} */ path, /** @type {any} */ value) => {
    const [category, key, ...parts] = path.split('.');
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
            if (key === 'theme') {
                if (parts.length === 0) {
                    return;
                }
                const theme = /** @type {any} */ ({});
                let cursor = theme;
                for (let i = 0; i < parts.length - 1; i++) {
                    cursor[parts[i]] = {};
                    cursor = cursor[parts[i]];
                }
                cursor[parts[parts.length - 1]] = Array.isArray(value) ? tmpC.fromArray(value) : value;
                gizmo.setTheme(theme);
                return;
            }
            // @ts-ignore
            gizmo[key] = value;
            break;
        }
    }
});

// ensure canvas is resized when window changes size + keep gizmo size consistent to canvas size
const resize = () => {
    app.resizeCanvas();
    const bounds = canvas.getBoundingClientRect();
    const dim = camera.camera.horizontalFov ? bounds.width : bounds.height;
    data.set('gizmo.size', 1024 / dim);
};
window.addEventListener('resize', resize);
resize();

app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// @config
//
// The shape of a light, faint where the scene hides it

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    Gizmo,
    JsonHandler,
    Keyboard,
    LIGHTSHAPE_PUNCTUAL,
    LightComponentSystem,
    LightGizmo,
    Mouse,
    PROJECTION_PERSPECTIVE,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { Grid } from 'playcanvas/scripts/esm/grid.mjs';

import { data, deviceType } from 'examples/context';

/**
 * @import { MeshInstance } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    luts: new Asset('luts', 'json', { url: './assets/json/area-light-luts.json' })
};

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
createOptions.resourceHandlers = [ScriptHandler, JsonHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Scene settings, with area lights so the light can take a shape
app.scene.ambientLight = new Color(0.2, 0.2, 0.2);
app.scene.lighting.areaLightsEnabled = true;
app.setAreaLightLuts(assets.luts.resource.LTC_MAT_1, assets.luts.resource.LTC_MAT_2);

// Create entities
const box = new Entity('box');
box.addComponent('render', {
    type: 'box'
});
app.root.addChild(box);

// Camera
data.set('camera', {
    proj: PROJECTION_PERSPECTIVE + 1,
    fov: 45
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
    rotateDamping: 0.95,
    moveDamping: 0.95,
    zoomDamping: 0.95,
    pitchRange: new Vec2(-89.999, 89.999),
    zoomRange: new Vec2(1, 20),
    enableFly: false
});

// Create light entity above and to the side of the box, scaled to size its area shape
const light = new Entity('light');
light.addComponent('light', {
    type: 'spot',
    color: new Color(1, 0.85, 0.6),
    range: 4,
    innerConeAngle: 25,
    outerConeAngle: 40
});
light.setPosition(-1.5, 2.5, 1.5);
light.setLocalScale(1, 1, 0.5);

// aim the light at the box: lookAt points the forward axis, and a light shines along -y
light.lookAt(Vec3.ZERO);
light.rotateLocal(90, 0, 0);
app.root.addChild(light);

// Create gizmo in a layer that keeps the scene depth
const layer = Gizmo.createLayer(app, 'Helpers', undefined, true);
const gizmo = new LightGizmo(camera.camera, layer);
gizmo.attach(light);

// Stop the camera orbiting while a handle is dragged
gizmo.on('pointer:down', (_x, _y, /** @type {MeshInstance} */ meshInstance) => {
    cc.enabled = !meshInstance;
});
gizmo.on('pointer:up', () => {
    cc.enabled = true;
});

// Keep the controls in step with the handles
gizmo.on('handle:move', () => {
    data.set('light.range', light.light.range);
    data.set('light.innerConeAngle', light.light.innerConeAngle);
    data.set('light.outerConeAngle', light.light.outerConeAngle);
});
data.set('gizmo', {
    theme: {
        base: gizmo.theme.base.toArray(),
        occluded: gizmo.theme.occluded.toArray(),
        fill: gizmo.theme.fill.toArray(),
        primary: gizmo.theme.primary.toArray(),
        secondary: gizmo.theme.secondary.toArray(),
        tertiary: gizmo.theme.tertiary.toArray(),
        backdrop: gizmo.theme.backdrop.toArray()
    },
    lineThickness: gizmo.lineThickness,
    handleSize: gizmo.handleSize,
    size: gizmo.size,
    iconSize: gizmo.iconSize,
    handles: gizmo.handles,
    readout: gizmo.readout,
    icon: gizmo.icon,
    snap: gizmo.snap,
    snapIncrement: gizmo.snapIncrement,
    snapAngleIncrement: gizmo.snapAngleIncrement,
    groundLine: gizmo.groundLine,
    useLightColor: gizmo.useLightColor
});
data.set('light', {
    type: light.light.type,
    shape: LIGHTSHAPE_PUNCTUAL,
    color: [light.light.color.r, light.light.color.g, light.light.color.b],
    range: light.light.range,
    innerConeAngle: light.light.innerConeAngle,
    outerConeAngle: light.light.outerConeAngle
});

// Create grid
const gridEntity = new Entity('grid');
app.root.addChild(gridEntity);
gridEntity.addComponent('script');
gridEntity.script.create(Grid);

// Controls hook
const tmpC = new Color();
data.on('*:set', (/** @type {string} */ path, /** @type {any} */ value) => {
    const [category, key, part] = path.split('.');
    switch (category) {
        case 'camera': {
            switch (key) {
                case 'proj': {
                    camera.camera.projection = value - 1;
                    break;
                }
                case 'fov': {
                    camera.camera.fov = value;
                    break;
                }
            }
            break;
        }
        case 'light': {
            if (key === 'color') {
                light.light.color = tmpC.fromArray(value);
                return;
            }

            // @ts-ignore
            light.light[key] = value;
            break;
        }
        case 'gizmo': {
            if (key === 'theme') {
                if (part) {
                    gizmo.setTheme({ [part]: tmpC.fromArray(value) });
                }
                return;
            }

            // @ts-ignore
            gizmo[key] = value;
            break;
        }
    }
});

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
resize();

app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

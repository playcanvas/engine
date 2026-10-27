// @config
//
// Corner brackets outline the bounds of the box, faint where it hides them

import {
    AppBase,
    AppOptions,
    BoundingBoxGizmo,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    Gizmo,
    Keyboard,
    LightComponentSystem,
    Mouse,
    PROJECTION_PERSPECTIVE,
    RESOLUTION_AUTO,
    RenderComponentSystem,
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
 * @import { MeshInstance } from 'playcanvas'
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
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

app.start();

// Scene settings
app.scene.ambientLight = new Color(0.2, 0.2, 0.2);

// Create entities
const box = new Entity('box');
box.addComponent('render', {
    type: 'box'
});
app.root.addChild(box);

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
    rotateDamping: 0.95,
    moveDamping: 0.95,
    zoomDamping: 0.95,
    pitchRange: new Vec2(-89.999, 89.999),
    zoomRange: new Vec2(2, 10),
    enableFly: false
});

// Create light entity
const light = new Entity('light');
light.addComponent('light');
app.root.addChild(light);
light.setEulerAngles(0, 0, -60);

// Create gizmo in a layer that keeps the scene depth
const layer = Gizmo.createLayer(app, 'Bounds', undefined, true);
const gizmo = new BoundingBoxGizmo(camera.camera, layer);
gizmo.attach(box);

// Stop the camera orbiting while a handle is dragged
gizmo.on('pointer:down', (_x, _y, /** @type {MeshInstance} */ meshInstance) => {
    cc.enabled = !meshInstance;
});
gizmo.on('pointer:up', () => {
    cc.enabled = true;
});
data.set('gizmo', {
    theme: {
        base: gizmo.theme.base.toArray(),
        occluded: gizmo.theme.occluded.toArray(),
        fill: gizmo.theme.fill.toArray(),
        primary: gizmo.theme.primary.toArray(),
        secondary: gizmo.theme.secondary.toArray(),
        tertiary: gizmo.theme.tertiary.toArray(),
        corner: gizmo.theme.corner.toArray()
    },
    armLength: gizmo.armLength,
    armThickness: gizmo.armThickness,
    padding: gizmo.padding,
    handleSize: gizmo.handleSize,
    edges: gizmo.edges,
    handles: gizmo.handles,
    readout: gizmo.readout,
    icon: gizmo.icon,
    snap: gizmo.snap,
    snapIncrement: gizmo.snapIncrement
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

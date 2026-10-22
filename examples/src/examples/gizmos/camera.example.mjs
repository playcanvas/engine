// @config
//
// The frustum of a second camera, faint where the scene hides it

import {
    AppBase,
    AppOptions,
    CameraComponentSystem,
    CameraGizmo,
    Color,
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
    Vec2,
    Vec3,
    Vec4,
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
createOptions.resourceHandlers = [ScriptHandler];

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
    zoomRange: new Vec2(2, 20),
    enableFly: false
});

// Second camera looking at the box, rendered after the main one into the corner of the screen
const subject = new Entity('subject');
subject.addComponent('camera', {
    clearColor: new Color(0.2, 0.2, 0.25),
    priority: 1,
    rect: new Vec4(0.7, 0.02, 0.28, 0.28),
    nearClip: 0.5,
    farClip: 4,
    fov: 45,
    orthoHeight: 1
});
subject.setPosition(-1.5, 1, 2.5);
subject.lookAt(Vec3.ZERO);
app.root.addChild(subject);

// Frame and label the second camera's view, matching its rect, which is measured from the bottom left
const { x, y, z, w } = subject.camera.rect;
const frame = document.createElement('div');
frame.style.cssText = `
    position: absolute; left: ${x * 100}%; bottom: ${y * 100}%; width: ${z * 100}%; height: ${w * 100}%;
    box-sizing: border-box; border: 1px solid rgba(255, 255, 255, 0.6);
    pointer-events: none;`;
const label = document.createElement('div');
label.style.cssText = `
    position: absolute; top: 6px; left: 6px; padding: 2px 6px; border-radius: 3px;
    font-family: Arial, sans-serif; font-size: 12px; color: white; background: rgba(0, 0, 0, 0.5);`;
label.textContent = 'Subject camera';
frame.appendChild(label);
document.body.appendChild(frame);

// Create light entity
const light = new Entity('light');
light.addComponent('light');
app.root.addChild(light);
light.setEulerAngles(0, 0, -60);

// Create gizmo in a layer that keeps the scene depth
const layer = Gizmo.createLayer(app, 'Helpers', undefined, true);
const gizmo = new CameraGizmo(camera.camera, layer);
gizmo.attach(subject);

// Stop the camera orbiting while a handle is dragged
gizmo.on('pointer:down', (_x, _y, /** @type {MeshInstance} */ meshInstance) => {
    cc.enabled = !meshInstance;
});
gizmo.on('pointer:up', () => {
    cc.enabled = true;
});

// Keep the controls in step with the handles
gizmo.on('handle:move', () => {
    data.set('subject.fov', subject.camera.fov);
    data.set('subject.orthoHeight', subject.camera.orthoHeight);
    data.set('subject.nearClip', subject.camera.nearClip);
    data.set('subject.farClip', subject.camera.farClip);
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
    iconSize: gizmo.iconSize,
    handles: gizmo.handles,
    readout: gizmo.readout,
    icon: gizmo.icon,
    snap: gizmo.snap,
    snapIncrement: gizmo.snapIncrement,
    snapAngleIncrement: gizmo.snapAngleIncrement
});
data.set('subject', {
    proj: PROJECTION_PERSPECTIVE + 1,
    fov: subject.camera.fov,
    orthoHeight: subject.camera.orthoHeight,
    nearClip: subject.camera.nearClip,
    farClip: subject.camera.farClip
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
        case 'subject': {
            if (key === 'proj') {
                subject.camera.projection = value - 1;
                return;
            }

            // @ts-ignore
            subject.camera[key] = value;
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
    frame.remove();
});

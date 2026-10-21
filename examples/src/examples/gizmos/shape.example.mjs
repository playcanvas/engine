// @config
//
// Shape gizmos edit a shape of their own, such as a volume to select within: a box, sphere, capsule and cone

import {
    AppBase,
    AppOptions,
    BoxGizmo,
    CameraComponentSystem,
    CapsuleGizmo,
    Color,
    ConeGizmo,
    Entity,
    FILLMODE_FILL_WINDOW,
    Keyboard,
    Layer,
    LightComponentSystem,
    Mouse,
    PROJECTION_PERSPECTIVE,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SORTMODE_MANUAL,
    SORTMODE_NONE,
    ScriptComponentSystem,
    ScriptHandler,
    SphereGizmo,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { Grid } from 'playcanvas/scripts/esm/grid.mjs';

import { data, deviceType } from 'examples/context';

/**
 * @import { MeshInstance, ShapeGizmo } from 'playcanvas'
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

// Create light entity
const light = new Entity('light');
light.addComponent('light');
app.root.addChild(light);
light.setEulerAngles(0, 0, -60);

// Create the shape gizmos in a layer that keeps the scene depth
const layer = new Layer({
    name: 'Helpers',
    opaqueSortMode: SORTMODE_NONE,
    transparentSortMode: SORTMODE_MANUAL
});
app.scene.layers.push(layer);

/** @type {Record<string, ShapeGizmo>} */
const gizmos = {
    box: new BoxGizmo(camera.camera, layer),
    sphere: new SphereGizmo(camera.camera, layer),
    cone: new ConeGizmo(camera.camera, layer),
    capsule: new CapsuleGizmo(camera.camera, layer)
};

// the shapes of the editor example, in the same places
/** @type {BoxGizmo} */ (gizmos.box).halfExtents.set(0.5, 0.5, 0.5);
gizmos.box.position.set(1, 0, 1);
/** @type {SphereGizmo} */ (gizmos.sphere).radius = 0.5;
gizmos.sphere.position.set(-1, 0, 1);
Object.assign(gizmos.cone, { radius: 0.75, height: 2.25 });
gizmos.cone.position.set(-1, 0, -1);
Object.assign(gizmos.capsule, { radius: 0.5, height: 2 });
gizmos.capsule.position.set(1, 0, -1);

for (const key in gizmos) {
    const gizmo = gizmos[key];

    // stop the camera orbiting while a handle is dragged
    gizmo.on('pointer:down', (_x, _y, /** @type {MeshInstance} */ meshInstance) => {
        cc.enabled = !meshInstance;
    });
    gizmo.on('pointer:up', () => {
        cc.enabled = true;
    });
}

const settings = gizmos.box;
data.set('gizmo', {
    theme: {
        base: settings.theme.base.toArray(),
        occluded: settings.theme.occluded.toArray(),
        fill: settings.theme.fill.toArray()
    },
    lineThickness: settings.lineThickness,
    handleSize: settings.handleSize,
    handles: settings.handles,
    readout: settings.readout
});
data.set('box', {
    faceHandles: true,
    cornerHandles: true,
    centered: false,
    uniform: false
});

// Create grid
const gridEntity = new Entity('grid');
gridEntity.setLocalScale(8, 1, 8);
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
        case 'box': {
            // @ts-ignore
            gizmos.box[key] = value;
            break;
        }
        case 'gizmo': {
            for (const name in gizmos) {
                const gizmo = gizmos[name];
                if (key === 'theme') {
                    if (part) {
                        gizmo.setTheme({ [part]: tmpC.fromArray(value) });
                    }
                    continue;
                }
                // @ts-ignore
                gizmo[key] = value;
            }
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

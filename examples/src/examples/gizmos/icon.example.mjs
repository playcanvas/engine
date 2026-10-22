// @config
//
// Icons mark entities that have nothing else to see or click, such as lights, cameras and sounds; click one to focus on it

import {
    AppBase,
    AppOptions,
    AudioListenerComponentSystem,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    Gizmo,
    IconGizmo,
    Keyboard,
    LightComponentSystem,
    Mouse,
    ParticleSystemComponentSystem,
    PROJECTION_PERSPECTIVE,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    SoundComponentSystem,
    SoundManager,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { Grid } from 'playcanvas/scripts/esm/grid.mjs';

import { data, deviceType } from 'examples/context';

/**
 * @import { GraphNode } from 'playcanvas'
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
createOptions.soundManager = new SoundManager();

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    AudioListenerComponentSystem,
    SoundComponentSystem,
    ParticleSystemComponentSystem
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
const cameraOffset = 3 * camera.camera.aspectRatio;
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

// One entity for each icon, of which the selected one is enabled
const subjects = {
    camera: { camera: { layers: [], clearColorBuffer: false, clearDepthBuffer: false, priority: -1 } },
    light: { light: { type: 'omni', range: 2, color: new Color(1, 0.85, 0.6) } },
    audiolistener: { audiolistener: {} },
    sound: { sound: {} },
    particlesystem: { particlesystem: { autoPlay: false } }
};
/**
 * @type {Record<string, Entity>}
 */
const entities = {};
for (const [name, components] of Object.entries(subjects)) {
    const entity = new Entity(`${name} subject`);
    for (const [type, options] of Object.entries(components)) {
        entity.addComponent(type, options);
    }
    entity.setPosition(0, 1, 0);
    entity.enabled = false;
    app.root.addChild(entity);
    entities[name] = entity;
}

// Create gizmo in a layer that keeps the scene depth
const layer = Gizmo.createLayer(app, 'Overlays', undefined, true);
const gizmo = new IconGizmo(camera.camera, layer);
gizmo.attach(Object.values(entities));

// Clicking an icon focuses the camera on its entity
gizmo.on('icon:select', (/** @type {GraphNode} */ node) => {
    cc.focus(node.getPosition(), false);
});

/**
 * @param {string} name - The icon to show.
 */
const show = (name) => {
    for (const key in entities) {
        entities[key].enabled = key === name;
    }
};
show('light');
data.set('icon', 'light');
data.set('gizmo', {
    theme: {
        base: gizmo.theme.base.toArray(),
        occluded: gizmo.theme.occluded.toArray(),
        backdrop: gizmo.theme.backdrop.toArray()
    },
    useLightColor: gizmo.useLightColor,
    iconSize: gizmo.iconSize
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
        case 'icon': {
            show(value);
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

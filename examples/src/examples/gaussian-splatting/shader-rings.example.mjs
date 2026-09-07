// @config
//
// This example demonstrates per-pixel customization of gaussian splat rendering using the
// gsplatModifyPS shader chunk. Each splat is rendered as a ring of its own color, with an
// adjustable ring width and a time based highlight pulse.

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
    GSplatComponentSystem,
    GSplatHandler,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

import shaderGlslFrag from './shader.glsl.frag';
import shaderWgslFrag from './shader.wgsl.frag';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // Disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    GSplatComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, GSplatHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assets = {
    skull: new Asset('gsplat', 'gsplat', { url: './assets/splats/skull.compressed.ply' })
};

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

data.set('ringWidth', 1);
data.set('ringAlpha', 0.25);

// Update spherical harmonics colors every degree of camera movement
app.scene.gsplat.colorUpdateAngle = 1;

// Apply the custom fragment chunk to the scene-wide gsplat material
const material = app.scene.gsplat.material;
material.getShaderChunks('glsl').set('gsplatModifyPS', shaderGlslFrag);
material.getShaderChunks('wgsl').set('gsplatModifyPS', shaderWgslFrag);
material.update();

// Create skull gsplat
const skull = new Entity('skull');
skull.addComponent('gsplat', {
    asset: assets.skull
});
skull.setLocalEulerAngles(180, 90, 0);
skull.setLocalScale(0.7, 0.7, 0.7);
app.root.addChild(skull);

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: Color.BLACK,
    fov: 80
});
app.root.addChild(camera);

// Add camera controls with mouse and touch support
camera.addComponent('script');
const orbitPivot = new Vec3(0, 0.9, -0.28);
const cameraControls = /** @type {CameraControls} */ (
    camera.script.create(CameraControls, {
        properties: {
            zoomRange: new Vec2(0.01, 6),
            enableFly: false
        }
    })
);

// initial view: yaw 88, pitch -28 (degrees) at a distance of 0.9 around the pivot
const initYaw = (88 * Math.PI) / 180;
const initPitch = (-28 * Math.PI) / 180;
cameraControls.reset(
    orbitPivot,
    new Vec3(
        orbitPivot.x + 0.9 * Math.sin(initYaw) * Math.cos(initPitch),
        orbitPivot.y - 0.9 * Math.sin(initPitch),
        orbitPivot.z + 0.9 * Math.cos(initYaw) * Math.cos(initPitch)
    )
);

// Auto-rotate camera when idle
let autoRotateEnabled = true;
let lastInteractionTime = 0;
const autoRotateDelay = 2; // seconds of inactivity before auto-rotate resumes
const autoRotateSpeed = 10; // degrees per second

// Detect user interaction (click/touch only, not mouse movement)
const onUserInteraction = () => {
    autoRotateEnabled = false;
    lastInteractionTime = Date.now();
};

// Listen for click and touch events only
if (app.mouse) {
    app.mouse.on('mousedown', onUserInteraction);
    app.mouse.on('mousewheel', onUserInteraction);
}
if (app.touch) {
    app.touch.on('touchstart', onUserInteraction);
}

let time = 0;
app.on('update', (dt) => {
    time += dt;

    // Drive the shader uniforms
    material.setParameter('uRingWidth', data.get('ringWidth'));
    material.setParameter('uRingAlpha', data.get('ringAlpha'));
    material.setParameter('uTime', time);
    material.update();

    // Re-enable auto-rotate after delay
    if (!autoRotateEnabled && (Date.now() - lastInteractionTime) / 1000 > autoRotateDelay) {
        autoRotateEnabled = true;
    }

    // Apply auto-rotation by advancing the camera's azimuth around the pivot
    if (autoRotateEnabled) {
        const offset = camera.getPosition().clone().sub(orbitPivot);
        const r = offset.length();
        const pitch = Math.asin(Math.max(-1, Math.min(1, offset.y / r)));
        const yaw = Math.atan2(offset.x, offset.z) + (autoRotateSpeed * dt * Math.PI) / 180;
        const cp = Math.cos(pitch);
        cameraControls.reset(
            orbitPivot,
            new Vec3(
                orbitPivot.x + r * Math.sin(yaw) * cp,
                orbitPivot.y + r * Math.sin(pitch),
                orbitPivot.z + r * Math.cos(yaw) * cp
            )
        );
    }
});

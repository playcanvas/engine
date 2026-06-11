// @config
//
// This example demonstrates per-pixel customization of gaussian splat rendering using the
// gsplatModifyPS shader chunk. Each splat is rendered as a ring of its own color, with an
// adjustable ring width and a time based highlight pulse.

import * as pc from 'playcanvas';

import { data, deviceType } from 'examples/context';

import shaderGlslFrag from './shader.glsl.frag';
import shaderWgslFrag from './shader.wgsl.frag';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.GSplatHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assets = {
    skull: new pc.Asset('gsplat', 'gsplat', { url: './assets/splats/skull.compressed.ply' }),
    orbit: new pc.Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    data.set('ringWidth', 1);
    data.set('ringAlpha', 0.25);

    // update spherical harmonics colors every degree of camera movement
    app.scene.gsplat.colorUpdateAngle = 1;

    // apply the custom fragment chunk to the scene-wide gsplat material
    const material = app.scene.gsplat.material;
    material.getShaderChunks('glsl').set('gsplatModifyPS', shaderGlslFrag);
    material.getShaderChunks('wgsl').set('gsplatModifyPS', shaderWgslFrag);
    material.update();

    // Create skull gsplat
    const skull = new pc.Entity('skull');
    skull.addComponent('gsplat', {
        asset: assets.skull
    });
    skull.setLocalEulerAngles(180, 90, 0);
    skull.setLocalScale(0.7, 0.7, 0.7);
    app.root.addChild(skull);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: pc.Color.BLACK,
        fov: 80
    });
    app.root.addChild(camera);

    // add orbit camera script with a mouse and a touch support
    camera.addComponent('script');
    const orbitCam = /** @type {any} */ (camera.script?.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            distanceMax: 6,
            frameOnStart: false
        }
    }));
    if (orbitCam) {
        orbitCam.pivotPoint.copy(new pc.Vec3(0, 0.9, -0.28));
        orbitCam.reset(88, -28, 0.9);
        orbitCam._updatePosition();
    }
    camera.script?.create('orbitCameraInputMouse');
    camera.script?.create('orbitCameraInputTouch');

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

        // drive the shader uniforms
        material.setParameter('uRingWidth', data.get('ringWidth'));
        material.setParameter('uRingAlpha', data.get('ringAlpha'));
        material.setParameter('uTime', time);
        material.update();

        // Re-enable auto-rotate after delay
        if (!autoRotateEnabled && (Date.now() - lastInteractionTime) / 1000 > autoRotateDelay) {
            autoRotateEnabled = true;
        }

        // Apply auto-rotation
        if (autoRotateEnabled) {
            const orbitCamera = camera.script?.get('orbitCamera');
            if (orbitCamera) {
                orbitCamera.yaw += autoRotateSpeed * dt;
            }
        }
    });
});

// @config
//
// This example demonstrates a noise-based dissolve effect for gaussian splats, where each splat
// acts as a particle of the dissolve - glowing at the burning edge and flying off before
// disappearing.

import * as pc from 'playcanvas';
import { GsplatDissolveShaderEffect } from 'playcanvas/scripts/esm/gsplat/shader-effect-dissolve.mjs';

import { data, deviceType } from 'examples/context';

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
    hotel: new pc.Asset('gsplat', 'gsplat', { url: './assets/splats/hotel-culpture.compressed.ply' }),
    orbit: new pc.Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Style configurations for the dissolve effect
    const styleConfigs = {
        ember: {
            aabbMin: new pc.Vec3(-1, -1.6, -1),
            aabbMax: new pc.Vec3(1, 2, 1),
            duration: 2.5,
            noiseFrequency: 2.2,
            edgeWidth: 0.12,
            edgeColor: new pc.Color(6, 1.5, 0.2),       // hot orange
            liftDirection: new pc.Vec3(0, 1, 0),
            liftDistance: 0.6,
            waveAmplitude: 0.06,
            waveFrequency: 6
        },
        plasma: {
            aabbMin: new pc.Vec3(-1, -1.6, -1),
            aabbMax: new pc.Vec3(1, 2, 1),
            duration: 3.0,
            noiseFrequency: 5.0,
            edgeWidth: 0.08,
            edgeColor: new pc.Color(0.3, 2.0, 8),       // electric blue
            liftDirection: new pc.Vec3(0, 1, 0),
            liftDistance: 0.25,
            waveAmplitude: 0.1,
            waveFrequency: 10
        },
        mist: {
            aabbMin: new pc.Vec3(-1, -1.6, -1),
            aabbMax: new pc.Vec3(1, 2, 1),
            duration: 3.5,
            noiseFrequency: 1.2,
            edgeWidth: 0.35,
            edgeColor: new pc.Color(2, 2, 2.5),         // soft white
            liftDirection: new pc.Vec3(0, 1, 0),
            liftDistance: 1.2,
            waveAmplitude: 0.15,
            waveFrequency: 3
        }
    };

    data.on('renderer:set', () => {
        app.scene.gsplat.renderer = data.get('renderer');
        const current = app.scene.gsplat.currentRenderer;
        if (current !== data.get('renderer')) {
            setTimeout(() => data.set('renderer', current), 0);
        }
    });

    // Default to enabled
    data.set('renderer', pc.GSPLAT_RENDERER_AUTO);
    data.set('enabled', true);
    data.set('style', 'ember');
    data.set('loop', true);

    // Create hotel gsplat
    const hotel = new pc.Entity('hotel');
    hotel.addComponent('gsplat', {
        asset: assets.hotel
    });
    hotel.setLocalEulerAngles(180, 0, 0);
    app.root.addChild(hotel);

    // Add script component to the hotel entity
    hotel.addComponent('script');

    // Create the dissolve effect script
    const dissolveScript = hotel.script?.create(GsplatDissolveShaderEffect);

    // Helper function to apply style configuration to script
    /**
     * @param {any} config - The style configuration object
     */
    const applyStyleConfig = (config) => {
        if (!dissolveScript) return;

        dissolveScript.aabbMin.copy(config.aabbMin);
        dissolveScript.aabbMax.copy(config.aabbMax);
        dissolveScript.duration = config.duration;
        dissolveScript.noiseFrequency = config.noiseFrequency;
        dissolveScript.edgeWidth = config.edgeWidth;
        dissolveScript.edgeColor.copy(config.edgeColor);
        dissolveScript.liftDirection.copy(config.liftDirection);
        dissolveScript.liftDistance = config.liftDistance;
        dissolveScript.waveAmplitude = config.waveAmplitude;
        dissolveScript.waveFrequency = config.waveFrequency;
    };

    // Helper function to restart the effect (resets effectTime)
    const restartEffect = () => {
        if (dissolveScript && data.get('enabled')) {
            dissolveScript.enabled = false;
            dissolveScript.enabled = true;
        }
    };

    // Apply initial configuration
    applyStyleConfig(styleConfigs[/** @type {keyof typeof styleConfigs} */ (data.get('style'))]);

    // Handle style changes - apply config and restart from a dissolve
    data.on('style:set', () => {
        const config = styleConfigs[/** @type {keyof typeof styleConfigs} */ (data.get('style'))];
        if (dissolveScript && config) {
            applyStyleConfig(config);
            dissolveScript.dissolve = true;
            restartEffect();
        }
    });

    // Restart button - restart from a dissolve
    data.on('restart', () => {
        if (dissolveScript) {
            dissolveScript.dissolve = true;
            restartEffect();
        }
    });

    // Handle enable/disable toggle
    data.on('enabled:set', () => {
        const enabled = data.get('enabled');
        if (dissolveScript) {
            dissolveScript.enabled = enabled;
        }
    });

    // When looping, alternate between dissolve and reassemble after a short hold
    const holdTime = 0.8;
    app.on('update', () => {
        if (!dissolveScript?.enabled || !data.get('loop')) return;

        if (dissolveScript.effectTime > dissolveScript.duration + holdTime) {
            dissolveScript.dissolve = !dissolveScript.dissolve;
            restartEffect();
        }
    });

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: pc.Color.BLACK,
        fov: 80
    });
    camera.setLocalPosition(3, 1, 0.5);

    // add orbit camera script with a mouse and a touch support
    camera.addComponent('script');
    camera.script?.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: hotel,
            distanceMax: 2,
            frameOnStart: false
        }
    });
    camera.script?.create('orbitCameraInputMouse');
    camera.script?.create('orbitCameraInputTouch');
    app.root.addChild(camera);

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

    // Auto-rotate update
    app.on('update', (dt) => {
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

// @config DESCRIPTION This example demonstrates shader effects for gaussian splats.
import { data } from 'examples/observer';
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { GsplatBoxShaderEffect } = await fileImport(`${rootPath}/static/scripts/esm/gsplat/shader-effect-box.mjs`);

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: `${rootPath}/static/lib/glslang/glslang.js`,
    twgslUrl: `${rootPath}/static/lib/twgsl/twgsl.js`,

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
    hotel: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/hotel-culpture.compressed.ply` }),
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Effect configurations
    const effectConfigs = {
        reveal: {
            aabbMin: new pc.Vec3(-1, -1.6, -1),
            aabbMax: new pc.Vec3(1, 2, 1),
            direction: new pc.Vec3(0, 1, 0),      // bottom to top
            duration: 1.0,
            visibleStart: false,
            visibleEnd: true,
            interval: 0.1,
            baseTint: new pc.Color(1, 1, 1),      // white (no base tint)
            edgeTint: new pc.Color(5, 0, 0),     // red
            tint: new pc.Color(1, 1, 1)           // white
        },
        hide: {
            aabbMin: new pc.Vec3(-1, -1.6, -1),
            aabbMax: new pc.Vec3(1, 2, 1),
            direction: new pc.Vec3(0, -1, 0),     // top to bottom
            duration: 1.0,
            visibleStart: true,
            visibleEnd: false,
            interval: 0.1,
            baseTint: new pc.Color(1, 1, 1),      // white (no base tint)
            edgeTint: new pc.Color(5, 0, 0),     // red
            tint: new pc.Color(1, 1, 1)           // white
        },
        tint: {
            aabbMin: new pc.Vec3(-1, -1.6, -1),
            aabbMax: new pc.Vec3(1, 2, 1),
            direction: new pc.Vec3(1, 0, 0),      // left to right
            duration: 2.0,
            visibleStart: true,
            visibleEnd: true,
            interval: 0.05,
            baseTint: new pc.Color(1, 1, 1),      // white (no base tint)
            edgeTint: new pc.Color(5, 0, 0),     // red
            tint: new pc.Color(1, 1, 0)           // yellow
        },
        untint: {
            aabbMin: new pc.Vec3(-1, -1.6, -1),
            aabbMax: new pc.Vec3(1, 2, 1),
            direction: new pc.Vec3(-1, 0, 0),     // right to left (reverse of tint)
            duration: 2.0,
            visibleStart: true,
            visibleEnd: true,
            interval: 0.05,
            invertTint: true,                     // apply tint ahead instead of behind
            baseTint: new pc.Color(1, 1, 1),      // white (target/original state)
            edgeTint: new pc.Color(5, 0, 0),     // red
            tint: new pc.Color(1, 1, 0)           // yellow (applied ahead to preserve)
        },
        roomReveal: {
            aabbMin: new pc.Vec3(-50, -5, -50),
            aabbMax: new pc.Vec3(50, 5, 50),
            direction: new pc.Vec3(0, 1, 0),      // bottom to top
            duration: 1.0,
            visibleStart: false,
            visibleEnd: true,
            interval: 0.1,
            baseTint: new pc.Color(1, 1, 1),      // white (no base tint)
            edgeTint: new pc.Color(5, 5, 0),     // bright yellow
            tint: new pc.Color(1, 1, 1)           // white
        },
        roomHide: {
            aabbMin: new pc.Vec3(-50, -5, -50),
            aabbMax: new pc.Vec3(50, 5, 50),
            direction: new pc.Vec3(0, -1, 0),     // top to bottom
            duration: 1.0,
            visibleStart: true,
            visibleEnd: false,
            interval: 0.1,
            baseTint: new pc.Color(1, 1, 1),      // white (no base tint)
            edgeTint: new pc.Color(5, 5, 0),     // bright yellow
            tint: new pc.Color(1, 1, 1)           // white
        },
        roomTint: {
            aabbMin: new pc.Vec3(-50, -5, -50),
            aabbMax: new pc.Vec3(50, 5, 50),
            direction: new pc.Vec3(1, 0, 0),      // left to right
            duration: 2.0,
            visibleStart: true,
            visibleEnd: true,
            interval: 0.05,
            baseTint: new pc.Color(1, 1, 1),      // white (no base tint)
            edgeTint: new pc.Color(5, 5, 0),      // bright yellow
            tint: new pc.Color(0, 1, 1)           // cyan
        },
        roomUntint: {
            aabbMin: new pc.Vec3(-50, -5, -50),
            aabbMax: new pc.Vec3(50, 5, 50),
            direction: new pc.Vec3(-1, 0, 0),     // right to left (reverse of tint)
            duration: 2.0,
            visibleStart: true,
            visibleEnd: true,
            interval: 0.05,
            invertTint: true,                     // apply tint ahead instead of behind
            baseTint: new pc.Color(1, 1, 1),      // white (target/original state)
            edgeTint: new pc.Color(5, 5, 0),      // bright yellow
            tint: new pc.Color(0, 1, 1)           // cyan (applied ahead to preserve)
        }
    };

    // Default to enabled
    data.set('enabled', true);
    data.set('effect', 'hide');

    // Create hotel gsplat with unified set to true
    const hotel = new pc.Entity('hotel');
    hotel.addComponent('gsplat', {
        asset: assets.hotel,
        unified: true
    });
    hotel.setLocalEulerAngles(180, 0, 0);
    app.root.addChild(hotel);

    // Add script component to the hotel entity
    hotel.addComponent('script');

    // Helper function to create box script with configured attributes
    const createBoxScript = () => {
        const script = hotel.script?.create(GsplatBoxShaderEffect);
        return script;
    };

    // Helper function to apply effect configuration to script
    /**
     * @param {any} script - The box effect script instance
     * @param {any} config - The effect configuration object
     */
    const applyEffectConfig = (script, config) => {
        if (!script) return;

        script.aabbMin.copy(config.aabbMin);
        script.aabbMax.copy(config.aabbMax);
        script.direction.copy(config.direction);
        script.duration = config.duration;
        script.visibleStart = config.visibleStart;
        script.visibleEnd = config.visibleEnd;
        script.interval = config.interval;
        script.invertTint = config.invertTint || false;
        script.baseTint.copy(config.baseTint);
        script.edgeTint.copy(config.edgeTint);
        script.tint.copy(config.tint);
    };

    // Create the box effect script
    const boxScript = createBoxScript();

    // Apply initial configuration
    const initialEffect = data.get('effect');
    applyEffectConfig(boxScript, effectConfigs[/** @type {keyof typeof effectConfigs} */ (initialEffect)]);

    // Handle effect changes
    data.on('effect:set', () => {
        const effect = data.get('effect');
        const config = effectConfigs[/** @type {keyof typeof effectConfigs} */ (effect)];

        if (boxScript && config) {
            // Apply new configuration
            applyEffectConfig(boxScript, config);

            // Reset effectTime by disabling and re-enabling
            boxScript.enabled = false;
            boxScript.enabled = true;
        }
    });

    // Restart button - reset current effect
    data.on('restart', () => {
        if (boxScript) {
            boxScript.enabled = false;
            boxScript.enabled = true;
        }
    });

    // Prev button - cycle to previous effect
    data.on('prev', () => {
        const effects = ['hide', 'reveal', 'tint', 'untint', 'roomHide', 'roomReveal', 'roomTint', 'roomUntint'];
        const currentEffect = data.get('effect');
        const currentIndex = effects.indexOf(currentEffect);
        const prevIndex = (currentIndex - 1 + effects.length) % effects.length;
        data.set('effect', effects[prevIndex]);
    });

    // Next button - cycle to next effect
    data.on('next', () => {
        const effects = ['hide', 'reveal', 'tint', 'untint', 'roomHide', 'roomReveal', 'roomTint', 'roomUntint'];
        const currentEffect = data.get('effect');
        const currentIndex = effects.indexOf(currentEffect);
        const nextIndex = (currentIndex + 1) % effects.length;
        data.set('effect', effects[nextIndex]);
    });

    // Handle enable/disable toggle
    data.on('enabled:set', () => {
        const enabled = data.get('enabled');
        if (boxScript) {
            boxScript.enabled = enabled;
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

    // Setup bloom post-processing
    if (camera.camera) {
        const cameraFrame = new pc.CameraFrame(app, camera.camera);
        cameraFrame.rendering.samples = 4;
        cameraFrame.rendering.toneMapping = pc.TONEMAP_ACES;
        cameraFrame.bloom.intensity = 0.03;
        cameraFrame.bloom.blurLevel = 6;
        cameraFrame.update();
    }

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

export { app };

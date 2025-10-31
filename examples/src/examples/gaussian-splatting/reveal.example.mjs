// @config DESCRIPTION This example demonstrates reveal effects for gaussian splats.
import { data } from 'examples/observer';
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { GsplatRevealRadial } = await fileImport(`${rootPath}/static/scripts/esm/gsplat/reveal-radial.mjs`);
const { GsplatRevealRain } = await fileImport(`${rootPath}/static/scripts/esm/gsplat/reveal-rain.mjs`);
const { GsplatRevealGridEruption } = await fileImport(`${rootPath}/static/scripts/esm/gsplat/reveal-grid-eruption.mjs`);

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

    // Array of available effects (extensible for future effects)
    const effects = ['radial', 'rain', 'grid'];

    // Default to radial effect
    data.set('effect', 'radial');

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

    // Helper function to create radial script with configured attributes
    const createRadialScript = () => {
        const script = hotel.script?.create(GsplatRevealRadial);
        if (script) {
            script.center.set(0, 0, 0);
            script.speed = 5;
            script.acceleration = 0;
            script.delay = 3;
            script.dotTint.set(0, 1, 1); // Cyan
            script.waveTint.set(1, 0.5, 0); // Orange
            script.oscillationIntensity = 0.2;
            script.endRadius = 25;
        }
        return script;
    };

    // Helper function to create rain script with configured attributes
    const createRainScript = () => {
        const script = hotel.script?.create(GsplatRevealRain);
        if (script) {
            script.center.set(0, 0, 0);
            script.distance = 30;
            script.speed = 3;
            script.acceleration = 0;
            script.flightTime = 2;
            script.rainSize = 0.015;
            script.rotation = 0.9; // 90% of full circle rotation during fall
            script.fallTint.set(0, 1, 1); // Cyan tint during fall
            script.fallTintIntensity = 0.2;
            script.hitTint.set(2, 0, 0); // Bright red flash on landing
            script.hitDuration = 0.5;
            script.endRadius = 25;
        }
        return script;
    };

    // Helper function to create grid eruption script with configured attributes
    const createGridScript = () => {
        const script = hotel.script?.create(GsplatRevealGridEruption);
        if (script) {
            script.center.set(0, 0, 0);
            script.blockCount = 10;
            script.blockSize = 2;
            script.delay = 0.2;
            script.duration = 1.0;
            script.dotSize = 0.01;
            script.moveTint.set(1, 0, 1); // Magenta during movement
            script.moveTintIntensity = 0.2; // 20% blend with original color
            script.landTint.set(2, 2, 0); // Yellow flash on landing
            script.landDuration = 0.6;
            script.endRadius = 25;
        }
        return script;
    };

    /**
     * Function to create and start an effect based on its name
     * @param {string} effectName - Name of the effect to create
     */
    const createEffect = (effectName) => {
        // Destroy any existing reveal scripts
        hotel.script?.destroy(GsplatRevealRadial.scriptName);
        hotel.script?.destroy(GsplatRevealRain.scriptName);
        hotel.script?.destroy(GsplatRevealGridEruption.scriptName);

        // Create the selected effect (fresh instance, starts from beginning)
        if (effectName === 'radial') {
            createRadialScript();
        } else if (effectName === 'rain') {
            createRainScript();
        } else if (effectName === 'grid') {
            createGridScript();
        }
    };

    // Create only the radial script initially
    createEffect('radial');

    // Switch between effects when dropdown changes
    data.on('effect:set', () => {
        const effect = data.get('effect');
        createEffect(effect);
    });

    // Restart button - recreate current effect from beginning
    data.on('restart', () => {
        const currentEffect = data.get('effect');
        createEffect(currentEffect);
    });

    // Next button - cycle to next effect in the list
    data.on('next', () => {
        const currentEffect = data.get('effect');
        const currentIndex = effects.indexOf(currentEffect);
        const nextIndex = (currentIndex + 1) % effects.length;
        const nextEffect = effects[nextIndex];
        data.set('effect', nextEffect);
    });

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: pc.Color.BLACK,
        fov: 80,
        toneMapping: pc.TONEMAP_ACES
    });
    camera.setLocalPosition(3, 1, 0.5);

    // add orbit camera script with a mouse and a touch support
    camera.addComponent('script');
    camera.script?.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: hotel,
            distanceMax: 3.2,
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

export { app };

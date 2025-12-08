// @config DESCRIPTION This example demonstrates AABB-based cropping of gaussian splats with animated bounds.
import { data } from 'examples/observer';
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { GsplatCropShaderEffect } = await fileImport(`${rootPath}/static/scripts/esm/gsplat/shader-effect-crop.mjs`);

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
    hotel: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/hotel-culpture.compressed.ply` }),
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Default precise mode to true, paused to false, edge scale to 0.5
    data.set('precise', true);
    data.set('edgeScale', 0.5);
    let paused = false;

    // Handle pause/play toggle
    data.on('togglePause', () => {
        paused = !paused;
    });

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

    // Create the crop effect script
    const cropScript = hotel.script?.create(GsplatCropShaderEffect);

    // Set initial edge scale factor
    if (cropScript) {
        cropScript.edgeScaleFactor = data.get('edgeScale');
    }

    // Handle edge scale changes
    data.on('edgeScale:set', () => {
        if (cropScript) {
            cropScript.edgeScaleFactor = data.get('edgeScale');
        }
    });

    // Get the gsplat material
    const getMaterial = () => app.scene.gsplat?.material;

    // Set initial define state
    /**
     * @param {boolean} precise - Whether to enable precise cropping
     */
    const updatePreciseDefine = (precise) => {
        const material = getMaterial();
        if (material) {
            if (precise) {
                material.setDefine('GSPLAT_PRECISE_CROP', '');
            } else {
                material.defines.delete('GSPLAT_PRECISE_CROP');
            }
            material.update();
        }
    };

    // Wait for material to be available, then set initial state
    const checkMaterial = () => {
        const material = getMaterial();
        if (material) {
            updatePreciseDefine(data.get('precise'));
        } else {
            setTimeout(checkMaterial, 100);
        }
    };
    checkMaterial();

    // Handle precise toggle changes
    data.on('precise:set', () => {
        updatePreciseDefine(data.get('precise'));
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

    // Animate AABB size with soft bounce
    const period = 9.0; // seconds for one cycle
    const minSize = 0.4;
    const maxSize = 1.75;
    let elapsedTime = 0;

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

        // Animate AABB with soft bounce (sin-based easing)
        if (cropScript && !paused) {
            elapsedTime += dt;
            const t = (Math.sin(elapsedTime * Math.PI * 2 / period) + 1) / 2; // 0 to 1, soft bounce
            const size = minSize + t * (maxSize - minSize);
            const sizeXZ = size * 1.5; // 50% wider in X and Z directions
            cropScript.aabbMin.set(-sizeXZ, -size, -sizeXZ);
            cropScript.aabbMax.set(sizeXZ, size, sizeXZ);
        }
    });
});

export { app };

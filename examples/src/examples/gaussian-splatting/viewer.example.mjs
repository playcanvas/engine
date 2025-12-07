import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// Create HTML overlay for drop instructions
const dropOverlay = document.createElement('div');
dropOverlay.id = 'drop-overlay';
dropOverlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 1000;
`;

const dropBox = document.createElement('div');
dropBox.style.cssText = `
    background: rgba(0, 0, 0, 0.45);
    border: 2px dashed rgba(255, 255, 255, 0.6);
    border-radius: 16px;
    padding: 32px 48px;
    font-family: Arial, sans-serif;
    font-size: 24px;
    color: white;
`;
dropBox.textContent = 'Drop .ply or .sog file to view';
dropOverlay.appendChild(dropBox);
document.body.appendChild(dropOverlay);

const gfxOptions = {
    deviceTypes: [deviceType],
    // Disable antialiasing as CameraFrame handles it
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

// Load orbit camera script and HDRI
const assets = {
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    hdri: new pc.Asset(
        'hdri',
        'texture',
        { url: `${rootPath}/static/assets/hdri/wide-street.hdr` },
        { mipmaps: false }
    )
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    let splatEntity = null;

    // Create camera at startup so skydome is visible before dropping files
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        fov: 60,
        farClip: 1000
    });
    camera.setLocalPosition(0, 2, 5);
    app.root.addChild(camera);

    // Setup CameraFrame
    const cameraFrame = new pc.CameraFrame(app, camera.camera);
    cameraFrame.rendering.renderFormats = [
        pc.PIXELFORMAT_RGBA16F,
        pc.PIXELFORMAT_RGBA32F,
        pc.PIXELFORMAT_111110F
    ];
    cameraFrame.grading.enabled = true;

    // Setup skydome toggle function
    const applySkydome = () => {
        const enabled = data.get('data.skydome');
        if (enabled) {
            const hdriTexture = assets.hdri.resource;

            // Generate high resolution cubemap for skybox
            const skybox = pc.EnvLighting.generateSkyboxCubemap(hdriTexture);
            app.scene.skybox = skybox;

            // Generate env-atlas for lighting
            const lighting = pc.EnvLighting.generateLightingSource(hdriTexture);
            const envAtlas = pc.EnvLighting.generateAtlas(lighting);
            lighting.destroy();
            app.scene.envAtlas = envAtlas;
        } else {
            app.scene.skybox = null;
            app.scene.envAtlas = null;
        }
    };

    // Initialize data values
    data.set('data', {
        skydome: false,
        orientation: 180,
        tonemapping: pc.TONEMAP_LINEAR,
        grading: {
            exposure: 0,  // 0 EV = no change
            contrast: 1
        }
    });

    // Apply initial skydome setting
    applySkydome();

    // Apply settings function
    const applySettings = () => {
        cameraFrame.rendering.toneMapping = data.get('data.tonemapping');

        // Convert exposure EV (F-stops) to brightness multiplier
        // Each stop doubles or halves brightness: multiplier = 2^(EV)
        const exposureEV = data.get('data.grading.exposure');
        cameraFrame.grading.brightness = Math.pow(2, exposureEV);

        cameraFrame.grading.contrast = data.get('data.grading.contrast');
        cameraFrame.update();
    };

    // Apply initial settings
    applySettings();

    // Listen for changes
    data.on('*:set', (/** @type {string} */ path) => {
        if (path === 'data.skydome') {
            applySkydome();
        } else if (path === 'data.orientation') {
            // Apply orientation to splat entity
            if (splatEntity) {
                const orientation = data.get('data.orientation');
                splatEntity.setLocalEulerAngles(orientation, 0, 0);
            }
        } else {
            applySettings();
        }
    });

    // Setup drag and drop handlers
    canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    canvas.addEventListener('drop', async (e) => {
        e.preventDefault();

        const file = e.dataTransfer.files[0];
        if (!file) return;

        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.ply') && !fileName.endsWith('.sog')) {
            console.warn('Please drop a .ply or .sog file');
            return;
        }

        // Hide instructions overlay
        dropOverlay.style.display = 'none';

        // Create blob URL and load asset using loadFromUrlAndFilename
        // This method is specifically for blob assets where the URL doesn't identify the format
        const blobUrl = URL.createObjectURL(file);

        const asset = await new Promise((resolve, reject) => {
            app.assets.loadFromUrlAndFilename(blobUrl, file.name, 'gsplat', (err, loadedAsset) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(loadedAsset);
                }
            });
        });

        // Create gsplat entity
        const entity = new pc.Entity(file.name);
        entity.addComponent('gsplat', {
            asset: asset,
            unified: true
        });
        entity.setLocalEulerAngles(180, 0, 0);
        app.root.addChild(entity);

        // Store reference for orientation updates
        splatEntity = entity;

        // Wait a frame for customAabb to be available
        await new Promise((resolve) => {
            requestAnimationFrame(resolve);
        });

        // Get bounds for framing
        const aabb = entity.gsplat.customAabb;
        if (!aabb) {
            console.warn('customAabb not available');
            return;
        }

        const center = aabb.center;
        const size = aabb.halfExtents.length() * 2;
        const cameraDistance = size * 2.5;

        // Update camera for the loaded splat
        camera.camera.farClip = size * 10;
        camera.setLocalPosition(
            center.x,
            center.y + size * 0.3,
            center.z + cameraDistance
        );

        // Add orbit camera script
        camera.addComponent('script');
        camera.script.create('orbitCamera', {
            attributes: {
                inertiaFactor: 0.2,
                focusEntity: entity,
                distanceMax: size * 5,
                frameOnStart: true
            }
        });
        camera.script.create('orbitCameraInputMouse');
        camera.script.create('orbitCameraInputTouch');
    });
});

export { app };

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
    LAYERID_DEPTH,
    Layer,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    TEXTURETYPE_RGBP,
    TONEMAP_NEUTRAL,
    TextureHandler,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { BlurredPlanarReflection } from 'playcanvas/scripts/esm/blurred-planar-reflection.mjs';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    envatlas: new Asset(
        'morning-env-atlas',
        'texture',
        { url: './assets/cubemaps/morning-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    sunglasses: new Asset('sunglasses', 'container', { url: './assets/models/SunglassesKhronos.glb' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, ScriptComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

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

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Set up environment atlas for lighting
app.scene.envAtlas = assets.envatlas.resource;
app.scene.skyboxIntensity = 2;

// Get existing layers
const worldLayer = app.scene.layers.getLayerByName('World');
const uiLayer = app.scene.layers.getLayerByName('UI');
const depthLayer = app.scene.layers.getLayerById(LAYERID_DEPTH);

// Create a layer for the reflection plane (excluded from reflection rendering)
// Layer order needed: World(opaque) -> Excluded(opaque) -> Depth -> World(transp) -> Excluded(transp)
const excludedLayer = new Layer({ name: 'Excluded' });
app.scene.layers.insertOpaque(excludedLayer, app.scene.layers.getOpaqueIndex(worldLayer) + 1);
app.scene.layers.insertTransparent(excludedLayer, app.scene.layers.getTransparentIndex(worldLayer) + 1);

// Create main camera - include depth layer for scene color map to work
const camera = new Entity('MainCamera');
camera.addComponent('camera', {
    fov: 60,
    nearClip: 0.01,
    layers: [worldLayer.id, excludedLayer.id, depthLayer.id, uiLayer.id],
    toneMapping: TONEMAP_NEUTRAL,
    clearColor: new Color(1, 1, 1, 1)
});
camera.addComponent('script');
camera.setLocalPosition(-0.2, 0.1, 0.2);
app.root.addChild(camera);

// Enable scene color map for materials with refraction/transmission (sunglasses model uses this feature)
camera.camera.requestSceneColorMap(true);

// Add camera controls for orbit interaction
/** @type {CameraControls} */
const cameraControls = camera.script.create(CameraControls);
cameraControls.focusPoint = new Vec3(0, 0.02, 0);
cameraControls.enableFly = false; // Only orbit mode
cameraControls.pitchRange = new Vec2(-85, -4); // Limit pitch to keep camera above ground
cameraControls.zoomRange = new Vec2(0.1, 1.0); // Limit zoom distance

// Get the instance of the sunglasses model
const sunglassesEntity = assets.sunglasses.resource.instantiateRenderEntity();
app.root.addChild(sunglassesEntity);

// Create the reflective ground plane with the BlurredPlanarReflection script
const groundReflector = new Entity('GroundReflector');
groundReflector.addComponent('render', {
    type: 'plane',
    layers: [excludedLayer.id],
    castShadows: false
});
groundReflector.setLocalScale(4, 1, 4);

// Add the blurred planar reflection script
groundReflector.addComponent('script');
/** @type {BlurredPlanarReflection} */
const reflectionScript = groundReflector.script.create(BlurredPlanarReflection);

// Set properties directly
reflectionScript.mainCamera = camera;
reflectionScript.resolution = 1.0;
reflectionScript.blurAmount = 0.5;
reflectionScript.intensity = 1.0;
reflectionScript.fadeStrength = 0.8;
reflectionScript.angleFade = 0.5;
reflectionScript.heightRange = 0.07;
reflectionScript.fadeColor = new Color(1, 1, 1, 1);

app.root.addChild(groundReflector);

// Apply settings from observer data
const applySettings = () => {
    reflectionScript.resolution = data.get('data.resolution');
    reflectionScript.blurAmount = data.get('data.blurAmount');
    reflectionScript.intensity = data.get('data.intensity');
    reflectionScript.fadeStrength = data.get('data.fadeStrength');
    reflectionScript.angleFade = data.get('data.angleFade');
    reflectionScript.heightRange = data.get('data.heightRange');
};

// Listen for UI changes
data.on('*:set', () => {
    applySettings();
});

// Set initial data values
data.set('data', {
    resolution: 1.0,
    blurAmount: 0.5,
    intensity: 1.0,
    fadeStrength: 0.8,
    angleFade: 0.5,
    heightRange: 0.07
});

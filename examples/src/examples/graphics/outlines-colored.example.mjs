// @config
//
// @credit
// title: Laboratory
// author: Sketchfab
// source: https://sketchfab.com/3d-models/laboratory-e860e49837c044478db650868866a448
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_NONE,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    DepthState,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    Mouse,
    OutlineRenderer,
    PIXELFORMAT_RGBA16F,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SSAOTYPE_LIGHTING,
    SSAOTYPE_NONE,
    ScriptComponentSystem,
    ScriptHandler,
    TEXTURETYPE_RGBP,
    TONEMAP_NEUTRAL,
    TextureHandler,
    TouchDevice,
    WasmModule,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// Set up and load draco module, as the glb we load is draco compressed
WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

const assets = {
    laboratory: new Asset('statue', 'container', { url: './assets/models/laboratory.glb' }),
    orbit: new Asset('orbit', 'script', { url: './scripts/camera/orbit-camera.js' }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [ScriptHandler, TextureHandler, ContainerHandler];

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

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Setup skydome
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 2;
app.scene.exposure = 2.5;

// Get the instance of the laboratory
const laboratoryEntity = assets.laboratory.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
laboratoryEntity.setLocalScale(100, 100, 100);
app.root.addChild(laboratoryEntity);

// Set up materials
laboratoryEntity.findComponents('render').forEach((render) => {
    render.meshInstances.forEach((meshInstance) => {
        // Disable blending / enable depth writes
        meshInstance.material.depthState = DepthState.DEFAULT;
        meshInstance.material.blendType = BLEND_NONE;

        // Disable baked AO map as we want to use SSAO only
        meshInstance.material.aoMap = null;
        meshInstance.material.update();
    });
});

// Create a directional light casting shadows, which also lights the volumetric fog. It is low behind
// the laboratory, shining towards the camera, so the walls cast shafts of light through the fog.
const light = new Entity('DirectionalLight');
light.addComponent('light', {
    type: 'directional',
    intensity: 1,
    castShadows: true,
    shadowResolution: 4096,
    shadowBias: 0.4,
    normalOffsetBias: 0.06,
    shadowDistance: 600
});
app.root.addChild(light);
light.setLocalEulerAngles(70, 135, 0);

// Create an Entity with a camera component
const cameraEntity = new Entity('SceneCamera');
cameraEntity.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5),
    nearClip: 1,
    farClip: 600,

    // the tone mapping used when the camera frame is disabled, matching the camera frame's
    toneMapping: TONEMAP_NEUTRAL
});

// Add orbit camera script
cameraEntity.addComponent('script');
cameraEntity.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: laboratoryEntity,
        distanceMax: 300
    }
});
cameraEntity.script.create('orbitCameraInputMouse');
cameraEntity.script.create('orbitCameraInputTouch');

// Position the camera in the world
cameraEntity.setLocalPosition(-60, 30, 60);
app.root.addChild(cameraEntity);

// Set up the camera frame rendering, using the settings of the ambient occlusion example
const cameraFrame = new CameraFrame(app, cameraEntity.camera);
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;

// Use 16-bit render target for better precision, and MSAA
cameraFrame.rendering.renderFormats = [PIXELFORMAT_RGBA16F];
cameraFrame.rendering.samples = 4;

cameraFrame.ssao.blurEnabled = true;
cameraFrame.ssao.radius = 30;
cameraFrame.ssao.samples = 12;
cameraFrame.ssao.intensity = 0.4;
cameraFrame.ssao.power = 6;
cameraFrame.ssao.minAngle = 10;
cameraFrame.ssao.scale = 1;
cameraFrame.ssao.randomize = false;

// Volumetric fog lit by the directional light, denser near the floor of the laboratory. A low
// ambient term keeps the fog in the shadows dark, for a strong contrast with the shafts of light.
cameraFrame.volumetricFog.light = light.light;
cameraFrame.volumetricFog.tint.set(1, 0.92, 0.8);
cameraFrame.volumetricFog.density = 0.01;
cameraFrame.volumetricFog.heightBase = -30;
cameraFrame.volumetricFog.heightFalloff = 0.05;
cameraFrame.volumetricFog.ambientIntensity = 0.005;
cameraFrame.volumetricFog.maxDistance = 600;

// without TAA to resolve the noise of the raymarch, more steps keep it low
cameraFrame.volumetricFog.steps = 32;

const applySettings = () => {
    const ssao = data.get('data.ssao');
    const volumetricFog = data.get('data.volumetricFog');
    cameraFrame.ssao.type = ssao ? SSAOTYPE_LIGHTING : SSAOTYPE_NONE;
    cameraFrame.volumetricFog.enabled = volumetricFog;

    // with neither effect enabled, the camera frame is removed from the camera, which then renders
    // the scene directly
    cameraFrame.enabled = ssao || volumetricFog;
    cameraFrame.update();
};

// Initial settings
data.set('data', {
    ssao: true,
    volumetricFog: false
});

// Apply UI changes. This is registered after the initial values are set, as setting them fires an
// event for each value while the remaining values are still undefined.
data.on('*:set', () => {
    applySettings();
});
applySettings();

// Create the outline renderer
const outlineRenderer = new OutlineRenderer(app);

// Add entities to the outline renderer
outlineRenderer.addEntity(laboratoryEntity.findByName('Weltkugel'), Color.RED);
outlineRenderer.addEntity(laboratoryEntity.findByName('Stuhl'), Color.WHITE);
outlineRenderer.addEntity(laboratoryEntity.findByName('Teleskop'), Color.GREEN);

// The camera frame renders the UI layer after the post-processing. Compositing the outlines before
// it keeps them unaffected by the tone mapping and the volumetric fog. Without the camera frame, the
// UI layer is still rendered last.
const uiLayer = app.scene.layers.getLayerByName('UI');

app.on('update', (/** @type {number} */ _dt) => {
    // Update the outline renderer each frame, and render the outlines before the transparent
    // sub-layer of the UI layer, which is the only one it has
    outlineRenderer.frameUpdate(cameraEntity, uiLayer, true);
});

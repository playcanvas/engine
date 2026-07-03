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
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    Mouse,
    OutlineRenderer,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    TEXTURETYPE_RGBP,
    TextureHandler,
    TouchDevice,
    WasmModule,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

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
const laboratoryEntity = assets.laboratory.resource.instantiateRenderEntity();
laboratoryEntity.setLocalScale(100, 100, 100);
app.root.addChild(laboratoryEntity);

// Create an Entity with a camera component
const cameraEntity = new Entity('SceneCamera');
cameraEntity.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5),
    nearClip: 1,
    farClip: 600
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

// Create the outline renderer
const outlineRenderer = new OutlineRenderer(app);

// Add entities to the outline renderer
outlineRenderer.addEntity(laboratoryEntity.findByName('Weltkugel'), Color.RED);
outlineRenderer.addEntity(laboratoryEntity.findByName('Stuhl'), Color.WHITE);
outlineRenderer.addEntity(laboratoryEntity.findByName('Teleskop'), Color.GREEN);

app.on('update', (/** @type {number} */ _dt) => {
    // Update the outline renderer each frame, and render the outlines inside the opaque sub-layer
    // Of the immediate layer
    const immediateLayer = app.scene.layers.getLayerByName('Immediate');
    outlineRenderer.frameUpdate(cameraEntity, immediateLayer, false);
});

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
    Vec2,
    Vec3,
    WasmModule,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

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

// Position the camera in the world
cameraEntity.setLocalPosition(-200, 100, 200);
cameraEntity.addComponent('script');
app.root.addChild(cameraEntity);

// Add camera controls
cameraEntity.script.create(CameraControls, {
    properties: {
        focusPoint: new Vec3(0, 0, 0),
        enableFly: false,
        zoomRange: new Vec2(0.01, 300)
    }
});

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

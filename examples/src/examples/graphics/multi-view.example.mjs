// @config
//
// @credit
// title: Chess Board
// author: Idmental
// source: https://sketchfab.com/3d-models/chess-board-901eeeca884f4622ac37b7e8f7cb82c3
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

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
    Layer,
    LightComponentSystem,
    Mouse,
    PROJECTION_ORTHOGRAPHIC,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADERPASS_FORWARD,
    ScriptComponentSystem,
    ScriptHandler,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec3,
    Vec4,
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

await new Promise(resolve => {
    WasmModule.getInstance('DracoDecoderModule', () => resolve());
});

const assets = {
    script: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    board: new Asset('statue', 'container', { url: './assets/models/chess-board.glb' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

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
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler];

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

data.set('settings', {
    shaderPassName: SHADERPASS_FORWARD
});

// Get few existing layers and create a new layer for the spot light
const worldLayer = app.scene.layers.getLayerByName('World');
const skyboxLayer = app.scene.layers.getLayerByName('Skybox');
const spotLightLayer = new Layer({ name: 'SpotLightLayer' });
app.scene.layers.insert(spotLightLayer, 0);

// Get the instance of the chess board and set up with render component
const boardEntity = assets.board.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true,

    // Add it to both layers with lights, as we want it to lit by directional light and spot light,
    // depending on the camera
    layers: [worldLayer.id, spotLightLayer.id]
});
app.root.addChild(boardEntity);

// Create left camera, using default layers (including the World)
const cameraLeft = new Entity('LeftCamera');
cameraLeft.addComponent('camera', {
    farClip: 500,
    rect: new Vec4(0, 0, 0.5, 0.5),
    toneMapping: TONEMAP_ACES
});
app.root.addChild(cameraLeft);

// Create right orthographic camera, using spot light layer and skybox layer,
// so that it receives the light from the spot light but not from the directional light
const cameraRight = new Entity('RightCamera');
cameraRight.addComponent('camera', {
    layers: [spotLightLayer.id, skyboxLayer.id],
    farClip: 500,
    rect: new Vec4(0.5, 0, 0.5, 0.5),
    projection: PROJECTION_ORTHOGRAPHIC,
    orthoHeight: 150,
    toneMapping: TONEMAP_ACES
});
cameraRight.translate(0, 150, 0);
cameraRight.lookAt(Vec3.ZERO, Vec3.RIGHT);
app.root.addChild(cameraRight);

// Create top camera, using default layers (including the World)
const cameraTop = new Entity('TopCamera');
cameraTop.addComponent('camera', {
    farClip: 500,
    rect: new Vec4(0, 0.5, 1, 0.5),
    toneMapping: TONEMAP_ACES
});
cameraTop.translate(-100, 75, 100);
cameraTop.lookAt(0, 7, 0);
app.root.addChild(cameraTop);

// Add orbit camera script with a mouse and a touch support
cameraTop.addComponent('script');
cameraTop.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: app.root,
        distanceMax: 300,
        frameOnStart: false
    }
});
cameraTop.script.create('orbitCameraInputMouse');
cameraTop.script.create('orbitCameraInputTouch');

// Create a directional light which casts shadows
const dirLight = new Entity();
dirLight.addComponent('light', {
    type: 'directional',
    layers: [worldLayer.id],
    color: Color.WHITE,
    intensity: 5,
    range: 500,
    shadowDistance: 500,
    castShadows: true,
    shadowBias: 0.2,
    normalOffsetBias: 0.05
});
app.root.addChild(dirLight);
dirLight.setLocalEulerAngles(45, 0, 30);

// Create a single directional light which casts shadows
const spotLight = new Entity();
spotLight.addComponent('light', {
    type: 'spot',
    layers: [spotLightLayer.id],
    color: Color.YELLOW,
    intensity: 7,
    innerConeAngle: 20,
    outerConeAngle: 80,
    range: 200,
    shadowDistance: 200,
    castShadows: true,
    shadowBias: 0.2,
    normalOffsetBias: 0.05
});
app.root.addChild(spotLight);

// Set skybox - this DDS file was 'prefiltered' in the PlayCanvas Editor and then downloaded.
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 1;

// Handle HUD changes - update the debug mode for the top and right cameras
data.on('*:set', (/** @type {string} */ path, value) => {
    cameraTop.camera.setShaderPass(value);
    cameraRight.camera.setShaderPass(value);
});

// Update function called once per frame
let time = 0;
app.on('update', dt => {
    time += dt;

    // Orbit camera left around
    cameraLeft.setLocalPosition(100 * Math.sin(time * 0.2), 35, 100 * Math.cos(time * 0.2));
    cameraLeft.lookAt(Vec3.ZERO);

    // Move the spot light around
    spotLight.setLocalPosition(40 * Math.sin(time * 0.5), 60, 40 * Math.cos(time * 0.5));

    // Zoom in and out the orthographic camera
    cameraRight.camera.orthoHeight = 90 + Math.sin(time * 0.3) * 60;
});

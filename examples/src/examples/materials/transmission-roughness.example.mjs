// @config
//
// This example demonstrates the interaction between roughness and IOR in transmissive materials.
// Higher IOR values cause more blurriness in transmission as roughness increases, while IOR=1.0
// produces sharp transmission regardless of roughness.

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
    Keyboard,
    LightComponentSystem,
    Mouse,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/table-mountain-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    model: new Asset('model', 'container', { url: './assets/models/TransmissionRoughnessTest.glb' })
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
createOptions.keyboard = new Keyboard(document.body);

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

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Setup skydome - the environment is important for seeing transmission effects
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxRotation = new Quat().setFromEulerAngles(0, 70, 0);
app.scene.skyboxIntensity = 1.5;

// Instantiate the transmission roughness test model
// This model shows a grid of transmissive tiles with:
// - Increasing roughness along the horizontal axis
// - Increasing IOR along the vertical axis
const modelEntity = assets.model.resource.instantiateRenderEntity();
modelEntity.setLocalEulerAngles(0, 90, 0);
modelEntity.setPosition(0, 0, 0);
modelEntity.setLocalScale(1, 1, 1);
app.root.addChild(modelEntity);

// Create a camera with camera controls, viewing from the side (yaw 90) at a distance of 2
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.1),
    toneMapping: TONEMAP_ACES
});

// The color grab pass is needed for transmission effects
camera.camera.requestSceneColorMap(true);

camera.setLocalPosition(2, 0, 0);
camera.addComponent('script');
app.root.addChild(camera);
camera.script.create(CameraControls, {
    properties: {
        focusPoint: new Vec3(0, 0, 0),
        enableFly: false
    }
});

// Add a directional light
const directionalLight = new Entity();
directionalLight.addComponent('light', {
    type: 'directional',
    color: Color.WHITE,
    castShadows: false,
    intensity: 1
});
directionalLight.setEulerAngles(45, 180, 0);
app.root.addChild(directionalLight);

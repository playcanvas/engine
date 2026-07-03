// @config
//
// This example demonstrates anisotropy strength. Visually, the model showcases the effect of
// anisotropic highlights based on material properties.

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
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbitCamera: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/morning-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    model: new Asset('model', 'container', { url: './assets/models/AnisotropyStrengthTest.glb' })
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

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Setup skydome
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxRotation = new Quat().setFromEulerAngles(0, 70, 0);
app.scene.skyboxIntensity = 0.5;

const leftEntity = assets.model.resource.instantiateRenderEntity();
leftEntity.setLocalEulerAngles(40, 90, 0);
leftEntity.setPosition(0, 0, 1);
leftEntity.setLocalScale(0.8, 0.8, 0.8);
app.root.addChild(leftEntity);

// Create a camera with an orbit camera script
const camera = new Entity();
camera.addComponent('camera', {
    toneMapping: TONEMAP_ACES
});
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);
camera.script.orbitCamera.yaw = 90;
camera.script.orbitCamera.distance = 12;

const directionalLight = new Entity();
directionalLight.addComponent('light', {
    type: 'directional',
    color: Color.YELLOW,
    castShadows: false,
    intensity: 1
});
directionalLight.setEulerAngles(45, 180, 0);
app.root.addChild(directionalLight);

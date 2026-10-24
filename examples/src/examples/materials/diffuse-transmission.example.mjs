// @config
//
// Diffuse transmission lets light pass through a thin surface, such as a leaf, a sheet of paper
// or a lampshade, which then glows when lit from behind. This is the test model of the
// [KHR_materials_diffuse_transmission](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_diffuse_transmission)
// glTF extension. Its directional light shines towards the camera, so each square is seen from
// the side facing away from the light. The columns increase `diffuseTransmission` from 0 to 1.
// The first row transmits white light, the second tints it with `diffuseTransmissionColor`, the
// third masks it with the stripes of `diffuseTransmissionMap`, and the fourth colors it with
// `diffuseTransmissionColorMap`.
//
// @credit
// title: Diffuse Transmission Test
// author: Eric Chadwick / Darmstadt Graphics Group GmbH
// source: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/DiffuseTransmissionTest
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
    Keyboard,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    TEXTURETYPE_RGBP,
    TONEMAP_NEUTRAL,
    TextureHandler,
    TouchDevice,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbitCamera: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    envAtlas: new Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/table-mountain-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    model: new Asset('model', 'container', { url: './assets/models/DiffuseTransmissionTest.glb' })
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

// The environment lights the side of the squares facing the camera, showing their base color
app.scene.envAtlas = assets.envAtlas.resource;
app.scene.skyboxMip = 1;

// Instantiate the test model. The lights of a glb are imported disabled, so enable the
// directional light of the model, which shines towards the camera
const modelEntity = assets.model.resource.instantiateRenderEntity();
modelEntity.findComponents('light').forEach((light) => {
    light.enabled = true;
});
app.root.addChild(modelEntity);

// Create a camera with an orbit camera script, framing the model
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.1),
    toneMapping: TONEMAP_NEUTRAL
});
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: modelEntity
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);

// Look at the model straight from the front, closer than the framing of its bounds
const orbitCamera = camera.script.orbitCamera;
orbitCamera.reset(0, 0, orbitCamera.distance * 0.6);

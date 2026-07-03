// @config
//
// This example loads the Khronos SpecularTest grid to visually verify the glTF KHR_materials_specular
// extension. Rows 1/2, 3/4 and 5/6 should each look identical (factor-only vs. texture-only with
// matching factor), and the last sphere on row 7 should look like a mirror ball.
//
// @flag HIDDEN
//
// @credit
// title: Specular Test
// author: Ed Mackey / Analytical Graphics, Inc.
// source: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SpecularTest
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
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    model: new Asset('model', 'container', { url: './assets/models/SpecularTest.glb' })
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

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// IBL is required to see the dielectric F0 changes that the extension controls
app.scene.envAtlas = assets.helipad.resource;
app.scene.exposure = 10;

const testEntity = assets.model.resource.instantiateRenderEntity();
app.root.addChild(testEntity);

const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.1),
    toneMapping: TONEMAP_ACES
});
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: testEntity
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);
camera.script.orbitCamera.pitch = 0;
camera.script.orbitCamera.yaw = 0;

const directionalLight = new Entity();
directionalLight.addComponent('light', {
    type: 'directional',
    color: Color.WHITE,
    castShadows: false,
    intensity: 1
});
directionalLight.setEulerAngles(45, 180, 0);
app.root.addChild(directionalLight);

// @config
//
// @flag HIDDEN
//
// @credit
// title: Yokohama cubemap
// author: Emil Persson
// source: https://github.com/KhronosGroup/KTX-Software/blob/main/tests/resources/ktx2/cubemap_yokohama_blze.ktx2
// license: CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    Mesh,
    MeshInstance,
    Mouse,
    RenderComponentSystem,
    RESOLUTION_AUTO,
    ScriptComponentSystem,
    ScriptHandler,
    SphereGeometry,
    StandardMaterial,
    TextureHandler,
    TouchDevice,
    TONEMAP_ACES,
    basisInitialize,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

basisInitialize({
    glueUrl: './assets/wasm/basis/basis.wasm.js',
    wasmUrl: './assets/wasm/basis/basis.wasm.wasm',
    fallbackUrl: './assets/wasm/basis/basis.js'
});

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType]
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const assets = {
    cubemap: new Asset(
        'yokohama-cubemap',
        'texture',
        { url: './assets/cubemaps/yokohama-cubemap.ktx2' },
        { srgb: true }
    ),
    orbit: new Asset('orbit-camera', 'script', { url: './scripts/camera/orbit-camera.js' })
};

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, ScriptComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ScriptHandler];

const app = new AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(() => {
        resolve();
    });
});

app.scene.skybox = assets.cubemap.resource;
app.scene.skyboxMip = 0;

const material = new StandardMaterial();
material.useMetalness = true;
material.metalness = 1;
material.gloss = 0.9;
material.diffuse = new Color(0.8, 0.8, 0.8);
material.update();

const mesh = Mesh.fromGeometry(
    device,
    new SphereGeometry({
        radius: 0.75,
        latitudeBands: 64,
        longitudeBands: 64
    })
);
const sphere = new Entity();
sphere.addComponent('render', {
    meshInstances: [new MeshInstance(mesh, material)]
});
app.root.addChild(sphere);

const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.05, 0.05, 0.05),
    toneMapping: TONEMAP_ACES
});
camera.setPosition(0, 0, 3);
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        focusEntity: sphere,
        frameOnStart: false,
        inertiaFactor: 0.2
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);

app.start();

export { app };

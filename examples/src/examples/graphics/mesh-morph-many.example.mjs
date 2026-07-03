// @config
//
// @credit
// title: MorphStressTest
// author: Ed Mackey
// source: https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/2.0/MorphStressTest/README.md
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    Keyboard,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    TEXTURETYPE_RGBP,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    morph: new Asset('glb', 'container', { url: './assets/models/morph-stress-test.glb' })
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

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
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

// Setup skydome
app.scene.skyboxMip = 2;
app.scene.exposure = 1.2;
app.scene.envAtlas = assets.helipad.resource;

// Create an instance of the morph target model
const morphEntity = assets.morph.resource.instantiateRenderEntity();
app.root.addChild(morphEntity);

// Get the morph instance, which we apply the weights to
const morphInstance = morphEntity.render.meshInstances[1].morphInstance;

// Create an entity with a directional light component
const light = new Entity();
light.addComponent('light', {
    type: 'directional',
    castShadows: true,
    shadowBias: 0.5,
    normalOffsetBias: 0.2,
    shadowDistance: 25
});
app.root.addChild(light);
light.setLocalEulerAngles(45, 45, 0);

// Create an entity with a camera component
const camera = new Entity();
camera.addComponent('camera');
app.root.addChild(camera);

// position the camera
camera.setLocalPosition(0, 4, 9);
camera.lookAt(Vec3.ZERO);

// update function called once per frame
let time = 0;
app.on('update', dt => {
    time += dt;

    // modify weights of all morph targets along sin curve
    const targetsCount = morphInstance.morph.targets.length;
    for (let i = 0; i < targetsCount; i++) {
        morphInstance.setWeight(i, Math.abs(Math.sin(time + i * 0.4)));
    }
});

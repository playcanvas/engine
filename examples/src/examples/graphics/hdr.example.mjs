// @config
//
// @credit
// title: Mirror's Edge Apartment - Interior Scene
// author: Aurélien Martel
// source: https://sketchfab.com/3d-models/mirrors-edge-apartment-interior-scene-9804e9f2fe284070b081c96ceaf8af96
// license: CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/)
//
// @credit
// title: Love neon sign 02
// author: daysena
// source: https://sketchfab.com/3d-models/love-neon-sign-02-9add8bfcb25943d0aae87e0af07c8e4d
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    ButtonComponentSystem,
    CameraComponentSystem,
    CameraFrame,
    ContainerHandler,
    ElementComponentSystem,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    Keyboard,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SCALEMODE_BLEND,
    ScreenComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec2,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    apartment: new Asset('apartment', 'container', { url: './assets/models/apartment.glb' }),
    love: new Asset('love', 'container', { url: './assets/models/love.glb' }),
    colors: new Asset('colors', 'texture', { url: './assets/textures/colors.webp' }, { srgb: true }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    colorLut: new Asset(
        'colorLut',
        'texture',
        { url: './assets/cube-luts/lut-blue.png' },
        {
            srgb: true,
            mipmaps: false,
            minfilter: 'linear'
        }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType],

    // The scene is rendered to an antialiased texture, so we disable antialiasing on the canvas
    // to avoid the additional cost. This is only used for the UI which renders on top of the
    // post-processed scene, and we're typically happy with some aliasing on the UI.
    antialias: false
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.keyboard = new Keyboard(window);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    ScreenComponentSystem,
    ButtonComponentSystem,
    ElementComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, FontHandler];

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

// Setup skydome with low intensity
app.scene.envAtlas = assets.helipad.resource;
app.scene.exposure = 1.2;

// Create an instance of the apartment and add it to the scene
const platformEntity = assets.apartment.resource.instantiateRenderEntity();
platformEntity.setLocalScale(30, 30, 30);
app.root.addChild(platformEntity);

// Load a love sign model and add it to the scene
const loveEntity = assets.love.resource.instantiateRenderEntity();
loveEntity.setLocalPosition(-80, 30, -20);
loveEntity.setLocalScale(130, 130, 130);
loveEntity.rotate(0, -90, 0);
app.root.addChild(loveEntity);

// Make the love sign emissive to bloom
const loveMaterial = loveEntity.findByName('s.0009_Standard_FF00BB_0').render.meshInstances[0].material;
loveMaterial.emissiveIntensity = 200;
loveMaterial.update();

// Adjust all materials of the love sign to disable dynamic refraction
loveEntity.findComponents('render').forEach(render => {
    render.meshInstances.forEach(meshInstance => {
        meshInstance.material.useDynamicRefraction = false;
    });
});

// Create an Entity with a camera component
const cameraEntity = new Entity();
cameraEntity.addComponent('camera', {
    farClip: 1500,
    fov: 80
});

const focusPoint = new Entity();
focusPoint.setLocalPosition(-80, 80, -20);

// Add orbit camera script with a mouse and a touch support
cameraEntity.addComponent('script');
cameraEntity.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: focusPoint,
        distanceMax: 500,
        frameOnStart: false
    }
});
cameraEntity.script.create('orbitCameraInputMouse');
cameraEntity.script.create('orbitCameraInputTouch');

cameraEntity.setLocalPosition(-50, 100, 220);
cameraEntity.lookAt(0, 0, 100);
app.root.addChild(cameraEntity);

// Create a 2D screen
const screen = new Entity();
screen.addComponent('screen', {
    referenceResolution: new Vec2(1280, 720),
    scaleBlend: 0.5,
    scaleMode: SCALEMODE_BLEND,
    screenSpace: true
});
app.root.addChild(screen);

// Create a new entity for the UI element
const uiElement = new Entity();

// Add a UI component with an image type
const texture = assets.colors.resource;
uiElement.addComponent('element', {
    type: 'image',
    anchor: [1, 0, 1, 0],
    pivot: [1, 0],
    width: texture.width * 0.5,
    height: texture.height * 0.5,
    texture: texture
});
uiElement.setLocalPosition(-0.1 * texture.width, 0.1 * texture.height, 0);
screen.addChild(uiElement);

// ------ Custom render passes set up ------

const cameraFrame = new CameraFrame(app, cameraEntity.camera);
cameraFrame.rendering.samples = 4;
cameraFrame.bloom.intensity = 0.03;
cameraFrame.bloom.blurLevel = 7;
cameraFrame.vignette.inner = 0.5;
cameraFrame.vignette.outer = 1;
cameraFrame.vignette.curvature = 0.5;
cameraFrame.vignette.intensity = 0.5;

// Apply Color LUT
cameraFrame.colorLUT.texture = assets.colorLut.resource;
cameraFrame.colorLUT.intensity = 1.0;

cameraFrame.update();

// Apply UI changes
data.on('*:set', (/** @type {string} */ path, value) => {
    if (path === 'data.hdr') {
        cameraFrame.enabled = value;
        cameraFrame.update();
    }

    if (path === 'data.sceneTonemapping') {
        // postprocessing tone mapping
        cameraFrame.rendering.toneMapping = value;
        cameraFrame.update();
    }

    if (path === 'data.colorLutIntensity') {
        cameraFrame.colorLUT.intensity = value;
        cameraFrame.update();
    }
});

// Set initial values
data.set('data', {
    hdr: true,
    sceneTonemapping: TONEMAP_ACES,
    colorLutIntensity: 1.0
});

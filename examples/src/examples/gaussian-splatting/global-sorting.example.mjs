// @config
//
// This example demonstrates global gsplat sorting, where individual gaussian splats across
// multiple components are consistently sorted in a single order, rather than per component.

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
    GSPLAT_RENDERER_AUTO,
    GSplatComponentSystem,
    GSplatHandler,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // Disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
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
    ScriptComponentSystem,
    GSplatComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, GSplatHandler];

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

const assets = {
    hotel: new Asset('gsplat', 'gsplat', { url: './assets/splats/hotel-culpture.compressed.ply' }),
    biker: new Asset('gsplat', 'gsplat', { url: './assets/splats/biker.compressed.ply' }),
    guitar: new Asset('gsplat', 'gsplat', { url: './assets/splats/guitar.compressed.ply' }),
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' })
};

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

data.on('renderer:set', () => {
    app.scene.gsplat.renderer = data.get('renderer');
    const current = app.scene.gsplat.currentRenderer;
    if (current !== data.get('renderer')) {
        setTimeout(() => data.set('renderer', current), 0);
    }
});

data.set('renderer', GSPLAT_RENDERER_AUTO);

// Instantiate garage gsplat
const hotel = new Entity('garage');
hotel.addComponent('gsplat', {
    asset: assets.hotel
});
hotel.setLocalEulerAngles(180, 0, 0);
app.root.addChild(hotel);

// Create biker1
const biker1 = new Entity('biker1');
biker1.addComponent('gsplat', {
    asset: assets.biker
});
biker1.setLocalPosition(0, -1.8, -2);
biker1.setLocalEulerAngles(180, 90, 0);
app.root.addChild(biker1);

// Clone the biker and add the clone to the scene
const biker2 = biker1.clone();
biker2.setLocalPosition(0, -1.8, 2);
biker2.rotate(0, 150, 0);
app.root.addChild(biker2);

// Create guitar
const guitar = new Entity('guitar');
guitar.addComponent('gsplat', {
    asset: assets.guitar
});
guitar.setLocalPosition(2, -1.8, -0.5);
guitar.setLocalEulerAngles(0, 0, 180);
guitar.setLocalScale(0.7, 0.7, 0.7);
app.root.addChild(guitar);

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: Color.BLACK,
    fov: 80,
    toneMapping: TONEMAP_ACES
});
camera.setLocalPosition(3, 1, 0.5);

// Add orbit camera script with a mouse and a touch support
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        distanceMax: 3.2,
        frameOnStart: false
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);

// Orbit around the statue's world-space centre
const orbitPivot = new Vec3();
hotel.getWorldTransform().transformPoint(new Vec3(0, 0.2, 0), orbitPivot);
camera.script.orbitCamera.resetAndLookAtPoint(new Vec3(3, 1, 0.5), orbitPivot);

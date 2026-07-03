// @config
//
// Renders Gaussian Splats from multiple camera viewports simultaneously with different projection
// types.

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
    PROJECTION_ORTHOGRAPHIC,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec3,
    Vec4,
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
    logo: new Asset('gsplat', 'gsplat', { url: './assets/splats/playcanvas-logo/meta.json' }),
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
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

// Setup skydome
app.scene.skyboxMip = 2;
app.scene.envAtlas = assets.helipad.resource;

// Create a splat entity and place it in the world
const logoEntity1 = new Entity();
logoEntity1.addComponent('gsplat', {
    asset: assets.logo
});
logoEntity1.setLocalPosition(0, 0.05, 0);
logoEntity1.setLocalEulerAngles(180, 90, 0);
logoEntity1.setLocalScale(0.7, 0.7, 0.7);
app.root.addChild(logoEntity1);

// Create another splat entity and place it in the world
const logoEntity2 = new Entity();
logoEntity2.addComponent('gsplat', {
    asset: assets.logo
});
logoEntity2.setLocalPosition(0, -0.5, 0);
logoEntity2.setLocalEulerAngles(-90, -90, 0);
logoEntity2.setLocalScale(2, 2, 2);
app.root.addChild(logoEntity2);

// Create left camera
const cameraLeft = new Entity('LeftCamera');
cameraLeft.addComponent('camera', {
    clearColor: new Color(0.2, 0.2, 0.2),
    farClip: 500,
    rect: new Vec4(0, 0, 0.5, 0.5),
    toneMapping: TONEMAP_ACES
});
cameraLeft.setLocalPosition(-0.8, 2, 3);
app.root.addChild(cameraLeft);

// Create right orthographic camera
const cameraRight = new Entity('RightCamera');
cameraRight.addComponent('camera', {
    clearColor: new Color(0.2, 0.2, 0.2),
    farClip: 500,
    rect: new Vec4(0.5, 0, 0.5, 0.5),
    projection: PROJECTION_ORTHOGRAPHIC,
    orthoHeight: 4,
    toneMapping: TONEMAP_ACES
});
cameraRight.translate(0, 8, 0);
cameraRight.lookAt(Vec3.ZERO, Vec3.RIGHT);
app.root.addChild(cameraRight);

// Create top camera
const cameraTop = new Entity('TopCamera');
cameraTop.addComponent('camera', {
    clearColor: new Color(0.2, 0.2, 0.2),
    farClip: 500,
    rect: new Vec4(0, 0.5, 1, 0.5),
    toneMapping: TONEMAP_ACES
});
cameraTop.translate(-2, 6, 9);
app.root.addChild(cameraTop);

// Add orbit camera script with a mouse and a touch support to top camera
cameraTop.addComponent('script');
if (cameraTop.script) {
    cameraTop.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: logoEntity2,
            distanceMax: 60,
            frameOnStart: false
        }
    });
    cameraTop.script.create('orbitCameraInputMouse');
    cameraTop.script.create('orbitCameraInputTouch');
}

// Update function called once per frame
let time = 0;
app.on('update', dt => {
    time += dt;

    // Orbit left camera around the splat
    cameraLeft.setLocalPosition(6 * Math.sin(time * 0.2), 2, 6 * Math.cos(time * 0.2));
    cameraLeft.lookAt(logoEntity2.getPosition());

    // Rotate camera right around splat differently
    cameraRight.setLocalPosition(6 * Math.sin(-time * 0.4), 2, 6 * Math.cos(-time * 0.4));
    cameraRight.lookAt(logoEntity2.getPosition());
});

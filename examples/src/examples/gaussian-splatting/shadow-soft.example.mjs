// @config
//
// Demonstrates soft (PCSS) shadows cast by Gaussian Splats onto a white plane,
// driven by a single directional light. All soft-shadow parameters are exposed
// through the HUD.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    CylinderGeometry,
    Entity,
    FILLMODE_FILL_WINDOW,
    GSPLAT_RENDERER_AUTO,
    GSplatComponentSystem,
    GSplatHandler,
    LightComponentSystem,
    Mesh,
    MeshInstance,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF3_32F,
    SHADOW_PCSS_32F,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TEXTURETYPE_RGBP,
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

    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
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
    bicycle: new Asset('bicycle', 'gsplat', { url: './assets/splats/bicycle.sog' }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' })
};

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

data.set('settings', {
    light: {
        soft: true,
        shadowResolution: 2048,
        penumbraSize: 0.04,
        penumbraFalloff: 5,
        shadowSamples: 16,
        shadowBlockerSamples: 16
    }
});

// skydome
app.scene.skyboxMip = 2;
app.scene.envAtlas = assets.helipad.resource;

// gsplat renderer selection
data.on('renderer:set', () => {
    app.scene.gsplat.renderer = data.get('renderer');
    const current = app.scene.gsplat.currentRenderer;
    if (current !== data.get('renderer')) {
        setTimeout(() => data.set('renderer', current), 0);
    }
});
data.set('renderer', GSPLAT_RENDERER_AUTO);

// Bicycle gsplat, casting shadows
const bicycle = new Entity('Bicycle');
bicycle.addComponent('gsplat', {
    asset: assets.bicycle,
    castShadows: true,
    unified: true
});
bicycle.setLocalPosition(-1.0, 0, 0);
bicycle.setLocalEulerAngles(0, 0, 180);
app.root.addChild(bicycle);

// Second bicycle gsplat, casting shadows
const bicycle2 = new Entity('Bicycle2');
bicycle2.addComponent('gsplat', {
    asset: assets.bicycle,
    castShadows: true,
    unified: true
});
bicycle2.setLocalPosition(1.0, 0, 0);
bicycle2.setLocalEulerAngles(180, 50, 0);
bicycle2.setLocalScale(1.2, 1.2, 1.2);
app.root.addChild(bicycle2);

// White ground plane receiving shadows
const groundMaterial = new StandardMaterial();
groundMaterial.diffuse = new Color(1, 1, 1);
groundMaterial.update();

// White ground receiving shadows - a very flat, finely triangulated cylinder (disc)
const groundGeometry = new CylinderGeometry({
    radius: 5,
    height: 0.1,
    capSegments: 80
});
const groundMesh = Mesh.fromGeometry(app.graphicsDevice, groundGeometry);
const groundMeshInstance = new MeshInstance(groundMesh, groundMaterial);

const ground = new Entity('Ground');
ground.addComponent('render', {
    meshInstances: [groundMeshInstance],
    castShadows: false,
    receiveShadows: true
});
ground.setLocalPosition(0, -0.05, 0);
app.root.addChild(ground);

// Camera with orbit controls
const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0.9, 0.9, 0.9),
    toneMapping: TONEMAP_ACES,
    fov: 50
});
camera.setLocalPosition(-3, 2, 4);
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        distanceMax: 15,
        frameOnStart: false
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);

// orbit around the scene center (the bikes' average center / cylinder center)
camera.script.orbitCamera.resetAndLookAtPoint(new Vec3(-3, 2, 4), new Vec3(0, 0, 0));

// Single directional light casting soft shadows
const dirLight = new Entity('MainLight');
dirLight.addComponent('light', {
    ...{
        type: 'directional',
        color: Color.WHITE,
        intensity: 1.0,
        shadowBias: 0.2,
        normalOffsetBias: 0.05,
        castShadows: true,
        shadowType: data.get('settings.light.soft') ? SHADOW_PCSS_32F : SHADOW_PCF3_32F,
        shadowDistance: 10,
        shadowResolution: 2048
    },
    ...data.get('settings.light')
});
app.root.addChild(dirLight);
dirLight.setLocalEulerAngles(55, 30, 0);

// handle HUD changes - update properties on the light
data.on('*:set', (/** @type {string} */ path, value) => {
    const pathArray = path.split('.');
    if (pathArray[0] !== 'settings' || pathArray[1] !== 'light' || pathArray.length < 3) {
        return;
    }
    if (pathArray[2] === 'soft') {
        dirLight.light.shadowType = value ? SHADOW_PCSS_32F : SHADOW_PCF3_32F;
    } else {
        dirLight.light[pathArray[2]] = value;
    }
});

// Orbit the light around the scene
let lightAngle = 0;
app.on('update', (/** @type {number} */ dt) => {
    lightAngle += dt * 20;
    dirLight.setLocalEulerAngles(55, lightAngle, 0);
});

// @config
//
// Shows a large world scene with LOD streaming and additional moving splats.
//
// @credit
// title: Skatepark
// author: Christoph Schindelar
// source: https://superspl.at/user?id=schindelar3d

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
    GSPLAT_DEBUG_NONE,
    GSPLAT_RENDERER_AUTO,
    GSplatComponentSystem,
    GSplatHandler,
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
    Vec3,
    createGraphicsDevice,
    platform
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // Disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await createGraphicsDevice(canvas, gfxOptions);

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

// Ensure canvas is updated when window changes size
const onResize = () => app.resizeCanvas();
window.addEventListener('resize', onResize);
app.on('destroy', () => {
    window.removeEventListener('resize', onResize);
});

// Skatepark configuration
const config = {
    url: 'https://code.playcanvas.com/examples_data/example_skatepark_02/lod-meta.json',
    lodUpdateDistance: 1,
    lodUnderfillLimit: 10,
    cameraPosition: [32, 2, 2],
    eulerAngles: [-90, 0, 0],
    focusPoint: [18, -1.3, 13.5],
    moveSpeed: 4,
    moveFastSpeed: 15,
    enableOrbit: false,
    enablePan: false
};

// LOD preset definitions
/** @type {Record<string, { range: number[], lodBaseDistance: number }>} */
const LOD_PRESETS = {
    desktop: {
        range: [0, 2],
        lodBaseDistance: 15
    },
    mobile: {
        range: [1, 5],
        lodBaseDistance: 15
    }
};

const assets = {
    skatepark: new Asset('skatepark', 'gsplat', { url: config.url }),
    logo: new Asset('logo', 'gsplat', { url: './assets/splats/playcanvas-logo/meta.json' }),
    biker: new Asset('biker', 'gsplat', { url: './assets/splats/biker.compressed.ply' }),

    envatlas: new Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/table-mountain-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Setup skydome
app.scene.skyboxMip = 1;
app.scene.exposure = 1.5;

// Enable rotation-based LOD updates and behind-camera penalty
app.scene.gsplat.lodUpdateAngle = 90;
app.scene.gsplat.lodBehindPenalty = 2;
app.scene.gsplat.radialSorting = true;
app.scene.gsplat.minPixelSize = 1;
app.scene.gsplat.lodUpdateDistance = config.lodUpdateDistance;
app.scene.gsplat.lodUnderfillLimit = config.lodUnderfillLimit;

// Set up SH update parameters
app.scene.gsplat.colorUpdateAngle = 10;

data.on('renderer:set', () => {
    app.scene.gsplat.renderer = data.get('renderer');
    const current = app.scene.gsplat.currentRenderer;
    if (current !== data.get('renderer')) {
        setTimeout(() => data.set('renderer', current), 0);
    }
});

// Initialize UI settings
data.set('renderer', GSPLAT_RENDERER_AUTO);
data.set('debug', GSPLAT_DEBUG_NONE);
data.set('splatBudget', platform.mobile ? 1 : 4);

data.on('debug:set', () => {
    app.scene.gsplat.debug = data.get('debug');
});

const applySplatBudget = () => {
    const millions = data.get('splatBudget');
    app.scene.gsplat.splatBudget = Math.round(millions * 1000000);
};

applySplatBudget();
data.on('splatBudget:set', applySplatBudget);

// Auto-select LOD preset based on device
const preset = platform.mobile ? 'mobile' : 'desktop';
const presetData = LOD_PRESETS[preset];

// Create skatepark entity
const skatepark = new Entity('Skatepark');
skatepark.addComponent('gsplat', {
    asset: assets.skatepark,
    lodRangeMin: presetData.range[0],
    lodRangeMax: presetData.range[1]
});
skatepark.setLocalPosition(0, 0, 0);
const [rotX, rotY, rotZ] = /** @type {[number, number, number]} */ (config.eulerAngles);
skatepark.setLocalEulerAngles(rotX, rotY, rotZ);
skatepark.setLocalScale(1, 1, 1);
app.root.addChild(skatepark);

// Apply LOD distances to skatepark
const gs = /** @type {any} */ (skatepark.gsplat);
gs.lodBaseDistance = presetData.lodBaseDistance;
gs.lodMultiplier = 4;

data.set('lodBaseDistance', presetData.lodBaseDistance);
data.set('lodMultiplier', 4);

data.on('lodBaseDistance:set', () => {
    gs.lodBaseDistance = data.get('lodBaseDistance');
});
data.on('lodMultiplier:set', () => {
    gs.lodMultiplier = data.get('lodMultiplier');
});

// World center coordinates
const worldCenter = { x: 18, y: -1.3, z: 13.5 };

// Create biker entity at center, ground level
const biker = new Entity('Biker');
biker.addComponent('gsplat', {
    asset: assets.biker
});
biker.setLocalPosition(worldCenter.x, worldCenter.y, worldCenter.z);
biker.setLocalEulerAngles(180, 0, 0);
biker.setLocalScale(1, 1, 1);
app.root.addChild(biker);

// Create first orbiting logo
const logo1 = new Entity('Logo1');
logo1.addComponent('gsplat', {
    asset: assets.logo
});
logo1.setLocalEulerAngles(180, 90, 0);
app.root.addChild(logo1);

// Create second orbiting logo
const logo2 = new Entity('Logo2');
logo2.addComponent('gsplat', {
    asset: assets.logo
});
logo2.setLocalEulerAngles(180, 90, 0);
logo2.setLocalScale(0.5, 0.5, 0.5);
app.root.addChild(logo2);

// Create camera
const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0.2, 0.2, 0.2),
    fov: 75,
    toneMapping: TONEMAP_ACES
});

// Set camera position
const [camX, camY, camZ] = /** @type {[number, number, number]} */ (config.cameraPosition);
const [focusX, focusY, focusZ] = /** @type {[number, number, number]} */ (config.focusPoint);
const focusPoint = new Vec3(focusX, focusY, focusZ);
camera.setLocalPosition(camX, camY, camZ);
app.root.addChild(camera);

// Add camera controls
camera.addComponent('script');
const cc = /** @type {CameraControls} */ (/** @type {any} */ (camera.script).create(CameraControls));
Object.assign(cc, {
    sceneSize: 500,
    moveSpeed: config.moveSpeed,
    moveFastSpeed: config.moveFastSpeed,
    enableOrbit: false,
    enablePan: false,
    focusPoint: focusPoint
});

data.set('orbitCamera', false);
data.on('orbitCamera:set', () => {
    const orbit = !!data.get('orbitCamera');
    cc.enableOrbit = orbit;
    cc.enablePan = orbit;
    cc.enableFly = !orbit;
    if (orbit) {
        cc.focusPoint = new Vec3(worldCenter.x, worldCenter.y, worldCenter.z);
    }
});

// Orbit parameters
const logo1Radius = 3;
const logo1Speed = 0.6;
const logo2Radius = 5;
const logo2Speed = -0.2;
const orbitHeight = 3;

// Animation update
let time = 0;
const centerVec = new Vec3(worldCenter.x, worldCenter.y + orbitHeight, worldCenter.z);
const rollSpeed1 = 90; // degrees per second
const rollSpeed2 = 120; // degrees per second
app.on('update', dt => {
    time += dt;

    // Orbit logo 1 around world center
    const angle1 = time * logo1Speed;
    logo1.setLocalPosition(
        worldCenter.x + logo1Radius * Math.sin(angle1),
        worldCenter.y + orbitHeight,
        worldCenter.z + logo1Radius * Math.cos(angle1)
    );
    logo1.lookAt(centerVec);
    logo1.rotateLocal(0, 0, time * rollSpeed1);

    // Orbit logo 2 around world center (opposite direction)
    const angle2 = time * logo2Speed;
    logo2.setLocalPosition(
        worldCenter.x + logo2Radius * Math.sin(angle2),
        worldCenter.y + orbitHeight,
        worldCenter.z + logo2Radius * Math.cos(angle2)
    );
    logo2.lookAt(centerVec);
    logo2.rotateLocal(0, 0, time * rollSpeed2);

    // Update HUD stats
    data.set('data.stats.gsplats', app.stats.frame.gsplats.toLocaleString());
});

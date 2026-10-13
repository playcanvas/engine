// @config
//
// @credit
// title: House 03 PBR
// author: Sketchfab
// source: https://sketchfab.com/3d-models/house-03-pbr-c56521b89188460a99235dec8bcd0ed3
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    SmaaEffect,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    house: new Asset('house', 'container', { url: './assets/models/pbr-house.glb' }),
    cube: new Asset('cube', 'container', { url: './assets/models/playcanvas-cube.glb' }),
    envatlas: new Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/table-mountain-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType],

    // The camera frame applies the selected anti-aliasing, multisampling included
    antialias: false
};

// The device renders at a pixel ratio of 1, the default, where aliasing is easy to see
const device = await createGraphicsDevice(canvas, gfxOptions);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);

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

// Setup skydome with low intensity
app.scene.envAtlas = assets.envatlas.resource;
app.scene.skyboxMip = 0;
app.scene.exposure = 2.5;

// Create an instance of the house and add it to the scene
const houseEntity = assets.house.resource.instantiateRenderEntity();
houseEntity.setLocalScale(100, 100, 100);
app.root.addChild(houseEntity);

// Create an Entity with a camera component
const cameraEntity = new Entity();
cameraEntity.addComponent('camera', {
    nearClip: 10,
    farClip: 600,
    fov: 80
});

// Add orbit camera script with a mouse and a touch support
cameraEntity.addComponent('script');
cameraEntity.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: houseEntity,
        distanceMax: 400,
        frameOnStart: true
    }
});
cameraEntity.script.create('orbitCameraInputMouse');
cameraEntity.script.create('orbitCameraInputTouch');
cameraEntity.setLocalPosition(0, 40, -220);
cameraEntity.lookAt(0, 0, 100);
app.root.addChild(cameraEntity);

// Add a sign of thin slanted bars in front of the house, a high contrast test of how well each method
// smooths the edges. It stands in the world, facing the camera as it starts: TAA reprojects the
// history of a pixel from the motion of the camera alone, which holds only for geometry that does not
// move by itself - there are no motion vectors.
const createUnlitMaterial = (/** @type {Color} */ color) => {
    const material = new StandardMaterial();
    material.diffuse = color;
    material.emissive = color;
    material.useLighting = false;
    material.update();
    return material;
};
const darkMaterial = createUnlitMaterial(new Color(0.1, 0.1, 0.1));
const lightMaterial = createUnlitMaterial(new Color(0.6, 0.6, 0.6));

const pattern = new Entity('Pattern');
pattern.setLocalPosition(60, 56, -112);
pattern.setLocalEulerAngles(169, 0, 180);
pattern.setLocalScale(4, 4, 4);
app.root.addChild(pattern);

const background = new Entity();
background.addComponent('render', {
    type: 'box',
    material: darkMaterial
});
background.setLocalScale(14, 9, 0.1);
pattern.addChild(background);

for (let i = 0; i < 13; i++) {
    const bar = new Entity();
    bar.addComponent('render', {
        type: 'box',
        material: lightMaterial
    });
    bar.setLocalPosition(-6 + i, 0, 0.1);
    bar.setLocalEulerAngles(0, 0, 17);
    bar.setLocalScale(0.08, 8, 0.08);
    pattern.addChild(bar);
}

// Add a shadow casting directional light
const light = new Entity();
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 1, 1),
    intensity: 1,
    range: 700,
    shadowResolution: 4096,
    shadowDistance: 600,
    castShadows: true,
    shadowBias: 0.2,
    normalOffsetBias: 0.05
});
app.root.addChild(light);
light.setLocalEulerAngles(40, 10, 0);

const cubeEntity = assets.cube.resource.instantiateRenderEntity();
cubeEntity.setLocalScale(30, 30, 30);
app.root.addChild(cubeEntity);

// ------ Custom render passes set up ------

const cameraFrame = new CameraFrame(app, cameraEntity.camera);
cameraFrame.rendering.toneMapping = TONEMAP_ACES;

// SMAA is not part of the camera frame by default - it is added, and enabled when selected
const smaa = new SmaaEffect(device);
cameraFrame.addEffect(smaa);

// The quality presets of SMAA
const smaaPresets = {
    low: { threshold: 0.15, maxSearchSteps: 4, maxSearchStepsDiag: 0, cornerRounding: 100 },
    medium: { threshold: 0.1, maxSearchSteps: 8, maxSearchStepsDiag: 0, cornerRounding: 100 },
    high: { threshold: 0.1, maxSearchSteps: 16, maxSearchStepsDiag: 8, cornerRounding: 25 },
    ultra: { threshold: 0.05, maxSearchSteps: 32, maxSearchStepsDiag: 16, cornerRounding: 25 }
};

// The anti-aliasing methods: the SMAA quality preset, TAA and its temporal upscaling, and the
// multisampling, alone or combined
const methods = {
    none: {},
    smaaLow: { smaa: 'low' },
    smaaMedium: { smaa: 'medium' },
    smaaHigh: { smaa: 'high' },
    smaaUltra: { smaa: 'ultra' },
    taa: { taa: true },
    taaUpscale: { taa: true, upscale: true },
    msaa: { samples: 4 },
    msaaSmaa: { samples: 4, smaa: 'high' }
};

// ------

const applySettings = () => {
    const method = methods[data.get('data.aa.method')] ?? methods.none;

    cameraFrame.bloom.intensity = data.get('data.scene.bloom') ? 0.02 : 0;
    cameraFrame.rendering.renderTargetScale = data.get('data.scene.scale');
    cameraFrame.rendering.sharpness = data.get('data.scene.sharpness');
    cameraFrame.rendering.samples = method.samples ?? 1;

    // TAA, which upscales a scene rendered at a lower resolution to the full one when selected
    cameraFrame.taa.enabled = !!method.taa;
    cameraFrame.taa.upscale = !!method.upscale;

    smaa.enabled = !!method.smaa;
    if (method.smaa) {
        Object.assign(smaa, smaaPresets[method.smaa]);
    }

    // the debug views of SMAA, showing the edges it found and how much it blends the pixels
    const debug = data.get('data.aa.debug');
    cameraFrame.debug = method.smaa && debug !== 'none' ? `smaa${debug}` : null;

    cameraFrame.update();
};

// Set initial values
data.set('data', {
    scene: {
        scale: 1,
        sharpness: 0,
        bloom: true
    },
    aa: {
        method: 'smaaHigh',
        debug: 'none'
    }
});

// Apply UI changes. This is registered after the initial values are set, as setting them fires an
// event for each value while the remaining values are still undefined.
data.on('*:set', applySettings);
applySettings();

let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    time += dt;
    cubeEntity.setLocalPosition(130 * Math.sin(time), 0, 130 * Math.cos(time));
    cubeEntity.rotate(50 * dt, 20 * dt, 30 * dt);
});

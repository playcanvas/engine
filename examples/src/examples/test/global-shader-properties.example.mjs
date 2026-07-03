// @config
// @flag HIDDEN
//
// @credit
// title: Terrain Low Poly
// author: Sketchfab
// source: https://sketchfab.com/3d-models/terrain-low-poly-248b21331315466e98d20c441935d99d
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Curve,
    CurveSet,
    Entity,
    FILLMODE_FILL_WINDOW,
    FOG_LINEAR,
    GAMMA_NONE,
    GAMMA_SRGB,
    GSplatComponentSystem,
    GSplatHandler,
    LightComponentSystem,
    LitMaterial,
    Mouse,
    ParticleSystemComponentSystem,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF3_32F,
    SPECOCC_AO,
    ScriptComponentSystem,
    ScriptHandler,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    createGraphicsDevice
} from 'playcanvas';

import { createGoochMaterial } from 'examples/assets/scripts/misc/gooch-material.mjs';
import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    script: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    terrain: new Asset('terrain', 'container', { url: './assets/models/terrain.glb' }),
    biker: new Asset('gsplat', 'gsplat', { url: './assets/splats/biker.compressed.ply' }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/table-mountain-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
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

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    GSplatComponentSystem,
    ParticleSystemComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, GSplatHandler];

const app = new AppBase(canvas);
app.init(createOptions);

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// Setup skydome
app.scene.skyboxMip = 0;
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxRotation = new Quat().setFromEulerAngles(0, -70, 0);

// STANDARD MATERIAL ----------

/** @type {Entity} */
const terrain = assets.terrain.resource.instantiateRenderEntity();
terrain.setLocalScale(30, 30, 30);
app.root.addChild(terrain);

// GSPLAT MATERIAL ----------

const biker = new Entity();
biker.addComponent('gsplat', {
    asset: assets.biker
});
biker.setLocalPosition(0, 0, 150);
biker.setLocalEulerAngles(180, 90, 0);
biker.setLocalScale(20, 20, 20);
app.root.addChild(biker);

// SHADER MATERIAL ----------

const box = new Entity('ShaderMaterial');
const boxMaterial = createGoochMaterial(null, [0.13, 0.55, 0.13]);
box.addComponent('render', {
    type: 'box',
    material: boxMaterial
});
box.setLocalScale(30, 30, 30);
box.setLocalPosition(-70, 30, 130);
app.root.addChild(box);

// LIT MATERIAL ----------

const material = new LitMaterial();
material.setParameter('texture_envAtlas', assets.helipad.resource);
material.setParameter('material_reflectivity', 1.0);
material.useSkybox = true;
material.hasSpecular = true;
material.hasSpecularityFactor = true;
material.hasNormals = true;
material.hasMetalness = true;
material.occludeSpecular = SPECOCC_AO;

material.shaderChunkGLSL = `
        #include "litShaderCorePS"
        void evaluateFrontend() {
            litArgs_emission = vec3(0.7, 0.4, 0);
            litArgs_metalness = 0.5;
            litArgs_specularity = vec3(0.5, 0.5, 0.5);
            litArgs_specularityFactor = 1.0;
            litArgs_gloss = 0.5;
            litArgs_ior = 0.1;
            litArgs_ao = 0.0;
            litArgs_opacity = 1.0;
        }`;
material.shaderChunkWGSL = `
        #include "litShaderCorePS"
        fn evaluateFrontend() {
            litArgs_emission = vec3f(0.7, 0.4, 0);
            litArgs_metalness = 0.5;
            litArgs_specularity = vec3f(0.5, 0.5, 0.5);
            litArgs_specularityFactor = 1.0;
            litArgs_gloss = 0.5;
            litArgs_ior = 0.1;
            litArgs_ao = 0.0;
            litArgs_opacity = 1.0;
        }`;
material.update();

// Create primitive
const primitive = new Entity();
primitive.addComponent('render', {
    type: 'sphere',
    material: material
});

primitive.setLocalScale(30, 30, 30);
primitive.setLocalPosition(-170, 30, 130);
app.root.addChild(primitive);

// PARTICLE SYSTEM ----------

const localVelocityCurve = new CurveSet([
    [0, 0, 0.5, 30],
    [0, 0, 0.5, 30],
    [0, 0, 0.5, 30]
]);
const localVelocityCurve2 = new CurveSet([
    [0, 0, 0.5, -30],
    [0, 0, 0.5, -30],
    [0, 0, 0.5, -30]
]);
const worldVelocityCurve = new CurveSet([
    [0, 0],
    [0, 0, 0.2, 6, 1, 300],
    [0, 0]
]);

// Create entity for particle system
const entity = new Entity('ParticleSystem');
app.root.addChild(entity);
entity.setLocalPosition(0, 20, 0);

// Add particlesystem component to entity
entity.addComponent('particlesystem', {
    numParticles: 200,
    lifetime: 1,
    rate: 0.01,
    scaleGraph: new Curve([0, 10]),
    velocityGraph: worldVelocityCurve,
    localVelocityGraph: localVelocityCurve,
    localVelocityGraph2: localVelocityCurve2,
    colorGraph: new CurveSet([
        [0, 1, 0.25, 1],
        [0, 0, 0.25, 0.3],
        [0, 0, 1, 0]
    ])
});

// --------

// Create an Entity with a camera component
const camera = new Entity('MainCamera');
camera.addComponent('camera', {
    clearColor: new Color(0.9, 0.9, 0.9),
    farClip: 1000,
    toneMapping: TONEMAP_ACES,
    fog: {
        color: new Color(0.8, 0.8, 0.8),
        start: 400,
        end: 800,
        density: 0.001,
        type: FOG_LINEAR
    }
});

// and position it in the world
camera.setLocalPosition(-500, 60, 300);

// Add orbit camera script with a mouse and a touch support
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        distanceMax: 500
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);

// Create a directional light casting soft shadows
const dirLight = new Entity('Cascaded Light');
dirLight.addComponent('light', {
    type: 'directional',
    color: Color.WHITE,
    shadowBias: 0.3,
    normalOffsetBias: 0.2,
    intensity: 1.0,

    // Enable shadow casting
    castShadows: true,
    shadowType: SHADOW_PCF3_32F,
    shadowDistance: 1000,
    shadowResolution: 2048
});
app.root.addChild(dirLight);
dirLight.setLocalEulerAngles(75, 120, 20);

// Handle HUD changes
data.on('*:set', (path, value) => {
    const propertyName = path.split('.')[1];
    if (propertyName === 'tonemapping') {
        // Set up selected tone-mapping
        camera.camera.toneMapping = value;
    }
    if (propertyName === 'fog') {
        camera.camera.fog.type = value;
    }
    if (propertyName === 'gamma') {
        camera.camera.gammaCorrection = value ? GAMMA_SRGB : GAMMA_NONE;
    }
});

// Initial values
data.set('data', {
    tonemapping: TONEMAP_ACES,
    fog: FOG_LINEAR,
    gamma: true
});

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_NONE,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Curve,
    CurveSet,
    EMITTERSHAPE_SPHERE,
    Entity,
    FILLMODE_FILL_WINDOW,
    Keyboard,
    LightComponentSystem,
    Mouse,
    ParticleSystemComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    torus: new Asset('heart', 'container', { url: './assets/models/torus.glb' }),
    color: new Asset('color', 'texture', { url: './assets/textures/clouds.jpg' }, { srgb: true }),
    script: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
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
createOptions.keyboard = new Keyboard(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ParticleSystemComponentSystem,
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

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Setup skydome
app.scene.skyboxIntensity = 0.5;
app.scene.skyboxMip = 2;
app.scene.envAtlas = assets.helipad.resource;

// Create an Entity with a camera component
const cameraEntity = new Entity();
cameraEntity.addComponent('camera', {
    clearColor: new Color(0, 0, 0.05)
});
cameraEntity.rotateLocal(0, 0, 0);
cameraEntity.setPosition(0, 4, 20);

cameraEntity.addComponent('script');
cameraEntity.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        distanceMax: 50,
        frameOnStart: false
    }
});
cameraEntity.script.create('orbitCameraInputMouse');
cameraEntity.script.create('orbitCameraInputTouch');

app.root.addChild(cameraEntity);
cameraEntity.script.orbitCamera.pivotPoint = new Vec3(0, 5, 0);

// Create an Entity for the ground
const material = new StandardMaterial();
material.gloss = 0.6;
material.metalness = 0.4;
material.useMetalness = true;
material.update();

const ground = new Entity();
ground.addComponent('render', {
    type: 'box',
    material: material
});
ground.setLocalScale(10, 1, 10);
ground.setLocalPosition(0, -0.5, 0);
app.root.addChild(ground);

// Create a directional light
const lightDirEntity = new Entity();
lightDirEntity.addComponent('light', {
    type: 'directional',
    color: new Color(1, 1, 1),
    intensity: 1,
    castShadows: false
});
lightDirEntity.setLocalEulerAngles(25, 0, -80);
app.root.addChild(lightDirEntity);

// Make particles move in different directions
const localVelocityCurve = new CurveSet([
    [0, 0, 0.5, 8],
    [0, 0, 0.5, 8],
    [0, 0, 0.5, 8]
]);
const localVelocityCurve2 = new CurveSet([
    [0, 0, 0.5, -8],
    [0, 0, 0.5, -8],
    [0, 0, 0.5, -8]
]);

// Increasing gravity
const worldVelocityCurve = new CurveSet([
    [0, 0],
    [0, 0, 0.2, 12, 1, -2],
    [0, 0]
]);

// Color changes throughout lifetime
const colorCurve = new CurveSet([
    [0, 1, 0.25, 1, 0.375, 0.5, 0.5, 0], // r
    [0, 0, 0.125, 0.25, 0.25, 0.5, 0.375, 0.75, 0.5, 1], // g
    [0, 0, 1, 0.3] // b
]);

// Create entity for particle system
const entity = new Entity('Emitter');
app.root.addChild(entity);
entity.setLocalPosition(0, 1, 0);

// When texture is loaded add particlesystem component to entity
entity.addComponent('particlesystem', {
    numParticles: 150,
    lifetime: 1,
    rate: 0.01,
    scaleGraph: new Curve([0, 0.2, 1, 0.7]),
    velocityGraph: worldVelocityCurve,
    localVelocityGraph: localVelocityCurve,
    localVelocityGraph2: localVelocityCurve2,
    colorGraph: colorCurve,
    emitterShape: EMITTERSHAPE_SPHERE,
    emitterRadius: 1,

    // Mesh asset and rendering settings
    renderAsset: assets.torus.resource.renders[0],
    blendType: BLEND_NONE,
    depthWrite: true,
    lighting: true,
    halfLambert: true,
    alignToMotion: true,

    // Texture applied to the mesh particles using the mesh UVs
    colorMap: assets.color.resource
});

data.set('settings', {
    lifetime: 1,
    numParticles: 150,
    lighting: true,
    alignToMotion: true,
    textured: true,
    enabled: true
});

data.on('*:set', (/** @type {string} */ path, value) => {
    const propertyName = path.split('.')[1];

    // The 'textured' toggle switches the color map on and off (null falls back to the
    // Default white texture), demonstrating mesh UVs are used for texturing
    if (propertyName === 'textured') {
        entity.particlesystem.colorMap = value ? assets.color.resource : null;
        return;
    }

    entity.particlesystem[propertyName] = value;
});

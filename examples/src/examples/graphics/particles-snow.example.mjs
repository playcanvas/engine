import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Curve,
    CurveSet,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    Mouse,
    ParticleSystemComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    snowflake: new Asset('snowflake', 'texture', { url: './assets/textures/snowflake.png' }, { srgb: true })
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
    ParticleSystemComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ScriptHandler];

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

// Create an Entity with a camera component
const cameraEntity = new Entity();
cameraEntity.addComponent('camera', {
    clearColor: new Color(0, 0, 0)
});
cameraEntity.rotateLocal(0, 0, 0);
cameraEntity.translateLocal(0, 7, 10);

// add orbit camera script with a mouse and a touch support
cameraEntity.addComponent('script');
cameraEntity.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        distanceMax: 190,
        frameOnStart: false
    }
});
cameraEntity.script.create('orbitCameraInputMouse');
cameraEntity.script.create('orbitCameraInputTouch');

// Create a directional light
const lightDirEntity = new Entity();
lightDirEntity.addComponent('light', {
    type: 'directional',
    color: new Color(1, 1, 1),
    intensity: 1
});
lightDirEntity.setLocalEulerAngles(45, 0, 0);

// Add Entities into the scene hierarchy
app.root.addChild(cameraEntity);
app.root.addChild(lightDirEntity);

// set up random downwards velocity from -0.4 to -0.7
const velocityCurve = new CurveSet([
    [0, 0], // x
    [0, -0.7], // y
    [0, 0] // z
]);
const velocityCurve2 = new CurveSet([
    [0, 0], // x
    [0, -0.4], // y
    [0, 0] // z
]);

// set up random rotation speed from -100 to 100 degrees per second
const rotCurve = new Curve([0, 100]);
const rotCurve2 = new Curve([0, -100]);

// scale is constant at 0.1
const scaleCurve = new Curve([0, 0.2]);

// Create entity for particle system
const entity = new Entity();
app.root.addChild(entity);
entity.setLocalPosition(0, 5, 0);

entity.addComponent('particlesystem', {
    numParticles: 100,
    lifetime: 10,
    rate: 0.1,
    startAngle: 360,
    startAngle2: -360,
    emitterExtents: new Vec3(7, 2, 7),
    velocityGraph: velocityCurve,
    velocityGraph2: velocityCurve2,
    scaleGraph: scaleCurve,
    rotationSpeedGraph: rotCurve,
    rotationSpeedGraph2: rotCurve2,
    colorMap: assets.snowflake.resource,
    depthSoftening: 0.08
});

// Create an Entity for the ground
const ground = new Entity();
ground.addComponent('render', {
    type: 'cylinder'
});
ground.setLocalScale(10, 0.01, 10);
ground.setLocalPosition(0, 0, 0);
app.root.addChild(ground);

data.on('*:set', (/** @type {string} */ _path, _value) => {
    // toggle the depth softening on the particle system and the depth texture on the camera
    const soft = data.get('data.soft');
    entity.particlesystem.depthSoftening = soft ? 0.08 : 0;
    cameraEntity.camera.requestSceneDepthMap(soft);
});

// initial values
data.set('data', {
    soft: true
});

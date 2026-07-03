import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CURVE_LINEAR,
    CameraComponentSystem,
    Color,
    Curve,
    CurveSet,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    ParticleSystemComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    TextureHandler,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    spark: new Asset('spark', 'texture', { url: './assets/textures/spark.png' }, { srgb: true })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ParticleSystemComponentSystem
];
createOptions.resourceHandlers = [TextureHandler];

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

// Create an Entity with a camera component
const cameraEntity = new Entity();
cameraEntity.addComponent('camera', {
    clearColor: new Color(0, 0, 0.05)
});
cameraEntity.rotateLocal(0, 0, 0);
cameraEntity.translateLocal(0, 0, 10);

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

// Offset position
const localPosCurve = new CurveSet([
    [0, 0, 1, 4],
    [0, 0, 1, 3],
    [0, 0, 1, 0]
]);
localPosCurve.type = CURVE_LINEAR;

// Make particles move in different directions
const localVelocityCurve = new CurveSet([
    [0, 0, 1, 8],
    [0, 0, 1, 6],
    [0, 0, 1, 0]
]);
const localVelocityCurve2 = new CurveSet([
    [0, 0, 1, -8],
    [0, 0, 1, -6],
    [0, 0, 1, 0]
]);

// Increasing gravity
const worldVelocityCurve = new CurveSet([
    [0, 0],
    [0, 0, 0.2, 6, 1, -48],
    [0, 0]
]);

// Gradually make sparks bigger
const scaleCurve = new Curve([0, 0, 0.5, 0.3, 0.8, 0.2, 1, 0.1]);

// Rotate sparks 360 degrees per second
const angleCurve = new Curve([0, 360]);

// Color changes throughout lifetime
const colorCurve = new CurveSet([
    [0, 1, 0.25, 1, 0.375, 0.5, 0.5, 0],
    [0, 0, 0.125, 0.25, 0.25, 0.5, 0.375, 0.75, 0.5, 1],
    [0, 0, 1, 0]
]);

// Create entity for particle system
const entity = new Entity('Sparks');
app.root.addChild(entity);
entity.setLocalPosition(0, 0, 0);

// When texture is loaded add particlesystem component to entity
entity.addComponent('particlesystem', {
    numParticles: 200,
    lifetime: 2,
    rate: 0.01,
    scaleGraph: scaleCurve,
    rotationSpeedGraph: angleCurve,
    colorGraph: colorCurve,
    colorMap: assets.spark.resource,
    velocityGraph: worldVelocityCurve,
    localVelocityGraph: localVelocityCurve,
    localVelocityGraph2: localVelocityCurve2
});

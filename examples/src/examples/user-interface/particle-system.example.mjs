import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    ButtonComponentSystem,
    CameraComponentSystem,
    Color,
    Curve,
    CurveSet,
    ELEMENTTYPE_IMAGE,
    ELEMENTTYPE_TEXT,
    EMITTERSHAPE_SPHERE,
    ElementComponentSystem,
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    Mouse,
    ParticleSystemComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SCALEMODE_BLEND,
    ScreenComponentSystem,
    TextureHandler,
    TouchDevice,
    Vec2,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    font: new Asset('font', 'font', { url: './assets/fonts/courier.json' }),
    spark: new Asset('spark', 'texture', { url: './assets/textures/spark.png' })
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
createOptions.elementInput = new ElementInput(canvas);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    ScreenComponentSystem,
    ButtonComponentSystem,
    ElementComponentSystem,
    ParticleSystemComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, FontHandler];

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

// Create a camera
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(30 / 255, 30 / 255, 30 / 255)
});
app.root.addChild(camera);

// Create a 2D screen
const screen = new Entity();
screen.addComponent('screen', {
    referenceResolution: new Vec2(1280, 720),
    scaleBlend: 0.5,
    scaleMode: SCALEMODE_BLEND,
    screenSpace: true
});
app.root.addChild(screen);

// Create a simple panel
const panel = new Entity();
panel.addComponent('element', {
    anchor: [0.5, 0.5, 0.5, 0.5],
    color: new Color(0.4, 0.4, 0.4),
    height: 40,
    pivot: [0.5, 0.5],
    type: ELEMENTTYPE_IMAGE,
    width: 175,
    useInput: true
});
screen.addChild(panel);

// Create a label for the panel
const label = new Entity();
label.addComponent('element', {
    anchor: [0.5, 0.5, 0.5, 0.5],
    color: new Color(1, 1, 0),
    fontAsset: assets.font.id,
    fontSize: 36,
    height: 64,
    pivot: [0.5, 0.5],
    text: 'LABEL',
    type: ELEMENTTYPE_TEXT,
    width: 128,
    wrapLines: true
});
panel.addChild(label);

// Create entity for particle system
const particles = new Entity();

// Insert sparks as a child of the panel, but before Label - that is the order for rendering
panel.insertChild(particles, 0);

// Particles will render in UI layer
const UILayer = app.scene.layers.getLayerByName('UI');

// Particle size
const scaleCurve = new Curve([0, 0.03]);

// Color changes throughout lifetime
const colorCurve = new CurveSet([
    [0, 1, 0.25, 1, 0.375, 0.5, 0.5, 0],
    [0, 0, 0.125, 0.25, 0.25, 0.5, 0.375, 0.75, 0.5, 1],
    [0, 0, 1, 0]
]);

// Increasing gravity to get them to move
const worldVelocityCurve = new CurveSet([
    [0, 0],
    [0, 0, 0.1, 0.1, 0.1, -0.1],
    [0, 0]
]);

// Rotate sparks 360 degrees per second
const angleCurve = new Curve([0, 360]);

// When texture is loaded add particlesystem component to entity
particles.addComponent('particlesystem', {
    numParticles: 100,
    lifetime: 1,
    rate: 0.01,

    // Make them follow the button in screen-space
    localSpace: true,
    screenSpace: true,

    emitterShape: EMITTERSHAPE_SPHERE,
    emitterRadius: 100,

    scaleGraph: scaleCurve,
    rotationSpeedGraph: angleCurve,
    colorGraph: colorCurve,
    velocityGraph: worldVelocityCurve,

    colorMap: assets.spark.resource,
    layers: [UILayer.id]
});

// Sort all screen elements
screen.screen.syncDrawOrder();

let time = 0;
app.on('update', (dt) => {
    time += dt * 0.3;

    // Move buttons along the circular path
    panel.setLocalPosition(300 * Math.sin(time), 300 * Math.cos(time), 0);
});

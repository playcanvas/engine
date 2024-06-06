import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    font: new pc.Asset('font', 'font', { url: rootPath + '/static/assets/fonts/courier.json' }),
    spark: new pc.Asset('spark', 'texture', { url: rootPath + '/static/assets/textures/spark.png' })
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.elementInput = new pc.ElementInput(canvas);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.ScreenComponentSystem,
    pc.ButtonComponentSystem,
    pc.ElementComponentSystem,
    pc.ParticleSystemComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.FontHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Create a camera
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(30 / 255, 30 / 255, 30 / 255)
    });
    app.root.addChild(camera);

    // Create a 2D screen
    const screen = new pc.Entity();
    screen.addComponent('screen', {
        referenceResolution: new pc.Vec2(1280, 720),
        scaleBlend: 0.5,
        scaleMode: pc.SCALEMODE_BLEND,
        screenSpace: true
    });
    app.root.addChild(screen);

    // Create a simple panel
    const panel = new pc.Entity();
    panel.addComponent('element', {
        anchor: [0.5, 0.5, 0.5, 0.5],
        color: new pc.Color(0.4, 0.4, 0.4),
        height: 40,
        pivot: [0.5, 0.5],
        type: pc.ELEMENTTYPE_IMAGE,
        width: 175,
        useInput: true
    });
    screen.addChild(panel);

    // Create a label for the panel
    const label = new pc.Entity();
    label.addComponent('element', {
        anchor: [0.5, 0.5, 0.5, 0.5],
        color: new pc.Color(1, 1, 0),
        fontAsset: assets.font.id,
        fontSize: 36,
        height: 64,
        pivot: [0.5, 0.5],
        text: 'LABEL',
        type: pc.ELEMENTTYPE_TEXT,
        width: 128,
        wrapLines: true
    });
    panel.addChild(label);

    // Create entity for particle system
    const particles = new pc.Entity();

    // insert sparks as a child of the panel, but before Label - that is the order for rendering
    panel.insertChild(particles, 0);

    // particles will render in UI layer
    const UILayer = app.scene.layers.getLayerByName('UI');

    // particle size
    const scaleCurve = new pc.Curve([0, 0.03]);

    // color changes throughout lifetime
    const colorCurve = new pc.CurveSet([
        [0, 1, 0.25, 1, 0.375, 0.5, 0.5, 0],
        [0, 0, 0.125, 0.25, 0.25, 0.5, 0.375, 0.75, 0.5, 1],
        [0, 0, 1, 0]
    ]);

    // increasing gravity to get them to move
    const worldVelocityCurve = new pc.CurveSet([
        [0, 0],
        [0, 0, 0.1, 0.1, 0.1, -0.1],
        [0, 0]
    ]);

    // rotate sparks 360 degrees per second
    const angleCurve = new pc.Curve([0, 360]);

    // when texture is loaded add particlesystem component to entity
    particles.addComponent('particlesystem', {
        numParticles: 100,
        lifetime: 1,
        rate: 0.01,

        // make them follow the buttn in screen-space
        localSpace: true,
        screenSpace: true,

        emitterShape: pc.EMITTERSHAPE_SPHERE,
        emitterRadius: 100,

        scaleGraph: scaleCurve,
        rotationSpeedGraph: angleCurve,
        colorGraph: colorCurve,
        velocityGraph: worldVelocityCurve,

        colorMap: assets.spark.resource,
        layers: [UILayer.id]
    });

    // sort all screen elements
    screen.screen.syncDrawOrder();

    let time = 0;
    app.on('update', function (dt) {
        time += dt * 0.3;

        // move buttons along the circular path
        panel.setLocalPosition(300 * Math.sin(time), 300 * Math.cos(time), 0);
    });
});

export { app };

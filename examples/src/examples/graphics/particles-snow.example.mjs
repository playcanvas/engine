import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    snowflake: new pc.Asset('snowflake', 'texture', { url: rootPath + '/static/assets/textures/snowflake.png' })
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

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ParticleSystemComponentSystem
];
createOptions.resourceHandlers = [
    // @ts-ignore
    pc.TextureHandler
];

const app = new pc.AppBase(canvas);
app.init(createOptions);

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Ensure canvas is resized when window changes size
    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);
    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
    });

    // Create an Entity with a camera component
    const cameraEntity = new pc.Entity();
    cameraEntity.addComponent('camera', {
        clearColor: new pc.Color(0, 0, 0)
    });
    cameraEntity.rotateLocal(0, 0, 0);
    cameraEntity.translateLocal(0, 0, 10);

    // Create a directional light
    const lightDirEntity = new pc.Entity();
    lightDirEntity.addComponent('light', {
        type: 'directional',
        color: new pc.Color(1, 1, 1),
        intensity: 1
    });
    lightDirEntity.setLocalEulerAngles(45, 0, 0);

    // Add Entities into the scene hierarchy
    app.root.addChild(cameraEntity);
    app.root.addChild(lightDirEntity);

    // set up random downwards velocity from -0.4 to -0.7
    const velocityCurve = new pc.CurveSet([
        [0, 0], // x
        [0, -0.7], // y
        [0, 0] // z
    ]);
    const velocityCurve2 = new pc.CurveSet([
        [0, 0], // x
        [0, -0.4], // y
        [0, 0] // z
    ]);

    // set up random rotation speed from -100 to 100 degrees per second
    const rotCurve = new pc.Curve([0, 100]);
    const rotCurve2 = new pc.Curve([0, -100]);

    // scale is constant at 0.1
    const scaleCurve = new pc.Curve([0, 0.1]);

    // Create entity for particle system
    const entity = new pc.Entity();
    app.root.addChild(entity);
    entity.setLocalPosition(0, 3, 0);

    // load snowflake texture
    // app.assets.loadFromUrl(rootPath + '/static/assets/textures/snowflake.png', 'texture', function () {
    // when texture is loaded add particlesystem component to entity
    entity.addComponent('particlesystem', {
        numParticles: 100,
        lifetime: 10,
        rate: 0.1,
        startAngle: 360,
        startAngle2: -360,
        emitterExtents: new pc.Vec3(5, 0, 0),
        velocityGraph: velocityCurve,
        velocityGraph2: velocityCurve2,
        scaleGraph: scaleCurve,
        rotationSpeedGraph: rotCurve,
        rotationSpeedGraph2: rotCurve2,
        colorMap: assets.snowflake.resource
    });
    // });
});

export { app };

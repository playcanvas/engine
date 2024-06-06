import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    torus: new pc.Asset('heart', 'container', { url: rootPath + '/static/assets/models/torus.glb' }),
    script: new pc.Asset('script', 'script', { url: rootPath + '/static/scripts/camera/orbit-camera.js' }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
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
createOptions.keyboard = new pc.Keyboard(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ParticleSystemComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler];

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

    // setup skydome
    app.scene.skyboxIntensity = 0.5;
    app.scene.skyboxMip = 2;
    app.scene.envAtlas = assets.helipad.resource;

    // Create an Entity with a camera component
    const cameraEntity = new pc.Entity();
    cameraEntity.addComponent('camera', {
        clearColor: new pc.Color(0, 0, 0.05)
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
    cameraEntity.script.orbitCamera.pivotPoint = new pc.Vec3(0, 5, 0);

    // Create an Entity for the ground
    const material = new pc.StandardMaterial();
    material.gloss = 0.6;
    material.metalness = 0.4;
    material.useMetalness = true;
    material.update();

    const ground = new pc.Entity();
    ground.addComponent('render', {
        type: 'box',
        material: material
    });
    ground.setLocalScale(10, 1, 10);
    ground.setLocalPosition(0, -0.5, 0);
    app.root.addChild(ground);

    // Create a directional light
    const lightDirEntity = new pc.Entity();
    lightDirEntity.addComponent('light', {
        type: 'directional',
        color: new pc.Color(1, 1, 1),
        intensity: 1,
        castShadows: false
    });
    lightDirEntity.setLocalEulerAngles(25, 0, -80);
    app.root.addChild(lightDirEntity);

    // make particles move in different directions
    const localVelocityCurve = new pc.CurveSet([
        [0, 0, 0.5, 8],
        [0, 0, 0.5, 8],
        [0, 0, 0.5, 8]
    ]);
    const localVelocityCurve2 = new pc.CurveSet([
        [0, 0, 0.5, -8],
        [0, 0, 0.5, -8],
        [0, 0, 0.5, -8]
    ]);

    // increasing gravity
    const worldVelocityCurve = new pc.CurveSet([
        [0, 0],
        [0, 0, 0.2, 12, 1, -2],
        [0, 0]
    ]);

    // color changes throughout lifetime
    const colorCurve = new pc.CurveSet([
        [0, 1, 0.25, 1, 0.375, 0.5, 0.5, 0], // r
        [0, 0, 0.125, 0.25, 0.25, 0.5, 0.375, 0.75, 0.5, 1], // g
        [0, 0, 1, 0.3] // b
    ]);

    // Create entity for particle system
    const entity = new pc.Entity('Emitter');
    app.root.addChild(entity);
    entity.setLocalPosition(0, 1, 0);

    // when texture is loaded add particlesystem component to entity
    entity.addComponent('particlesystem', {
        numParticles: 150,
        lifetime: 1,
        rate: 0.01,
        scaleGraph: new pc.Curve([0, 0.2, 1, 0.7]),
        velocityGraph: worldVelocityCurve,
        localVelocityGraph: localVelocityCurve,
        localVelocityGraph2: localVelocityCurve2,
        colorGraph: colorCurve,
        emitterShape: pc.EMITTERSHAPE_SPHERE,
        emitterRadius: 1,

        // mesh asset and rendering settings
        renderAsset: assets.torus.resource.renders[0],
        blendType: pc.BLEND_NONE,
        depthWrite: true,
        lighting: true,
        halfLambert: true,
        alignToMotion: true
    });
});

export { app };

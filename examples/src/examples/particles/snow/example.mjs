// @config
//
// A particle system emits large, slowly falling snowflakes. Depth softening fades each flake where it
// meets the ground and other geometry, which is what makes their depth readable.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    CameraFrame,
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
    SHADOW_PCF3_32F,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
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

await new Promise((resolve) => {
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

// Night scene: a dark blue sky lit only by the moon
const nightColor = new Color(0.02, 0.03, 0.07);
app.scene.ambientLight = new Color(0.06, 0.08, 0.14);

// Create an Entity with a camera component
const cameraEntity = new Entity();
cameraEntity.addComponent('camera', {
    clearColor: nightColor,
    fov: 50
});
cameraEntity.setLocalPosition(0, 6, 13);

// Tone mapping, bloom and vignette
const cameraFrame = new CameraFrame(app, cameraEntity.camera);
cameraFrame.rendering.toneMapping = TONEMAP_ACES;
cameraFrame.bloom.intensity = 0.03;
cameraFrame.vignette.intensity = 0.7;
cameraFrame.update();

// Add camera controls
cameraEntity.addComponent('script');
cameraEntity.script.create(CameraControls, {
    properties: {
        enableFly: false,
        focusPoint: new Vec3(0, 2.5, 0),
        pitchRange: new Vec2(-90, 90),
        zoomRange: new Vec2(0.01, 190)
    }
});

// Cool moonlight with shadows
const moon = new Entity('moon');
moon.addComponent('light', {
    type: 'directional',
    color: new Color(0.55, 0.7, 1),
    intensity: 1.4,
    castShadows: true,
    shadowType: SHADOW_PCF3_32F,
    shadowDistance: 40,
    shadowResolution: 2048,
    normalOffsetBias: 0.05
});
moon.setLocalEulerAngles(55, 150, 0);

app.root.addChild(cameraEntity);
app.root.addChild(moon);

// Materials
const snowMaterial = new StandardMaterial();
snowMaterial.diffuse = new Color(0.9, 0.93, 1);
snowMaterial.gloss = 0.3;
snowMaterial.useMetalness = true;
snowMaterial.metalness = 0;
snowMaterial.update();

const needleMaterial = new StandardMaterial();
needleMaterial.diffuse = new Color(0.08, 0.2, 0.14);
needleMaterial.useMetalness = true;
needleMaterial.metalness = 0;
needleMaterial.gloss = 0.2;
needleMaterial.update();

const trunkMaterial = new StandardMaterial();
trunkMaterial.diffuse = new Color(0.2, 0.12, 0.08);
trunkMaterial.useMetalness = true;
trunkMaterial.metalness = 0;
trunkMaterial.update();

// Set up random downwards velocity from -0.6 to -1.0
const velocityCurve = new CurveSet([
    [0, 0], // x
    [0, -1.0], // y
    [0, 0] // z
]);
const velocityCurve2 = new CurveSet([
    [0, 0], // x
    [0, -0.6], // y
    [0, 0] // z
]);

// Set up random rotation speed from -100 to 100 degrees per second
const rotCurve = new Curve([0, 100]);
const rotCurve2 = new Curve([0, -100]);

// Scale is constant at 0.1
const scaleCurve = new Curve([0, 0.2]);

// Slight blue tint, constant over the lifetime
const colorCurve = new CurveSet([
    [0, 0.72], // r
    [0, 0.84], // g
    [0, 1] // b
]);

// Create entity for particle system
const entity = new Entity();
app.root.addChild(entity);
entity.setLocalPosition(0, 9, 0);

entity.addComponent('particlesystem', {
    numParticles: 600,
    lifetime: 10,
    rate: 0.0167,
    startAngle: 360,
    startAngle2: -360,
    emitterExtents: new Vec3(24, 2, 24),
    velocityGraph: velocityCurve,
    velocityGraph2: velocityCurve2,
    scaleGraph: scaleCurve,
    rotationSpeedGraph: rotCurve,
    rotationSpeedGraph2: rotCurve2,
    colorGraph: colorCurve,
    colorMap: assets.snowflake.resource,
    preWarm: true,
    depthSoftening: 0.08
});

// Snowy ground
const ground = new Entity('ground');
ground.addComponent('render', {
    type: 'cylinder',
    material: snowMaterial,
    receiveShadows: true
});
ground.setLocalScale(40, 0.2, 40);
ground.setLocalPosition(0, -0.1, 0);
app.root.addChild(ground);

// A few pine trees made from cones, with snow caps, scattered around the emitter
const treePositions = [
    [-6, -4, 1.3],
    [5.5, -5, 1.6],
    [-4.5, 3, 1],
    [7, 2.5, 1.2],
    [-8.5, -1, 1.5],
    [1, -8, 1.8],
    [3.5, 5.5, 0.9]
];
treePositions.forEach(([x, z, size]) => {
    const tree = new Entity('tree');
    tree.setLocalPosition(x, 0, z);
    app.root.addChild(tree);

    const trunk = new Entity('trunk');
    trunk.addComponent('render', { type: 'cylinder', material: trunkMaterial, castShadows: true });
    trunk.setLocalScale(0.4 * size, 1 * size, 0.4 * size);
    trunk.setLocalPosition(0, 0.5 * size, 0);
    tree.addChild(trunk);

    for (let i = 0; i < 3; i++) {
        const s = (3 - i) * 0.9 * size;
        const y = (1.4 + i * 1.2) * size;

        const needles = new Entity('needles');
        needles.addComponent('render', {
            type: 'cone',
            material: needleMaterial,
            castShadows: true,
            receiveShadows: true
        });
        needles.setLocalScale(s, 2 * size, s);
        needles.setLocalPosition(0, y + size, 0);
        tree.addChild(needles);

        // Slightly smaller, higher snow cone on top of each tier
        const snow = new Entity('snow');
        snow.addComponent('render', { type: 'cone', material: snowMaterial, receiveShadows: true });
        snow.setLocalScale(s * 0.82, 1.5 * size, s * 0.82);
        snow.setLocalPosition(0, y + size + 0.35 * size, 0);
        tree.addChild(snow);
    }
});

data.on('*:set', (/** @type {string} */ _path, _value) => {
    // Toggle the depth softening on the particle system and the scene depth map on the camera frame
    const soft = data.get('data.soft');
    entity.particlesystem.depthSoftening = soft ? 0.08 : 0;
    cameraFrame.rendering.sceneDepthMap = soft;
    cameraFrame.update();
});

// Initial values
data.set('data', {
    soft: true
});

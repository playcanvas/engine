import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_NONE,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    CURVE_LINEAR,
    Curve,
    CurveSet,
    EMITTERSHAPE_SPHERE,
    Entity,
    FILLMODE_FILL_WINDOW,
    FOG_LINEAR,
    Keyboard,
    LAYERID_UI,
    LAYERID_WORLD,
    LightComponentSystem,
    Mesh,
    MeshInstance,
    Mouse,
    PIXELFORMAT_SRGBA8,
    ParticleSystemComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_NEUTRAL,
    Texture,
    TextureHandler,
    TorusGeometry,
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
    torus: new Asset('torus', 'container', { url: './assets/models/torus.glb' }),
    envAtlas: new Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/studio-env-atlas.png' },
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

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// A dark stage: the floor fades into the black background, so it has no visible edge
const backgroundColor = new Color(0, 0, 0);
app.scene.fog.type = FOG_LINEAR;
app.scene.fog.color = backgroundColor;
app.scene.fog.start = 10;
app.scene.fog.end = 28;

// The environment gives the glossy floor and pedestal their reflections. The camera does not
// render the skybox layer, so it is not visible.
app.scene.envAtlas = assets.envAtlas.resource;
app.scene.skyboxIntensity = 0.4;

// Mesh particles are not lit by the environment, only by the ambient light and directional lights
app.scene.ambientLight = new Color(0.16, 0.12, 0.22);

// Create an Entity with a camera component
const cameraEntity = new Entity('Camera');
cameraEntity.addComponent('camera', {
    clearColor: backgroundColor,
    layers: [LAYERID_WORLD, LAYERID_UI]
});
cameraEntity.setPosition(0, 3.5, 13.5);

cameraEntity.addComponent('script');
cameraEntity.script.create(CameraControls, {
    properties: {
        enableFly: false,
        focusPoint: new Vec3(0, 3.6, 0),
        pitchRange: new Vec2(-90, 5),
        zoomRange: new Vec2(4, 30)
    }
});
app.root.addChild(cameraEntity);

// The neutral tone mapping keeps the particle colors, and the bloom makes the highlights glow
const cameraFrame = new CameraFrame(app, cameraEntity.camera);
cameraFrame.rendering.samples = 4;
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;
cameraFrame.bloom.intensity = 0.02;
cameraFrame.bloom.blurLevel = 5;
cameraFrame.vignette.intensity = 0.5;
cameraFrame.vignette.inner = 0.4;
cameraFrame.vignette.outer = 1.3;
cameraFrame.update();

/**
 * @param {Color} color - The diffuse color.
 * @param {number} gloss - The glossiness, 0-1 range.
 * @param {number} metalness - The metalness, 0-1 range.
 * @returns {StandardMaterial} The material.
 */
const createMaterial = (color, gloss, metalness) => {
    const material = new StandardMaterial();
    material.diffuse = color;
    material.gloss = gloss;
    material.metalness = metalness;
    material.useMetalness = true;
    material.update();
    return material;
};

// A large glossy floor
const floor = new Entity('Floor');
floor.addComponent('render', {
    type: 'plane',
    material: createMaterial(new Color(0.06, 0.05, 0.09), 0.6, 0)
});
floor.setLocalScale(80, 1, 80);
app.root.addChild(floor);

// The pedestal the particles erupt from, with a thin glowing ring around its top
const pedestal = new Entity('Pedestal');
pedestal.addComponent('render', {
    type: 'cylinder',
    material: createMaterial(new Color(0.1, 0.09, 0.12), 0.85, 0.6)
});
pedestal.setLocalScale(3, 0.8, 3);
pedestal.setLocalPosition(0, 0.4, 0);
app.root.addChild(pedestal);

const ringMaterial = new StandardMaterial();
ringMaterial.diffuse = new Color(0, 0, 0);
ringMaterial.emissive = new Color(1, 0.55, 0.3);
ringMaterial.emissiveIntensity = 8;
ringMaterial.update();

const ringMesh = Mesh.fromGeometry(device, new TorusGeometry({ ringRadius: 1.5, tubeRadius: 0.04, segments: 64 }));
const ring = new Entity('Ring');
ring.addComponent('render', {
    meshInstances: [new MeshInstance(ringMesh, ringMaterial)]
});
ring.setLocalPosition(0, 0.8, 0);
app.root.addChild(ring);

// A warm light above the pedestal, spilling its glow onto the floor
const glow = new Entity('Glow');
glow.addComponent('light', {
    type: 'omni',
    color: new Color(1, 0.55, 0.3),
    intensity: 3,
    range: 8
});
glow.setLocalPosition(0, 1.5, 0);
app.root.addChild(glow);

// A warm key light from the front left, and a cool rim light from behind. These two, and the
// ambient light, shade the particles.
const keyLight = new Entity('Key Light');
keyLight.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.85, 0.7),
    intensity: 1.4
});
keyLight.setLocalEulerAngles(45, -30, 30);
app.root.addChild(keyLight);

const rimLight = new Entity('Rim Light');
rimLight.addComponent('light', {
    type: 'directional',
    color: new Color(0.45, 0.55, 1),
    intensity: 1.2
});
rimLight.setLocalEulerAngles(-60, 150, 0);
app.root.addChild(rimLight);

// A procedural texture with diagonal stripes, which shows how the particles are textured using
// the mesh UVs. The particle colors tint it.
const stripes = new Texture(device, {
    name: 'Stripes',
    width: 64,
    height: 64,
    format: PIXELFORMAT_SRGBA8
});
const pixels = stripes.lock();
for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
        const value = ((x + y) >> 3) & 1 ? 255 : 120;
        const i = (y * 64 + x) * 4;
        pixels[i] = pixels[i + 1] = pixels[i + 2] = value;
        pixels[i + 3] = 255;
    }
}
stripes.unlock();

// Particles shoot upwards with a random sideways spread ...
const localVelocityCurve = new CurveSet([
    [0, -1.4],
    [0, 8],
    [0, -1.4]
]);
const localVelocityCurve2 = new CurveSet([
    [0, 1.4],
    [0, 10],
    [0, 1.4]
]);

// ... and gravity pulls them back down. The downward velocity grows linearly, so they fly in arcs.
const worldVelocityCurve = new CurveSet([
    [0, 0],
    [0, 0, 1, -18],
    [0, 0]
]);
worldVelocityCurve.type = CURVE_LINEAR;

// Each particle picks a random color between these two graphs, changing from gold to pink to violet
// over its lifetime
const colorCurve = new CurveSet([
    [0, 1, 0.5, 1, 1, 0.6],
    [0, 0.75, 0.5, 0.35, 1, 0.3],
    [0, 0.3, 0.5, 0.55, 1, 1]
]);
const colorCurve2 = new CurveSet([
    [0, 1, 0.5, 0.9, 1, 0.35],
    [0, 0.55, 0.5, 0.2, 1, 0.45],
    [0, 0.15, 0.5, 0.7, 1, 1]
]);

// Particles pop in, hold their size, and shrink away as they fall back down
const scaleCurve = new Curve([0, 0, 0.08, 0.3, 0.8, 0.28, 1, 0]);
const scaleCurve2 = new Curve([0, 0, 0.08, 0.2, 0.8, 0.18, 1, 0]);

// Create entity for particle system, at the top of the pedestal
const entity = new Entity('Emitter');
app.root.addChild(entity);
entity.setLocalPosition(0, 1, 0);

entity.addComponent('particlesystem', {
    numParticles: 150,
    lifetime: 2.5,
    rate: 0.016,
    preWarm: true,
    scaleGraph: scaleCurve,
    scaleGraph2: scaleCurve2,
    velocityGraph: worldVelocityCurve,
    localVelocityGraph: localVelocityCurve,
    localVelocityGraph2: localVelocityCurve2,
    colorGraph: colorCurve,
    colorGraph2: colorCurve2,
    intensity: 1.2,
    emitterShape: EMITTERSHAPE_SPHERE,
    emitterRadius: 0.5,

    // Mesh asset and rendering settings
    renderAsset: assets.torus.resource.renders[0],
    blendType: BLEND_NONE,
    depthWrite: true,
    lighting: true,
    halfLambert: true,
    alignToMotion: true,

    // Texture applied to the mesh particles using the mesh UVs
    colorMap: stripes
});

data.set('settings', {
    lifetime: 2.5,
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
        entity.particlesystem.colorMap = value ? stripes : null;
        return;
    }

    entity.particlesystem[propertyName] = value;
});

app.on('destroy', () => {
    cameraFrame.destroy();
    ringMesh.destroy();
    stripes.destroy();
});

// @config
//
// A reflection probe renders the room into a cubemap at runtime, prefiltered into an environment
// atlas that the room and the objects in it reflect, and are lit by. Turn the reflections off to see
// what they add: the materials then use a constant ambient light. Box projection maps the
// reflections onto the walls of the room, so they line up with what they reflect. Turn it off to
// compare with a reflection at an infinite distance. The chrome sphere and the gold torus are on a
// layer the probe does not render, so they do not appear in the reflections.

import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BoundingBox,
    CUBEPROJ_BOX,
    CUBEPROJ_NONE,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    Entity,
    EnvLighting,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    Layer,
    LightComponentSystem,
    Mouse,
    PIXELFORMAT_RGBA8,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF5_16F,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TEXTUREPROJECTION_EQUIRECT,
    TEXTURETYPE_RGBM,
    TONEMAP_ACES,
    Texture,
    TextureHandler,
    TextureRenderer,
    TouchDevice,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

/**
 * @import { Material, RenderComponent } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    room: new Asset('room', 'container', { url: './assets/models/area-lights-room.glb' }),
    statue: new Asset('statue', 'container', { url: './assets/models/statue.glb' }),
    normal: new Asset('normal', 'texture', { url: './assets/textures/normal-map.png' }),
    cubemapRenderer: new Asset('cubemapRenderer', 'script', { url: './scripts/utils/cubemap-renderer.js' })
};

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType]
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler];

const app = new AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

data.set('settings', {
    reflections: {
        enabled: true,
        updateFrequency: 10,
        boxProjection: true,
        reflectivity: 1,
        showCubemap: false
    },
    material: {
        floorRoughness: 0.05,
        floorMetalness: 0.7,
        sphereRoughness: 0.05,
        sphereMetalness: 1,
        sphereBumpiness: 0
    },
    scene: {
        animate: true
    }
});

const lighting = app.scene.lighting;
lighting.shadowsEnabled = true;
lighting.shadowType = SHADOW_PCF5_16F;
lighting.shadowAtlasResolution = 2048;

const worldLayer = app.scene.layers.getLayerByName('World');
const uiLayer = app.scene.layers.getLayerByName('UI');

// The debug preview of the cubemap is drawn on the UI layer, which only the main camera renders
const textures = new TextureRenderer(app);
textures.layer = uiLayer;

// A layer for the objects the probe does not render. They are lit by the lights on both layers.
const excludedLayer = new Layer({ name: 'Excluded' });
app.scene.layers.insert(excludedLayer, app.scene.layers.getTransparentIndex(worldLayer) + 1);
const LIGHT_LAYERS = [worldLayer.id, excludedLayer.id];

// The environment atlas the cubemap rendered by the probe is prefiltered into, holding the
// reflection for each level of roughness
const envAtlas = new Texture(app.graphicsDevice, {
    width: 512,
    height: 512,
    format: PIXELFORMAT_RGBA8,
    type: TEXTURETYPE_RGBM,
    projection: TEXTUREPROJECTION_EQUIRECT,
    addressU: ADDRESS_CLAMP_TO_EDGE,
    addressV: ADDRESS_CLAMP_TO_EDGE,
    mipmaps: false
});

// The box projection uses the inside of the room. The probe renders from the center of the box,
// which is where box projection expects the cubemap to be rendered from.
const roomBox = new BoundingBox(new Vec3(0, 3.25, 0), new Vec3(8, 3.25, 9));

/** @type {StandardMaterial[]} */
const reflectiveMaterials = [];

/**
 * Makes a material reflect the environment atlas rendered by the probe.
 *
 * @param {StandardMaterial} material - The material.
 */
const addReflections = (material) => {
    material.envAtlas = envAtlas;
    material.cubeMapProjectionBox = roomBox;
    reflectiveMaterials.push(material);
};

// The room, with the floor plates, ribbed walls with three door recesses and a ceiling with a
// skylight, and the statue. Both reflect the room.
const room = assets.room.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
app.root.addChild(room);

const statue = assets.statue.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
statue.setLocalScale(0.12, 0.12, 0.12);
statue.setLocalPosition(-4, 0.55, 0.8);
statue.setLocalEulerAngles(0, 25, 0);
app.root.addChild(statue);

// the glTF materials are standard materials
[assets.room, assets.statue].forEach((asset) => {
    asset.resource.materials.forEach((material) => addReflections(/** @type {StandardMaterial} */ (material.resource)));
});

const floorMaterial = /** @type {StandardMaterial} */ (
    assets.room.resource.materials.find((asset) => asset.resource.name === 'Floor').resource
);

/**
 * Creates a primitive.
 *
 * @param {RenderComponent['type']} type - The primitive type.
 * @param {Material} material - The material.
 * @param {Vec3} position - The position.
 * @param {Vec3} scale - The scale.
 * @param {number[]} [layers] - The layers the primitive is rendered on.
 * @returns {Entity} The primitive.
 */
const createPrimitive = (type, material, position, scale, layers = [worldLayer.id]) => {
    const entity = new Entity();
    entity.addComponent('render', { type, material, layers });
    entity.setLocalPosition(position);
    entity.setLocalScale(scale);
    app.root.addChild(entity);
    return entity;
};

/**
 * Creates a material for a reflective object.
 *
 * @param {Color} color - The color of the material.
 * @returns {StandardMaterial} The material.
 */
const createReflectiveMaterial = (color) => {
    const material = new StandardMaterial();
    material.diffuse = color;
    material.useMetalness = true;
    material.metalness = 1;

    // the gloss is the roughness, the same as the materials of the room
    material.glossInvert = true;
    addReflections(material);
    return material;
};

// The chrome sphere on the center pedestal, with a normal map to make it bumpy
const sphereMaterial = createReflectiveMaterial(new Color(0.95, 0.95, 0.95));
sphereMaterial.normalMap = assets.normal.resource;
sphereMaterial.normalMapTiling.set(5, 5);
createPrimitive('sphere', sphereMaterial, new Vec3(0, 1.26, 0), new Vec3(1.8, 1.8, 1.8), [excludedLayer.id]);

// A gold torus spinning on the right pedestal
const torusMaterial = createReflectiveMaterial(new Color(1, 0.77, 0.34));
torusMaterial.gloss = 0.25;
const torusPivot = new Entity('Torus');
torusPivot.setLocalPosition(4, 1.29, 0.8);
app.root.addChild(torusPivot);
const torus = createPrimitive('torus', torusMaterial, Vec3.ZERO, new Vec3(1.5, 1.5, 1.5), [excludedLayer.id]);
torus.setLocalEulerAngles(90, 0, 0);
torusPivot.addChild(torus);

/**
 * Creates an emissive material.
 *
 * @param {Color} color - The emissive color.
 * @param {number} intensity - The emissive intensity.
 * @returns {StandardMaterial} The material.
 */
const createEmissiveMaterial = (color, intensity) => {
    const material = new StandardMaterial();
    material.useLighting = false;
    material.diffuse = Color.BLACK;
    material.emissive = color;
    material.emissiveIntensity = intensity;
    material.update();
    return material;
};

// The glowing doors, with a spot light in each of them, shining into the room
const DOORS = [
    { x: -4.5, color: new Color(1, 0.42, 0.12) },
    { x: 0, color: new Color(0.25, 0.8, 1) },
    { x: 4.5, color: new Color(1, 0.8, 0.35) }
];
DOORS.forEach(({ x, color }, i) => {
    createPrimitive('box', createEmissiveMaterial(color, 4), new Vec3(x, 1.7, -9.45), new Vec3(1.7, 3.3, 0.02));

    // the spot light shines down its -Y axis, so it is turned to face the room
    const light = new Entity(`Door ${i}`);
    light.addComponent('light', {
        type: 'spot',
        layers: LIGHT_LAYERS,
        color,
        intensity: 1.5,
        range: 20,
        innerConeAngle: 50,
        outerConeAngle: 80,
        castShadows: true,
        shadowBias: 0.2,
        normalOffsetBias: 0.05
    });
    light.setLocalPosition(x, 1.7, -9.2);
    light.setLocalEulerAngles(-90, 0, 0);
    app.root.addChild(light);
});

// A screen above the middle door, playing a video
const videoTexture = new Texture(app.graphicsDevice, {
    format: PIXELFORMAT_RGBA8,
    mipmaps: false,
    minFilter: FILTER_LINEAR,
    magFilter: FILTER_LINEAR,
    addressU: ADDRESS_CLAMP_TO_EDGE,
    addressV: ADDRESS_CLAMP_TO_EDGE
});

const video = document.createElement('video');
video.loop = true;
video.muted = true;
video.autoplay = true;
video.playsInline = true;
video.crossOrigin = 'anonymous';
video.setAttribute(
    'style',
    'display: block; width: 1px; height: 1px; position: absolute; opacity: 0; z-index: -1000; top: 0px; pointer-events: none'
);
video.src = './assets/video/SampleVideo_1280x720_1mb.mp4';
document.body.append(video);
video.addEventListener('loadedmetadata', () => videoTexture.resize(video.videoWidth, video.videoHeight));
video.addEventListener('canplaythrough', () => videoTexture.setSource(video));
app.on('destroy', () => video.remove());

const screenMaterial = createEmissiveMaterial(Color.WHITE, 1.2);
screenMaterial.emissiveMap = videoTexture;
screenMaterial.update();
const screen = createPrimitive('plane', screenMaterial, new Vec3(0, 4.75, -8.58), new Vec3(3.4, 1, 1.91));
screen.setLocalEulerAngles(90, 0, 0);

const frameMaterial = new StandardMaterial();
frameMaterial.diffuse = new Color(0.02, 0.02, 0.025);
frameMaterial.update();
createPrimitive('box', frameMaterial, new Vec3(0, 4.75, -8.62), new Vec3(3.5, 2.01, 0.06));

// A glowing orb drifting around the room, which the probe renders into the reflections
const orb = new Entity('Orb');
orb.addComponent('light', {
    type: 'omni',
    layers: LIGHT_LAYERS,
    color: new Color(0.8, 0.88, 1),
    intensity: 1.5,
    range: 10,
    castShadows: true,
    shadowBias: 0.2,
    normalOffsetBias: 0.05
});
orb.addComponent('render', {
    type: 'sphere',
    material: createEmissiveMaterial(new Color(0.8, 0.88, 1), 6),
    castShadows: false
});
orb.setLocalScale(0.4, 0.4, 0.4);
app.root.addChild(orb);

// The sky shows through the skylight and the windows
const SKY_COLOR = new Color(0.45, 0.6, 0.8);

// With the reflections off, the materials fall back to a constant ambient light, tinted by the sky
app.scene.ambientLight = new Color(0.04, 0.045, 0.055);

// The camera standing at the front of the room, looking at the doors
const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: SKY_COLOR,
    fov: 60,
    nearClip: 0.1,
    farClip: 100,
    layers: [worldLayer.id, excludedLayer.id, uiLayer.id]
});
camera.addComponent('script');
camera.setLocalPosition(1.3, 2.5, 6.8);
app.root.addChild(camera);

// The camera orbits all the way around, and the pitch and zoom ranges keep it inside the room
const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = new Vec3(0, 1.5, 0);
cameraControls.enableFly = false;
cameraControls.pitchRange = new Vec2(-38, 8);
cameraControls.zoomRange = new Vec2(2, 7);

// Bloom makes the light sources glow
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.samples = 4;
cameraFrame.rendering.toneMapping = TONEMAP_ACES;
cameraFrame.bloom.intensity = 0.03;
cameraFrame.bloom.blurLevel = 6;
cameraFrame.vignette.intensity = 0.35;
cameraFrame.update();

// The probe, rendering the cubemap from the center of the room with the cubemapRenderer script.
// Its camera is not rendered, and only holds the properties the six faces of the cubemap are
// rendered with: the World layer, so the excluded objects are not rendered.
const probe = new Entity('Probe');
probe.addComponent('camera', {
    clearColor: SKY_COLOR,
    layers: [worldLayer.id],
    priority: -1,
    nearClip: 0.1,
    farClip: 30,
    enabled: false
});
probe.addComponent('script');
probe.script.create('cubemapRenderer', {
    attributes: {
        resolution: 256,
        mipmaps: true,
        depth: true,

        // the reflections keep the brightness of the glowing doors, the screen and the orb
        hdr: true
    }
});
probe.setPosition(roomBox.center);
app.root.addChild(probe);

// When all faces of the cubemap are rendered, prefilter it into the environment atlas, used by
// the reflections for the rest of the frame
probe.on('onCubemapPostRender', () => {
    // @ts-ignore
    EnvLighting.generateAtlas(probe.script.cubemapRenderer.cubeMap, {
        target: envAtlas
    });
});

const applySettings = () => {
    const settings = data.get('settings');

    floorMaterial.gloss = settings.material.floorRoughness;
    floorMaterial.metalness = settings.material.floorMetalness;
    sphereMaterial.gloss = settings.material.sphereRoughness;
    sphereMaterial.metalness = settings.material.sphereMetalness;
    sphereMaterial.bumpiness = settings.material.sphereBumpiness;

    const projection = settings.reflections.boxProjection ? CUBEPROJ_BOX : CUBEPROJ_NONE;
    reflectiveMaterials.forEach((material) => {
        material.envAtlas = settings.reflections.enabled ? envAtlas : null;
        material.cubeMapProjection = projection;
        material.reflectivity = settings.reflections.reflectivity;
        material.update();
    });
};
applySettings();
data.on('*:set', applySettings);

let time = 0;
let probeRendered = false;
let framesToProbe = 0;
let uploadVideo = true;
app.on('update', (/** @type {number} */ dt) => {
    const settings = data.get('settings');
    if (settings.scene.animate) {
        time += dt;
    }

    // upload the video to its texture every other frame
    if (uploadVideo) {
        videoTexture.upload();
    }
    uploadVideo = !uploadVideo;

    // the orb circles the pedestals, bobbing up and down, and the torus spins
    const orbAngle = time * 0.4;
    orb.setPosition(Math.sin(orbAngle) * 5.5, 2.2 + Math.sin(time * 1.1) * 0.6, 0.5 + Math.cos(orbAngle) * 3.2);
    torusPivot.setLocalEulerAngles(0, time * 40, 0);

    // render the probe every few frames, or just once, while the reflections are on
    const frequency = settings.reflections.updateFrequency;
    if (!settings.reflections.enabled) {
        probe.enabled = false;
    } else if (frequency === 0) {
        probe.enabled = !probeRendered;
    } else {
        framesToProbe--;
        probe.enabled = framesToProbe <= 0;
        if (probe.enabled) {
            framesToProbe = frequency;
        }
    }
    probeRendered ||= probe.enabled;

    // display the faces of the cubemap as a cross in the bottom left corner
    // @ts-ignore
    const cubeMap = probe.script.cubemapRenderer?.cubeMap;
    if (settings.reflections.showCubemap && cubeMap) {
        const aspect = app.graphicsDevice.width / app.graphicsDevice.height;
        const width = 0.4;
        const height = width * 0.75 * aspect;
        textures.draw(cubeMap, 0.02, 0.98 - height, width, height);
    }
});

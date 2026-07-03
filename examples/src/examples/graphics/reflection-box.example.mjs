import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BoundingBox,
    CUBEPROJ_BOX,
    CameraComponentSystem,
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
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TEXTUREPROJECTION_EQUIRECT,
    TEXTURETYPE_RGBM,
    Texture,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

/**
 * @import { Material } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    script1: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    script2: new Asset('script', 'script', { url: './scripts/utils/cubemap-renderer.js' }),
    normal: new Asset('normal', 'texture', { url: './assets/textures/normal-map.png' })
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
    ScriptComponentSystem
];
createOptions.resourceHandlers = [ScriptHandler, TextureHandler, ContainerHandler];

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

data.set('settings', {
    updateFrequency: 10,
    gloss: 0.8,
    metalness: 0.9,
    bumpiness: 0.2,
    reflectivity: 0.5
});

// Get existing layers
const worldLayer = app.scene.layers.getLayerByName('World');
const uiLayer = app.scene.layers.getLayerByName('UI');

// Create a layer for object that do not render into reflection cubemap
const excludedLayer = new Layer({ name: 'Excluded' });
app.scene.layers.insert(excludedLayer, app.scene.layers.getTransparentIndex(worldLayer) + 1);

// Create an envAtlas texture, which will hold a prefiltered lighting generated from the cubemap.
// This represents a reflection prefiltered for different levels of roughness
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

// Material for the walls
const roomMaterial = new StandardMaterial();
roomMaterial.useMetalness = true;
roomMaterial.diffuse = Color.WHITE;
roomMaterial.normalMap = assets.normal.resource;
roomMaterial.normalMapTiling.set(5, 5);
roomMaterial.bumpiness = 0.1;
roomMaterial.gloss = 0.9;
roomMaterial.reflectivity = 0.3;
// @ts-ignore
roomMaterial.envAtlas = envAtlas; // use reflection from env atlas
roomMaterial.metalness = 0.5;

// The material uses box projected cubemap for reflections. Set its bounding box the the size of the room
// So that the reflections line up
roomMaterial.cubeMapProjection = CUBEPROJ_BOX;
roomMaterial.cubeMapProjectionBox = new BoundingBox(new Vec3(0, 200, 0), new Vec3(400, 200, 400));
roomMaterial.update();

// Material for the magenta emissive beams
const emissiveMaterial = new StandardMaterial();
emissiveMaterial.emissive = Color.MAGENTA;
emissiveMaterial.diffuse = Color.BLACK;
emissiveMaterial.update();

// Material for the white sphere representing an omni light
const lightMaterial = new StandardMaterial();
lightMaterial.emissive = Color.WHITE;
lightMaterial.diffuse = Color.BLACK;
lightMaterial.update();

// Material for the reflective sphere in the center
const sphereMaterial = new StandardMaterial();
sphereMaterial.useMetalness = true;
sphereMaterial.diffuse = Color.WHITE;
sphereMaterial.normalMap = assets.normal.resource;
sphereMaterial.normalMapTiling.set(5, 5);
sphereMaterial.bumpiness = 0.7;
sphereMaterial.gloss = 0.3;
sphereMaterial.metalness = 0.7;
sphereMaterial.reflectivity = 0.3;
// @ts-ignore
sphereMaterial.envAtlas = envAtlas; // use reflection from env atlas
sphereMaterial.update();
// Set up video playback into a texture
const videoTexture = new Texture(app.graphicsDevice, {
    format: PIXELFORMAT_RGBA8,
    mipmaps: false,
    minFilter: FILTER_LINEAR,
    magFilter: FILTER_LINEAR,
    addressU: ADDRESS_CLAMP_TO_EDGE,
    addressV: ADDRESS_CLAMP_TO_EDGE
});

// Create a HTML element with the video
/** @type {HTMLVideoElement} */
const video = document.createElement('video');
video.id = 'vid';
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
video.addEventListener('canplaythrough', () => {
    videoTexture.setSource(video);
});

// Listen for the 'loadedmetadata' event to resize the texture appropriately
video.addEventListener('loadedmetadata', () => {
    videoTexture.resize(video.videoWidth, video.videoHeight);
});

// Materials used on the TV screen to display the video texture
const screenMaterial = new StandardMaterial();
screenMaterial.useLighting = false;
screenMaterial.emissiveMap = videoTexture;
screenMaterial.emissive = Color.WHITE;
screenMaterial.update();

/**
 * Helper function to create a 3d primitive including its material.
 *
 * @param {string} primitiveType - The primitive type.
 * @param {Vec3} position - The position.
 * @param {Vec3} scale - The scale.
 * @param {Material} material - The material.
 */
function createPrimitive(primitiveType, position, scale, material) {
    // Create the primitive using the material
    const primitive = new Entity();
    primitive.addComponent('render', {
        type: primitiveType,
        material: material,
        layers: [worldLayer.id, excludedLayer.id],
        castShadows: false,
        receiveShadows: false
    });

    // Set position and scale and add it to scene
    primitive.setLocalPosition(position);
    primitive.setLocalScale(scale);
    app.root.addChild(primitive);
}

// Create the ground plane from the boxes
createPrimitive('box', new Vec3(0, 0, 0), new Vec3(800, 2, 800), roomMaterial);
createPrimitive('box', new Vec3(0, 400, 0), new Vec3(800, 2, 800), roomMaterial);

// Walls
createPrimitive('box', new Vec3(400, 200, 0), new Vec3(2, 400, 800), roomMaterial);
createPrimitive('box', new Vec3(-400, 200, 0), new Vec3(2, 400, 800), roomMaterial);
createPrimitive('box', new Vec3(0, 200, -400), new Vec3(800, 400, 0), roomMaterial);
createPrimitive('box', new Vec3(0, 200, 400), new Vec3(800, 400, 0), roomMaterial);

// Emissive pillars
createPrimitive('box', new Vec3(400, 200, -50), new Vec3(20, 400, 20), emissiveMaterial);
createPrimitive('box', new Vec3(400, 200, 50), new Vec3(20, 400, 20), emissiveMaterial);
createPrimitive('box', new Vec3(-400, 200, 50), new Vec3(20, 400, 20), emissiveMaterial);
createPrimitive('box', new Vec3(-400, 200, -50), new Vec3(20, 400, 20), emissiveMaterial);
createPrimitive('box', new Vec3(0, 400, 50), new Vec3(800, 20, 20), emissiveMaterial);
createPrimitive('box', new Vec3(0, 400, -50), new Vec3(800, 20, 20), emissiveMaterial);

// Screen
createPrimitive('box', new Vec3(0, 200, 400), new Vec3(500, 250, 5), screenMaterial);

// Shiny sphere
const sphereEntity = new Entity();
sphereEntity.addComponent('render', {
    type: 'sphere',
    material: sphereMaterial,
    castShadows: false,
    receiveShadows: false
});
sphereEntity.setLocalScale(300, 300, 300);
sphereEntity.setLocalPosition(0, 150, 0);
app.root.addChild(sphereEntity);

// Create an omni light white orbits the room to avoid it being completely dark
const lightOmni = new Entity();
lightOmni.addComponent('light', {
    type: 'omni',
    layers: [excludedLayer.id], // add it to excluded layer, we don't want the light captured in the reflection
    castShadows: false,
    color: Color.WHITE,
    intensity: 0.2,
    range: 1000
});

// Add a white sphere to light so that we can see where it is. This sphere is excluded from the reflections.
lightOmni.addComponent('render', {
    type: 'sphere',
    layers: [excludedLayer.id],
    material: lightMaterial,
    castShadows: false,
    receiveShadows: false
});
lightOmni.setLocalScale(20, 20, 20);
app.root.addChild(lightOmni);

// Create an Entity with a camera component
const camera = new Entity('MainCamera');
camera.addComponent('camera', {
    fov: 100,
    layers: [worldLayer.id, excludedLayer.id, uiLayer.id],
    farClip: 1500
});
camera.setLocalPosition(270, 90, -260);

// Add orbit camera script with a mouse and a touch support
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        distanceMax: 390,
        frameOnStart: false
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);

// Create a probe object with cubemapRenderer script which takes care of rendering dynamic cubemap
const probe = new Entity('probeCamera');
probe.addComponent('script');

// Add camera component to the probe - this defines camera properties for cubemap rendering
probe.addComponent('camera', {
    // Optimization - no need to clear as all pixels get overwritten
    clearColorBuffer: false,

    // Priority - render before world camera
    priority: -1,

    // Only render meshes on the worldLayer (and not excluded layer)
    layers: [worldLayer.id],

    // Disable as this is not a camera that renders cube map but only a container for properties for cube map rendering
    enabled: false,

    nearClip: 1,
    farClip: 500
});

// Add a cubemap renderer script, which renders to a cubemap of size 128 with mipmaps, which is directly usable
// As a lighting source for envAtlas generation
// Position it in the center of the room.
probe.script.create('cubemapRenderer', {
    attributes: {
        resolution: 128,
        mipmaps: true,
        depth: true
    }
});
probe.setPosition(0, 200, 0);
app.root.addChild(probe);

// Handle onCubemapPostRender event fired by the cubemapRenderer when all faces of the cubemap are done rendering
probe.on('onCubemapPostRender', () => {
    // Prefilter just rendered cubemap into envAtlas, so that it can be used for reflection during the rest of the frame
    // @ts-ignore
    EnvLighting.generateAtlas(probe.script.cubemapRenderer.cubeMap, {
        target: envAtlas
    });
});

// Set an update function on the app's update event
let time = 0;
let updateProbeCount = 1;
let updateVideo = true;
app.on('update', (/** @type {number} */ dt) => {
    time += dt * 0.3;

    // Update the video data to the texture every other frame
    if (updateVideo && videoTexture) {
        videoTexture.upload();
    }
    updateVideo = !updateVideo;

    // Move the light around
    lightOmni.setLocalPosition(300 * Math.sin(time), 300, 300 * Math.cos(time));

    // Update the reflection probe as needed
    const updateFrequency = data.get('settings.updateFrequency');
    updateProbeCount--;
    if (updateFrequency === 0) updateProbeCount = 1;

    if (updateProbeCount <= 0) {
        // Enable probe rendering
        probe.enabled = true;
        updateProbeCount = updateFrequency;
    } else {
        probe.enabled = false;
    }

    // Update material properties based on settings
    const gloss = data.get('settings.gloss');
    const metalness = data.get('settings.metalness');
    const bumpiness = data.get('settings.bumpiness');
    const reflectivity = data.get('settings.reflectivity');

    roomMaterial.gloss = gloss;
    roomMaterial.metalness = metalness;
    roomMaterial.bumpiness = bumpiness;
    roomMaterial.reflectivity = reflectivity;
    roomMaterial.update();

    sphereMaterial.gloss = gloss;
    sphereMaterial.metalness = metalness;
    sphereMaterial.bumpiness = bumpiness;
    sphereMaterial.reflectivity = reflectivity;
    sphereMaterial.update();
});

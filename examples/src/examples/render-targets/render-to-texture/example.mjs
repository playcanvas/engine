// @config
//
// A drone circles a statue, its camera rendering into a texture, shown on the hanging screen and in
// the corner of the view.

import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_ADDITIVE,
    BoundingBox,
    CUBEPROJ_BOX,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Curve,
    CurveSet,
    Entity,
    FILLMODE_FILL_WINDOW,
    Layer,
    LightComponentSystem,
    Mouse,
    PIXELFORMAT_SRGBA8,
    PROJECTION_ORTHOGRAPHIC,
    PROJECTION_PERSPECTIVE,
    ParticleSystemComponentSystem,
    RENDERTARGET_ORIGIN_TOP,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RenderTarget,
    ScriptComponentSystem,
    StandardMaterial,
    TEXTURETYPE_RGBP,
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
 * @import { RenderComponent } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    room: new Asset('room', 'container', { url: './assets/models/area-lights-room.glb' }),
    statue: new Asset('statue', 'container', { url: './assets/models/statue.glb' }),
    drone: new Asset('drone', 'container', { url: './assets/models/drone.glb' }),
    spark: new Asset('spark', 'texture', { url: './assets/textures/spark.png' }, { srgb: true }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),

    // the room rendered into a cubemap from the center of the room, prefiltered into an environment
    // atlas, holding the reflection for each level of roughness
    roomEnvAtlas: new Asset(
        'room-env-atlas',
        'texture',
        { url: './assets/cubemaps/area-lights-room-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType],

    // Request the main back-buffer's MSAA color and depth attachments to be allocated as transient
    // ("memoryless") attachments. On tile-based GPUs (mobile / Apple Silicon) this lets the driver
    // keep their contents in fast on-chip memory and skip VRAM allocation entirely. This is valid
    // here because the back-buffer is cleared each frame and never read back: there is no scene
    // color grab (sceneColorMap) and no scene depth grab (sceneDepthMap) / depth prepass. These are
    // WebGPU-only hints and are silently ignored on WebGL2 or where the feature is unsupported.
    transientColor: true,
    transientDepth: true
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
    ScriptComponentSystem,
    ParticleSystemComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

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
    projection: 'alternate',
    speed: 1,
    overlay: true
});

// The layers:
// - World: the room, rendered by both cameras
// - Skybox: the sky, rendered by both cameras
// - Excluded: the drone and the screen, rendered only by the main camera, so they are not in the
//   picture the drone camera renders
const worldLayer = app.scene.layers.getLayerByName('World');
const skyboxLayer = app.scene.layers.getLayerByName('Skybox');
const uiLayer = app.scene.layers.getLayerByName('UI');
const immediateLayer = app.scene.layers.getLayerByName('Immediate');
const excludedLayer = new Layer({ name: 'Excluded' });
app.scene.layers.insert(excludedLayer, 1);

// The sky, at the full resolution of its environment atlas, shows through the windows and the
// skylight of the room
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 0;
app.scene.exposure = 0.6;

// The box projection uses the inside of the room, the cubemap was rendered from its center
const roomBox = new BoundingBox(new Vec3(0, 3.25, 0), new Vec3(8, 3.25, 9));

/**
 * Makes a material reflect the room, and be lit by it.
 *
 * @param {StandardMaterial} material - The material.
 */
const addReflections = (material) => {
    material.envAtlas = assets.roomEnvAtlas.resource;
    material.cubeMapProjection = CUBEPROJ_BOX;
    material.cubeMapProjectionBox = roomBox;
    material.update();
};

/**
 * Creates a primitive.
 *
 * @param {RenderComponent['type']} type - The primitive type.
 * @param {StandardMaterial} material - The material.
 * @param {Vec3} position - The position.
 * @param {Vec3} scale - The scale.
 * @param {Entity} parent - The parent entity.
 * @param {number[]} layers - The layers the primitive renders on.
 * @returns {Entity} The primitive.
 */
const createPrimitive = (type, material, position, scale, parent, layers) => {
    const entity = new Entity();
    entity.addComponent('render', { type, material, layers });
    entity.setLocalPosition(position);
    entity.setLocalScale(scale);
    parent.addChild(entity);
    return entity;
};

/**
 * Creates a material.
 *
 * @param {Color} color - The diffuse color.
 * @param {number} gloss - The glossiness.
 * @param {number} metalness - The metalness.
 * @returns {StandardMaterial} The material.
 */
const createMaterial = (color, gloss, metalness) => {
    const material = new StandardMaterial();
    material.diffuse = color;
    material.gloss = gloss;
    material.useMetalness = true;
    material.metalness = metalness;
    addReflections(material);
    return material;
};

// The room, with the statue on the pedestal in the middle and a sphere on each of the side
// pedestals
const room = assets.room.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
app.root.addChild(room);

const statue = assets.statue.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
statue.setLocalScale(0.15, 0.15, 0.15);
statue.setLocalPosition(0, 0.36, 0);
statue.setLocalEulerAngles(0, 30, 0);
app.root.addChild(statue);

// the glTF materials are standard materials
[assets.room, assets.statue].forEach((asset) => {
    asset.resource.materials.forEach((material) => addReflections(/** @type {StandardMaterial} */ (material.resource)));
});

// A glossy red sphere and a chrome sphere on the side pedestals
[
    { x: 4, color: new Color(0.7, 0.02, 0.02), gloss: 0.85, metalness: 0 },
    { x: -4, color: new Color(0.95, 0.95, 0.95), gloss: 0.95, metalness: 1 }
].forEach(({ x, color, gloss, metalness }) => {
    const material = createMaterial(color, gloss, metalness);
    createPrimitive('sphere', material, new Vec3(x, 1.15, 0.8), new Vec3(1.2, 1.2, 1.2), app.root, [worldLayer.id]);
});

// The glowing doors in the back wall
[
    { x: -4.5, color: new Color(1, 0.42, 0.12) },
    { x: 0, color: new Color(0.25, 0.8, 1) },
    { x: 4.5, color: new Color(1, 0.8, 0.35) }
].forEach(({ x, color }) => {
    const material = new StandardMaterial();
    material.diffuse = Color.BLACK;
    material.emissive = color;
    material.emissiveIntensity = 3;
    material.useLighting = false;
    material.update();
    createPrimitive('box', material, new Vec3(x, 1.7, -9.45), new Vec3(1.7, 3.3, 0.02), app.root, [worldLayer.id]);
});

// Sparks rising around the statue
const sparks = new Entity('Sparks');
sparks.addComponent('particlesystem', {
    numParticles: 300,
    lifetime: 2.5,
    rate: 0.01,
    emitterShape: 1,
    emitterRadius: 1.2,
    colorMap: assets.spark.resource,
    blendType: BLEND_ADDITIVE,
    depthWrite: false,
    scaleGraph: new Curve([0, 0.15, 1, 0.03]),
    alphaGraph: new Curve([0, 0, 0.1, 1, 1, 0]),
    colorGraph: new CurveSet([
        [0, 0.2, 1, 1],
        [0, 0.9, 1, 0.3],
        [0, 1, 1, 1]
    ]),
    velocityGraph: new CurveSet([
        [0, -0.3],
        [0, 1, 1, 2],
        [0, -0.3]
    ]),
    velocityGraph2: new CurveSet([
        [0, 0.3],
        [0, 1.6, 1, 2.6],
        [0, 0.3]
    ])
});
app.root.addChild(sparks);

// The light of the room, on both layers, so it lights the drone too
const light = new Entity('Light');
light.addComponent('light', {
    type: 'omni',
    color: new Color(1, 0.95, 0.9),
    intensity: 2,
    range: 20,
    castShadows: true,
    shadowBias: 0.2,
    normalOffsetBias: 0.05,
    layers: [worldLayer.id, excludedLayer.id]
});
light.setLocalPosition(1, 5.5, 4);
app.root.addChild(light);

// The texture the drone camera renders into, with a depth buffer, multi-sampled and with mipmaps,
// as the screen displays it smaller than its size
const texture = new Texture(app.graphicsDevice, {
    width: 512,
    height: 256,
    format: PIXELFORMAT_SRGBA8,
    mipmaps: true,
    addressU: ADDRESS_CLAMP_TO_EDGE,
    addressV: ADDRESS_CLAMP_TO_EDGE
});
const renderTarget = new RenderTarget({
    name: 'Drone Camera',
    colorBuffer: texture,
    depth: true,
    origin: RENDERTARGET_ORIGIN_TOP,
    samples: 2,

    // Allocate this render target's MSAA color and depth attachments as transient
    // ("memoryless") attachments (WebGPU only; ignored elsewhere). The multi-sampled color
    // buffer is only ever resolved into the single-sampled `texture` we sample below - the MSAA
    // buffer itself is never sampled, stored or reloaded - and the depth buffer is used only for
    // in-pass depth testing and is never grabbed or resolved. Both therefore only need their
    // contents within the render pass, so tile-based GPUs can keep them on-chip. Note that
    // transientColor requires MSAA (samples > 1); it is a no-op for single-sampled color.
    transientColor: true,
    transientDepth: true
});

// The drone on the Excluded layer, carrying the camera which renders into the texture. Its
// priority is lower than the main camera's, so it renders first each frame.
const drone = new Entity('Drone');
drone.addComponent('camera', {
    layers: [worldLayer.id, skyboxLayer.id],
    toneMapping: TONEMAP_ACES,
    fov: 55,
    nearClip: 0.1,
    priority: -1,
    renderTarget
});
app.root.addChild(drone);

const EXCLUDED = [excludedLayer.id];
const droneModel = assets.drone.resource.instantiateRenderEntity({ layers: EXCLUDED });
drone.addChild(droneModel);
assets.drone.resource.materials.forEach((material) =>
    addReflections(/** @type {StandardMaterial} */ (material.resource))
);

// the rotors spin each frame, the ones on opposite corners in the same direction, and the LED
// blinks
const rotors = droneModel
    .find((node) => node.name.startsWith('Rotor'))
    .map((rotor) => {
        const position = rotor.getLocalPosition();
        return { rotor, direction: Math.sign(position.x * position.z) };
    });
const led = droneModel.findByName('LED');

// The screen hanging from the ceiling above the statue, with a display on each of its four sides
// showing the picture of the drone camera
const screen = new Entity('Screen');
screen.setLocalPosition(0, 4.5, 0);
app.root.addChild(screen);
const darkMaterial = createMaterial(new Color(0.03, 0.03, 0.04), 0.8, 0.8);
createPrimitive('box', darkMaterial, Vec3.ZERO, new Vec3(2.8, 1.5, 2.8), screen, EXCLUDED);
[-0.9, 0.9].forEach((x) => {
    [-0.9, 0.9].forEach((z) => {
        createPrimitive('cylinder', darkMaterial, new Vec3(x, 1.375, z), new Vec3(0.03, 1.25, 0.03), screen, EXCLUDED);
    });
});

const screenMaterial = new StandardMaterial();
screenMaterial.diffuse = Color.BLACK;
screenMaterial.emissiveMap = texture;
screenMaterial.emissive = Color.WHITE;
screenMaterial.emissiveIntensity = 1.5;
screenMaterial.useLighting = false;
screenMaterial.update();
for (let i = 0; i < 4; i++) {
    // the plane faces up its Y axis, turned to face out of each side
    const side = new Entity();
    side.setLocalEulerAngles(0, i * 90, 0);
    screen.addChild(side);
    const display = createPrimitive(
        'plane',
        screenMaterial,
        new Vec3(0, 0, 1.42),
        new Vec3(2.6, 1, 1.3),
        side,
        EXCLUDED
    );
    display.setLocalEulerAngles(90, 0, 0);
}

// The main camera, which renders all the layers, and the picture in the corner on the UI layer
const camera = new Entity('MainCamera');
camera.addComponent('camera', {
    fov: 60,
    layers: [worldLayer.id, excludedLayer.id, skyboxLayer.id, immediateLayer.id, uiLayer.id],
    toneMapping: TONEMAP_ACES
});
camera.addComponent('script');
camera.setLocalPosition(1.3, 2.8, 6.8);
app.root.addChild(camera);

// The camera orbits all the way around, and the pitch and zoom ranges keep it inside the room
const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = new Vec3(0, 2.7, 0);
cameraControls.enableFly = false;
cameraControls.pitchRange = new Vec2(-38, 8);
cameraControls.zoomRange = new Vec2(2, 7);

const textures = new TextureRenderer(app);
textures.layer = uiLayer;

let time = 0;
let projectionTime = 0;
app.on('update', (/** @type {number} */ dt) => {
    const settings = data.get('settings');
    time += dt * settings.speed;

    // the drone orbits the statue, closer and further, and higher and lower, looking at it, but
    // never flies over it
    const angle = time * 0.4;
    const distance = 4.5 + Math.sin(time * 0.23) * 1.2;
    drone.setLocalPosition(Math.sin(angle) * distance, 2.5 + Math.sin(time * 0.31) * 0.6, Math.cos(angle) * distance);
    drone.lookAt(0, 1.5, 0);
    rotors.forEach(({ rotor, direction }) => rotor.setLocalEulerAngles(0, direction * time * 2000, 0));
    led.enabled = Math.floor(time * 2) % 2 === 0;

    // the drone camera switches between the projections every 5 seconds
    projectionTime += dt;
    let orthographic = settings.projection === 'orthographic';
    if (settings.projection === 'alternate') {
        orthographic = Math.floor(projectionTime / 5) % 2 === 1;
    }
    drone.camera.projection = orthographic ? PROJECTION_ORTHOGRAPHIC : PROJECTION_PERSPECTIVE;
    drone.camera.orthoHeight = 2.2;

    // the picture of the drone camera in the corner
    if (settings.overlay) {
        textures.draw(texture, 0.7, 0.7, 0.28, 0.28);
    }
});

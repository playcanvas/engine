// @config
//
// A kinetic sculpture of hundreds of moving shapes, rendered in a few draw calls by a dynamic batch
// group. Turn batching off to compare the number of draw calls.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BatchManager,
    BoundingBox,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    FOG_LINEAR,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF3_32F,
    ScriptComponentSystem,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    createGraphicsDevice,
    math
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

/**
 * @import { RenderComponent } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    studio: new Asset(
        'studio-env-atlas',
        'texture',
        { url: './assets/cubemaps/studio-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType]
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.batchManager = BatchManager;
createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler];

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
    batching: true,
    pattern: 'cycle',
    shape: 'sphere',
    speed: 1
});
data.set('stats', {
    drawCalls: ''
});

// The lights of a studio, reflected by the metal. The studio itself is not visible, the sculpture
// floats in a dark room, its floor fading into the darkness.
app.scene.envAtlas = assets.studio.resource;
app.scene.fog.type = FOG_LINEAR;
app.scene.fog.color = Color.BLACK;
app.scene.fog.start = 14;
app.scene.fog.end = 34;

const worldLayer = app.scene.layers.getLayerByName('World');
const immediateLayer = app.scene.layers.getLayerByName('Immediate');
const uiLayer = app.scene.layers.getLayerByName('UI');

/**
 * Creates a material.
 *
 * @param {Color} color - The color.
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
    material.update();
    return material;
};

// The materials of the shapes, in rings from the center out: gold, silver and copper
const metals = [
    createMaterial(new Color(1, 0.77, 0.34), 0.85, 1),
    createMaterial(new Color(0.95, 0.95, 0.95), 0.9, 1),
    createMaterial(new Color(0.95, 0.55, 0.4), 0.85, 1)
];

/**
 * Creates a primitive.
 *
 * @param {RenderComponent['type']} type - The primitive type.
 * @param {StandardMaterial} material - The material.
 * @param {Vec3} position - The position.
 * @param {Vec3} scale - The scale.
 * @param {boolean} castShadows - Whether the primitive casts shadows.
 * @returns {Entity} The primitive.
 */
const createPrimitive = (type, material, position, scale, castShadows) => {
    const entity = new Entity();
    entity.addComponent('render', { type, material, castShadows });
    entity.setLocalPosition(position);
    entity.setLocalScale(scale);
    app.root.addChild(entity);
    return entity;
};

// The floor
createPrimitive('plane', createMaterial(new Color(0.07, 0.07, 0.07), 0.3, 0), Vec3.ZERO, new Vec3(100, 1, 100), false);

// A dynamic batch group, so its meshes can move every frame. Its batches are split when they grow
// bigger than 20 units, which the sculpture never does.
const batchGroup = app.batcher.addGroup('Sculpture', true, 20);

// The shapes, sized to fit between their neighbors. The cone points down.
/** @type {Record<string, { scale: Vec3, tilt: number }>} */
const SHAPES = {
    sphere: { scale: new Vec3(0.22, 0.22, 0.22), tilt: 0 },
    box: { scale: new Vec3(0.17, 0.17, 0.17), tilt: 0 },
    cone: { scale: new Vec3(0.2, 0.3, 0.2), tilt: 180 },
    capsule: { scale: new Vec3(0.13, 0.15, 0.13), tilt: 0 },
    cylinder: { scale: new Vec3(0.18, 0.22, 0.18), tilt: 0 }
};
const SHAPE_NAMES = Object.keys(SHAPES);

/**
 * @typedef {object} Item
 * @property {number} x - The X position.
 * @property {number} z - The Z position.
 * @property {number} r - The distance from the center.
 * @property {number} a - The angle around the center.
 * @property {number} spin - The angle the shape is turned by.
 * @property {RenderComponent['type']} mixedShape - The shape when the shapes are mixed.
 * @property {Entity} shape - The shape.
 * @property {number} tilt - The angle the shape is tilted by.
 */

// The shapes float in a hexagonal grid filling a circle
const RADIUS = 4;
const SPACING = 0.28;
const ROW_SPACING = (SPACING * Math.sqrt(3)) / 2;

/** @type {Item[]} */
const items = [];
const rows = Math.ceil(RADIUS / ROW_SPACING);
const columns = Math.ceil(RADIUS / SPACING) + 1;
for (let row = -rows; row <= rows; row++) {
    for (let column = -columns; column <= columns; column++) {
        const x = (column + (row & 1) * 0.5) * SPACING;
        const z = row * ROW_SPACING;
        const r = Math.sqrt(x * x + z * z);
        if (r > RADIUS) continue;

        const material = metals[Math.min(Math.floor((r / RADIUS) * metals.length), metals.length - 1)];
        const shape = createPrimitive('sphere', material, Vec3.ZERO, Vec3.ONE, true);
        items.push({
            x,
            z,
            r,
            a: Math.atan2(z, x),
            spin: Math.random() * 360,
            mixedShape: /** @type {RenderComponent['type']} */ (SHAPE_NAMES[items.length % SHAPE_NAMES.length]),
            shape,
            tilt: 0
        });
    }
}

// The patterns the sculpture moves in, each giving the height of a shape between -1 and 1
/** @type {Record<string, (item: Item, t: number) => number>} */
const PATTERNS = {
    wave: (item, t) => Math.sin(item.x * 1.1 - t * 1.4),
    ripple: (item, t) => Math.sin(item.r * 2.2 - t * 1.8),
    spiral: (item, t) => Math.sin(item.a * 3 - item.r * 1.4 + t * 1.2),
    saddle: (item, t) => (Math.sin(t * 0.9) * (item.x * item.x - item.z * item.z)) / (RADIUS * RADIUS),
    dome: (item, t) => Math.cos(t * 0.8) * (1 - (2 * item.r * item.r) / (RADIUS * RADIUS))
};
const PATTERN_NAMES = Object.keys(PATTERNS);

// In the cycle, each pattern lasts for a while, the last few seconds blending into the next one
const PATTERN_DURATION = 9;
const BLEND_DURATION = 3;

// The sun, shining at the sculpture from above. Its shadow map covers just the sculpture and the
// floor around it.
const light = new Entity('Sun');
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.92, 0.8),
    intensity: 1.5,
    castShadows: true,
    shadowType: SHADOW_PCF3_32F,
    shadowResolution: 2048,
    shadowBias: 0.2,
    normalOffsetBias: 0.05
});
light.light.shadowBounds = new BoundingBox(new Vec3(0, 2.8, 0), new Vec3(7, 2.8, 7));
light.setLocalEulerAngles(50, 30, 0);
app.root.addChild(light);

// The camera, which does not render the skybox, so the studio is not visible
const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: Color.BLACK,
    fov: 55,
    nearClip: 0.1,
    farClip: 100,
    toneMapping: TONEMAP_ACES,
    layers: [worldLayer.id, immediateLayer.id, uiLayer.id]
});
camera.addComponent('script');
camera.setLocalPosition(0, 4.8, 10);
app.root.addChild(camera);

// The pitch range keeps the camera above the floor
const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = new Vec3(0, 2.6, 0);
cameraControls.enableFly = false;
cameraControls.pitchRange = new Vec2(-70, 10);
cameraControls.zoomRange = new Vec2(2, 18);

const applySettings = () => {
    const settings = data.get('settings');

    // the meshes of a different shape are added to the batches again
    items.forEach((item) => {
        const type = settings.shape === 'mixed' ? item.mixedShape : settings.shape;
        item.shape.render.type = type;
        item.shape.setLocalScale(SHAPES[type].scale);
        item.tilt = SHAPES[type].tilt;
    });

    // without a batch group, each mesh renders in its own draw call
    const batchGroupId = settings.batching ? batchGroup.id : -1;
    items.forEach((item) => {
        item.shape.render.batchGroupId = batchGroupId;
    });
};
applySettings();
data.on('settings.batching:set', applySettings);
data.on('settings.shape:set', applySettings);

let time = 0;
let statsTime = 0;
app.on('update', (/** @type {number} */ dt) => {
    const settings = data.get('settings');
    time += dt * settings.speed;

    let from = PATTERNS[settings.pattern];
    let to = from;
    let blend = 0;
    if (settings.pattern === 'cycle') {
        const index = Math.floor(time / PATTERN_DURATION);
        from = PATTERNS[PATTERN_NAMES[index % PATTERN_NAMES.length]];
        to = PATTERNS[PATTERN_NAMES[(index + 1) % PATTERN_NAMES.length]];
        const elapsed = time - index * PATTERN_DURATION;
        blend = math.smoothstep(PATTERN_DURATION - BLEND_DURATION, PATTERN_DURATION, elapsed);
    }

    // move each shape to its height, spinning slowly
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const height = math.lerp(from(item, time), to(item, time), blend);
        item.shape.setLocalPosition(item.x, 2.8 + height * 1.3, item.z);
        item.shape.setLocalEulerAngles(item.tilt, item.spin + time * 30, 0);
    }

    // the number of draw calls in the last frame, including the shadows
    statsTime -= dt;
    if (statsTime <= 0) {
        statsTime = 0.25;
        data.set('stats.drawCalls', `${app.stats.drawCalls.total}`);
    }
});

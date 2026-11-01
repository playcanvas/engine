// @config
//
// 81 clustered area lights - spheres, disks and rectangles - floating in a sunflower spiral above a
// metallic floor, which reflects them. Each light has a small range, so it only lights its part of
// the floor, which keeps the number of lights in each cell of the clustered lighting low. Turn off
// the area lights to compare them with punctual lights.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    DISPLAYFORMAT_HDR,
    Entity,
    FILLMODE_FILL_WINDOW,
    FOG_LINEAR,
    JsonHandler,
    LIGHTFALLOFF_INVERSESQUARED,
    LIGHTSHAPE_DISK,
    LIGHTSHAPE_RECT,
    LIGHTSHAPE_SPHERE,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    StandardMaterial,
    TONEMAP_NEUTRAL,
    TONEMAP_NONE,
    TextureHandler,
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
    color: new Asset('color', 'texture', { url: './assets/textures/seaside-rocks01-color.jpg' }, { srgb: true }),
    normal: new Asset('normal', 'texture', { url: './assets/textures/seaside-rocks01-normal.jpg' }),
    gloss: new Asset('gloss', 'texture', { url: './assets/textures/seaside-rocks01-gloss.jpg' }),
    luts: new Asset('luts', 'json', { url: './assets/json/area-light-luts.json' })
};

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType],

    // Enable HDR rendering if supported
    displayFormat: DISPLAYFORMAT_HDR
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
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, JsonHandler];

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
    lights: {
        areaLights: true,
        intensity: 1,
        bloom: 0.03,
        animate: true
    },
    floor: {
        gloss: 0.8,
        metalness: 0.7
    }
});

// The lookup tables the area lights are evaluated with
const luts = /** @type {{ LTC_MAT_1: number[], LTC_MAT_2: number[] }} */ (assets.luts.resource);
app.setAreaLightLuts(luts.LTC_MAT_1, luts.LTC_MAT_2);

// The clustered lighting subdivides the space the lights occupy into cells, each holding the lights
// overlapping it. The small light ranges keep that number well below the limit per cell.
const lighting = app.scene.lighting;
lighting.cells = new Vec3(30, 2, 30);
lighting.maxLightsPerCell = 20;
lighting.areaLightsEnabled = true;
lighting.shadowsEnabled = false;

/**
 * Creates a primitive.
 *
 * @param {RenderComponent['type']} type - The primitive type.
 * @param {StandardMaterial} material - The material.
 * @param {Vec3} position - The position.
 * @param {Vec3} scale - The scale.
 * @param {Entity} [parent] - The parent entity.
 * @returns {Entity} The primitive.
 */
const createPrimitive = (type, material, position, scale, parent = app.root) => {
    const entity = new Entity();
    entity.addComponent('render', { type, material });
    entity.setLocalPosition(position);
    entity.setLocalScale(scale);
    parent.addChild(entity);
    return entity;
};

// The metallic floor the lights are reflected in
const floorMaterial = new StandardMaterial();
floorMaterial.diffuse = new Color(0.5, 0.5, 0.5);
floorMaterial.diffuseMap = assets.color.resource;
floorMaterial.normalMap = assets.normal.resource;
floorMaterial.glossMap = assets.gloss.resource;
floorMaterial.useMetalness = true;
[floorMaterial.diffuseMapTiling, floorMaterial.normalMapTiling, floorMaterial.glossMapTiling].forEach((tiling) =>
    tiling.set(28, 28)
);
createPrimitive('plane', floorMaterial, Vec3.ZERO, new Vec3(80, 1, 80));

/**
 * @typedef {object} FloatingLight
 * @property {Entity} entity - The entity of the light, scaled to size the area light.
 * @property {StandardMaterial} material - The emissive material of its visible source.
 * @property {number} intensity - The intensity of the light, scaled by the intensity setting.
 * @property {Vec3} position - The position of the light on the floor, which it floats above.
 * @property {number} height - The height the light floats at.
 * @property {boolean} flat - Whether the light is a disk or a rectangle, which stand upright and spin.
 * @property {number} phase - The phase of its floating and spinning.
 */

/** @type {FloatingLight[]} */
const floatingLights = [];

/**
 * Returns a color of a hue around the color wheel.
 *
 * @param {number} hue - The hue, 0-1 range.
 * @returns {Color} The color.
 */
const hueColor = (hue) => {
    const channel = (offset) => 0.5 + 0.5 * Math.cos(2 * Math.PI * (hue + offset));
    return new Color(channel(0), channel(2 / 3), channel(1 / 3));
};

// The lights float just above the floor in a sunflower spiral: each is turned by the golden angle
// from the previous one, and placed further out, which spreads them evenly over a disk. They are
// omni lights, so the rectangles and disks shine from both of their sides.
const LIGHT_COUNT = 81;
const SPIRAL_RADIUS = 14;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** @type {{ shape: number, primitive: RenderComponent['type'], scale: Vec3, intensity: number }[]} */
const SHAPES = [
    { shape: LIGHTSHAPE_SPHERE, primitive: 'sphere', scale: new Vec3(0.9, 0.9, 0.9), intensity: 4 },
    { shape: LIGHTSHAPE_DISK, primitive: 'cylinder', scale: new Vec3(1.3, 1.3, 1.3), intensity: 4 },
    { shape: LIGHTSHAPE_RECT, primitive: 'box', scale: new Vec3(1.6, 1, 0.9), intensity: 4 }
];

for (let i = 0; i < LIGHT_COUNT; i++) {
    const { shape, primitive, scale, intensity } = SHAPES[i % SHAPES.length];
    const radius = SPIRAL_RADIUS * Math.sqrt((i + 0.5) / LIGHT_COUNT);
    const angle = i * GOLDEN_ANGLE;

    // the colors go around the color wheel from the center out
    const color = hueColor(radius / SPIRAL_RADIUS);

    const entity = new Entity();
    entity.addComponent('light', {
        type: 'omni',
        shape,
        color,
        intensity,
        range: 3,
        falloffMode: LIGHTFALLOFF_INVERSESQUARED
    });
    entity.setLocalScale(scale);
    app.root.addChild(entity);

    // the visible source, the rectangle and the disk in the XZ plane of the light
    const material = new StandardMaterial();
    material.diffuse = Color.BLACK;
    material.emissive = color;
    material.useLighting = false;
    material.update();
    const flat = shape === LIGHTSHAPE_SPHERE ? 1 : 0.002;
    createPrimitive(primitive, material, Vec3.ZERO, new Vec3(1, flat, 1), entity);

    floatingLights.push({
        entity,
        material,
        intensity,
        position: new Vec3(Math.sin(angle) * radius, 0, Math.cos(angle) * radius),
        height: shape === LIGHTSHAPE_SPHERE ? 0.7 : 0.8,
        flat: shape !== LIGHTSHAPE_SPHERE,
        phase: angle
    });
}

// The floor fades into the night in the distance. Both are black, as the clear color is not tone
// mapped, while the fog is.
const NIGHT_COLOR = Color.BLACK;
app.scene.fog.type = FOG_LINEAR;
app.scene.fog.color = NIGHT_COLOR;
app.scene.fog.start = 22;
app.scene.fog.end = 50;

// The camera, low above the floor, so the lights are reflected in it
const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: NIGHT_COLOR,
    fov: 60,
    farClip: 200
});
camera.addComponent('script');
camera.setLocalPosition(0, 4.5, 16);
app.root.addChild(camera);

const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = new Vec3(0, 0.3, 0);
cameraControls.enableFly = false;
cameraControls.pitchRange = new Vec2(-80, -2);
cameraControls.zoomRange = new Vec2(3, 30);

// Bloom makes the light sources glow. When the device renders in HDR, the tone mapping is disabled
// to output the HDR values.
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.samples = 4;
cameraFrame.rendering.toneMapping = device.isHdr ? TONEMAP_NONE : TONEMAP_NEUTRAL;
cameraFrame.bloom.blurLevel = 7;
cameraFrame.vignette.intensity = 0.4;
cameraFrame.update();

// The brightness of the visible light sources, relative to the intensity of their light
const EMISSIVE_SCALE = 1.5;

const applySettings = () => {
    const settings = data.get('settings');
    lighting.areaLightsEnabled = settings.lights.areaLights;
    floatingLights.forEach(({ entity, material, intensity }) => {
        entity.light.intensity = intensity * settings.lights.intensity;
        material.emissiveIntensity = intensity * settings.lights.intensity * EMISSIVE_SCALE;
        material.update();
    });

    cameraFrame.bloom.intensity = settings.lights.bloom;
    cameraFrame.update();

    floorMaterial.gloss = settings.floor.gloss;
    floorMaterial.metalness = settings.floor.metalness;
    floorMaterial.update();
};
applySettings();
data.on('*:set', applySettings);

let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    if (data.get('settings.lights.animate')) {
        time += dt;
    }

    // the lights float in a wave rolling out from the center, and the disks and rectangles stand
    // upright, their XZ plane turned to vertical, and spin slowly around the vertical axis
    floatingLights.forEach(({ entity, position, height, flat, phase }) => {
        const distance = position.length();
        entity.setLocalPosition(position.x, height + Math.sin(time * 1.5 - distance * 0.5) * 0.2, position.z);
        if (flat) {
            entity.setLocalEulerAngles(90, ((phase * 180) / Math.PI + time * 15) % 360, 0);
        }
    });
});

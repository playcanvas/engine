// @config
//
// Area lights give a light source a shape and a size: a rectangle, a disk or a sphere. The glowing
// doors are rectangular spot lights, the drifting orb a spherical omni light, and the sun shining
// through the skylight a disk shaped directional light. Their reflections on the glossy floor and
// spheres take the shape of the light source, and blur with roughness. Switch a light to Punctual to
// compare it with a light of no size.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BoundingBox,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    JsonHandler,
    LIGHTFALLOFF_INVERSESQUARED,
    LIGHTSHAPE_DISK,
    LIGHTSHAPE_PUNCTUAL,
    LIGHTSHAPE_RECT,
    LIGHTSHAPE_SPHERE,
    LightComponentSystem,
    Mouse,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF3_32F,
    SHADOW_PCF5_16F,
    ScriptComponentSystem,
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

/**
 * @import { RenderComponent } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    room: new Asset('room', 'container', { url: './assets/models/area-lights-room.glb' }),
    statue: new Asset('statue', 'container', { url: './assets/models/statue.glb' }),
    luts: new Asset('luts', 'json', { url: './assets/json/area-light-luts.json' })
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
    doors: {
        enabled: true,
        shape: LIGHTSHAPE_RECT,
        width: 1.7,
        height: 3.3,
        intensity: 3,
        shadows: true,
        colorLeft: [1, 0.42, 0.12],
        colorMiddle: [0.25, 0.8, 1],
        colorRight: [1, 0.8, 0.35]
    },
    orb: {
        enabled: true,
        shape: LIGHTSHAPE_SPHERE,
        size: 1,
        intensity: 6,
        color: [0.8, 0.88, 1],
        shadows: true
    },
    sun: {
        enabled: true,
        shape: LIGHTSHAPE_DISK,
        size: 8,
        elevation: 68,
        azimuth: 200,
        intensity: 2.5,
        color: [1, 0.86, 0.68],
        shadows: true
    },
    material: {
        floorRoughness: 0.4,
        sphereRoughness: 0.15,
        sphereMetalness: 0
    },
    scene: {
        animate: true,
        bloom: true
    }
});

// The lookup tables the area lights are evaluated with
const luts = /** @type {{ LTC_MAT_1: number[], LTC_MAT_2: number[] }} */ (assets.luts.resource);
app.setAreaLightLuts(luts.LTC_MAT_1, luts.LTC_MAT_2);

// The omni and spot lights are clustered, which supports area lights once enabled
const lighting = app.scene.lighting;
lighting.areaLightsEnabled = true;
lighting.shadowsEnabled = true;
lighting.shadowType = SHADOW_PCF5_16F;
lighting.shadowAtlasResolution = 4096;

// The room is closed, so there is no environment lighting, only a little ambient light
app.scene.ambientLight = new Color(0.03, 0.032, 0.04);

// The room: floor plates, ribbed walls with three door recesses and a ceiling with a skylight
const room = assets.room.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
app.root.addChild(room);

const floorMaterial = /** @type {StandardMaterial} */ (
    assets.room.resource.materials.find((asset) => asset.resource.name === 'Floor').resource
);

// The statue, a glossy red sphere and a white ceramic sphere on the pedestals of the room
const statue = assets.statue.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
statue.setLocalScale(0.12, 0.12, 0.12);
statue.setLocalPosition(-4, 0.55, 0.8);
statue.setLocalEulerAngles(0, 25, 0);
app.root.addChild(statue);

/**
 * Creates a sphere.
 *
 * @param {Vec3} position - The position of the sphere.
 * @param {number} radius - The radius of the sphere.
 * @param {Color} color - The color of the sphere.
 * @returns {StandardMaterial} The material of the sphere.
 */
const createSphere = (position, radius, color) => {
    const material = new StandardMaterial();
    material.diffuse = color;
    material.useMetalness = true;
    material.metalness = 0;

    // the gloss is the roughness, the same as the materials of the room
    material.glossInvert = true;
    material.update();

    const sphere = new Entity('Sphere');
    sphere.addComponent('render', { type: 'sphere', material });
    sphere.setLocalPosition(position);
    sphere.setLocalScale(radius * 2, radius * 2, radius * 2);
    app.root.addChild(sphere);
    return material;
};

const redMaterial = createSphere(new Vec3(0, 1.26, 0), 0.9, new Color(0.7, 0.02, 0.02));

const ceramicMaterial = createSphere(new Vec3(4, 1.15, 0.8), 0.6, new Color(0.9, 0.9, 0.88));
ceramicMaterial.gloss = 0.3;
ceramicMaterial.update();

// The camera standing at the front of the room, looking at the doors. The sky shows through the
// skylight.
const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0.45, 0.6, 0.8),
    fov: 60,
    nearClip: 0.1,
    farClip: 1000
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
cameraFrame.bloom.blurLevel = 6;
cameraFrame.vignette.intensity = 0.35;
cameraFrame.update();

/**
 * Creates the visible light source for each of the light shapes, sized to match a light of the
 * same scale. Only the source of the current shape is enabled.
 *
 * @param {Entity} parent - The entity the sources are added to, scaled the same as the light.
 * @param {StandardMaterial} material - The emissive material of the sources.
 * @returns {Map<number, Entity>} The sources, by light shape.
 */
const createSources = (parent, material) => {
    const sources = new Map();

    /**
     * @param {number} shape - The light shape.
     * @param {RenderComponent['type']} type - The primitive of the source.
     * @param {Vec3} scale - The scale of the source.
     */
    const addSource = (shape, type, scale) => {
        // the source is not a shadow caster, or it would block its own light
        const source = new Entity();
        source.addComponent('render', { type, material, castShadows: false });
        source.setLocalScale(scale);
        source.enabled = false;
        parent.addChild(source);
        sources.set(shape, source);
    };

    // the rectangle and the disk lie in the XZ plane of the light, the sphere is centered on it
    addSource(LIGHTSHAPE_RECT, 'box', new Vec3(1, 0.002, 1));
    addSource(LIGHTSHAPE_DISK, 'cylinder', new Vec3(1, 0.002, 1));
    addSource(LIGHTSHAPE_SPHERE, 'sphere', new Vec3(1, 1, 1));
    addSource(LIGHTSHAPE_PUNCTUAL, 'sphere', new Vec3(0.1, 0.1, 0.1));

    return sources;
};

/**
 * @typedef {object} LightRig
 * @property {Entity} entity - The entity of the light, which is scaled to size the area light.
 * @property {Entity} sourcesParent - The parent of the visible sources.
 * @property {Map<number, Entity>} sources - The visible sources, by light shape.
 * @property {StandardMaterial} material - The emissive material of the visible sources.
 */

/**
 * Creates a light with its visible source.
 *
 * @param {string} name - The name of the light.
 * @param {object} options - The light component options.
 * @param {boolean} [separateSources] - Whether the sources are not parented to the light, and
 * are placed separately.
 * @returns {LightRig} The light rig.
 */
const createLightRig = (name, options, separateSources = false) => {
    const entity = new Entity(name);
    entity.addComponent('light', {
        falloffMode: LIGHTFALLOFF_INVERSESQUARED,
        ...options
    });
    app.root.addChild(entity);

    const material = new StandardMaterial();
    material.diffuse = Color.BLACK;
    material.useLighting = false;
    material.update();

    let sourcesParent = entity;
    if (separateSources) {
        sourcesParent = new Entity(`${name} Sources`);
        app.root.addChild(sourcesParent);
    }
    const sources = createSources(sourcesParent, material);

    return { entity, sourcesParent, sources, material };
};

// The glowing doors: spot lights filling the door recesses, shining into the room. The spot light
// shines down its -Y axis, turned to face the room, its height along the Z axis.
const DOOR_POSITIONS = [-4.5, 0, 4.5];
const doors = DOOR_POSITIONS.map((x, i) => {
    const rig = createLightRig(`Door ${i}`, {
        type: 'spot',
        range: 25,
        innerConeAngle: 60,
        outerConeAngle: 80,
        shadowBias: 0.2,
        normalOffsetBias: 0.05
    });
    rig.entity.setLocalPosition(x, 1.7, -9.45);
    rig.entity.setLocalEulerAngles(-90, 0, 0);
    return rig;
});

// A glowing orb: an omni light drifting around the room
const orb = createLightRig('Orb', {
    type: 'omni',
    range: 15,
    shadowBias: 0.2,
    normalOffsetBias: 0.05
});

// The sun: a directional light shining through the skylight. Its shadow map covers just the room.
// Its area light is placed at the far clip plane of the camera, so its sources are placed
// separately, just in front of it.
const sun = createLightRig(
    'Sun',
    {
        type: 'directional',
        shadowType: SHADOW_PCF3_32F,
        shadowResolution: 2048,
        shadowBias: 0.2,
        normalOffsetBias: 0.02
    },
    true
);
sun.entity.light.shadowBounds = new BoundingBox(new Vec3(0, 3.4, 0), new Vec3(8.6, 3.4, 9.6));

// The brightness of the visible sources, relative to the intensity of their light
const EMISSIVE_SCALE = 4;
const SUN_DISTANCE = camera.camera.farClip * 0.9;

/**
 * @typedef {object} LightSettings
 * @property {boolean} enabled - Whether the light is enabled.
 * @property {number} shape - The light shape.
 * @property {number} intensity - The intensity of the light.
 * @property {boolean} shadows - Whether the light casts shadows.
 */

/**
 * Applies the settings shared by all lights.
 *
 * @param {LightRig} rig - The light rig.
 * @param {LightSettings} settings - The settings of the light.
 * @param {number[]} color - The color of the light.
 * @param {number} emissiveIntensity - The intensity of the visible source.
 */
const applyLightSettings = (rig, settings, color, emissiveIntensity) => {
    const { entity, sourcesParent, sources, material } = rig;
    entity.enabled = settings.enabled;
    sourcesParent.enabled = settings.enabled;

    const lightColor = new Color(color[0], color[1], color[2]);
    const light = entity.light;
    light.shape = settings.shape;
    light.color = lightColor;
    light.intensity = settings.intensity;
    light.castShadows = settings.shadows;

    material.emissive = lightColor;
    material.emissiveIntensity = emissiveIntensity;
    material.update();

    sources.forEach((source, shape) => {
        source.enabled = shape === settings.shape;
    });
};

/**
 * Scales a light to the size of its area light. The rectangle and the disk are sized along the
 * X and Z axes of the light, the sphere by the X axis.
 *
 * @param {Entity} entity - The entity of the light.
 * @param {number} shape - The light shape.
 * @param {number} width - The width of the light.
 * @param {number} height - The height of the light.
 */
const setLightSize = (entity, shape, width, height) => {
    if (shape === LIGHTSHAPE_PUNCTUAL) {
        entity.setLocalScale(1, 1, 1);
    } else if (shape === LIGHTSHAPE_SPHERE) {
        entity.setLocalScale(width, width, width);
    } else {
        entity.setLocalScale(width, 1, height);
    }
};

// The size of the sun, as a fraction of its distance
let sunScale = 1;

const applySettings = () => {
    const settings = data.get('settings');

    const doorColors = [settings.doors.colorLeft, settings.doors.colorMiddle, settings.doors.colorRight];
    doors.forEach((door, i) => {
        applyLightSettings(door, settings.doors, doorColors[i], settings.doors.intensity * EMISSIVE_SCALE);
        setLightSize(door.entity, settings.doors.shape, settings.doors.width, settings.doors.height);
    });

    applyLightSettings(orb, settings.orb, settings.orb.color, settings.orb.intensity * EMISSIVE_SCALE);
    setLightSize(orb.entity, settings.orb.shape, settings.orb.size, settings.orb.size);

    // the area of the directional light is sized relative to the far clip distance, so its scale is
    // the angular size of the sun
    applyLightSettings(sun, settings.sun, settings.sun.color, settings.sun.intensity * EMISSIVE_SCALE);
    sunScale = 2 * Math.tan((settings.sun.size * 0.5 * Math.PI) / 180);
    sun.entity.setLocalScale(sunScale, sunScale, sunScale);

    floorMaterial.gloss = settings.material.floorRoughness;
    floorMaterial.update();
    redMaterial.gloss = settings.material.sphereRoughness;
    redMaterial.metalness = settings.material.sphereMetalness;
    redMaterial.update();

    cameraFrame.bloom.intensity = settings.scene.bloom ? 0.03 : 0;
    cameraFrame.update();
};
applySettings();
data.on('*:set', applySettings);

const sunRotation = new Quat();
const sunDirection = new Vec3();
const sunPosition = new Vec3();

let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    const settings = data.get('settings');
    if (settings.scene.animate) {
        time += dt;
    }

    // the orb circles the pedestals, bobbing up and down
    const orbAngle = time * 0.4;
    orb.entity.setPosition(Math.sin(orbAngle) * 5.5, 2.2 + Math.sin(time * 1.1) * 0.6, 0.5 + Math.cos(orbAngle) * 3.2);

    // the sun shines down at the elevation, from the azimuth
    const elevation = settings.sun.elevation * (Math.PI / 180);
    const azimuth = settings.sun.azimuth * (Math.PI / 180);
    sunDirection.set(
        -Math.cos(elevation) * Math.sin(azimuth),
        -Math.sin(elevation),
        -Math.cos(elevation) * Math.cos(azimuth)
    );
    sunRotation.setFromDirections(Vec3.DOWN, sunDirection);
    sun.entity.setRotation(sunRotation);

    // the visible sun, in front of the far clip plane, keeps the same angular size as its light
    sunPosition.copy(sunDirection).mulScalar(-SUN_DISTANCE).add(camera.getPosition());
    sun.sourcesParent.setPosition(sunPosition);
    sun.sourcesParent.setRotation(sunRotation);
    const sunSourceScale = sunScale * SUN_DISTANCE;
    sun.sourcesParent.setLocalScale(sunSourceScale, sunSourceScale, sunSourceScale);
});

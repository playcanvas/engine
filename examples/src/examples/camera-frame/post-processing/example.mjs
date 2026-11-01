// @config
//
// The post-processing of a CameraFrame, with each effect in its own panel: anti-aliasing, bloom,
// ambient occlusion, depth of field, volumetric fog, lens flares, auto exposure, color grading,
// color enhancement, a color lookup table, vignette and fringing. Enable an effect to show its
// settings. Of the two lines of text, the upper one is on the World layer and is post-processed,
// the lower one is on the UI layer, rendered after the post-processing.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    AutoExposureEffect,
    BoundingBox,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    LAYERID_UI,
    LensFlare,
    LensFlareEffect,
    LightComponentSystem,
    Mouse,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SCALEMODE_BLEND,
    SHADOW_PCF3_32F,
    SHADOW_PCF5_16F,
    SSAOTYPE_LIGHTING,
    ScreenComponentSystem,
    ScriptComponentSystem,
    SmaaEffect,
    StandardMaterial,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    Vec4,
    createGraphicsDevice,
    math
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

/**
 * @import { Layer } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// The shapes the lens flares are made of, and the color lookup tables to choose from
const FLARE_SHAPES = [
    'glow_disc',
    'spike_6',
    'iris_round',
    'iris_hexagon',
    'anamorphic_glow',
    'anamorphic_streak',
    'glint'
];
const LUTS = ['lut-teal-orange', 'lut-late-sunset', 'lut-moonlight', 'lut-sofia', 'lut-bw'];

const assets = {
    room: new Asset('room', 'container', { url: './assets/models/area-lights-room.glb' }),
    statue: new Asset('statue', 'container', { url: './assets/models/statue.glb' }),
    font: new Asset('font', 'font', { url: './assets/fonts/roboto-regular.json' })
};
const flareAssets = FLARE_SHAPES.map(
    (name) => new Asset(name, 'texture', { url: `./assets/textures/lens-flare/${name}.png` }, { srgb: true })
);
const lutAssets = LUTS.map(
    (name) =>
        new Asset(
            name,
            'texture',
            { url: `./assets/cube-luts/${name}.png` },
            { srgb: true, mipmaps: false, minfilter: 'linear' }
        )
);

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType],

    // The scene is rendered to an antialiased texture, so the canvas, which only shows the UI
    // rendered after the post-processing, is not antialiased
    antialias: false
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
    ScreenComponentSystem,
    ElementComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, FontHandler];

const app = new AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

await new Promise((resolve) => {
    new AssetListLoader([...Object.values(assets), ...flareAssets, ...lutAssets], app.assets).load(resolve);
});

app.start();

// The settings of the effects. Only bloom, the vignette and the multisampling are on to start with.
data.set('settings', {
    frame: {
        enabled: true,
        scale: 1,
        toneMapping: TONEMAP_ACES,
        debug: 'none'
    },
    antialiasing: {
        method: 'msaa',
        sharpness: 0
    },
    bloom: {
        enabled: true,
        intensity: 30,
        blurLevel: 6,
        threshold: 0,
        highQuality: false
    },
    ssao: {
        enabled: false,
        type: SSAOTYPE_LIGHTING,
        intensity: 0.5,
        radius: 0.8,
        samples: 12,
        blur: true
    },
    dof: {
        enabled: false,
        focusDistance: 7,
        focusRange: 1.5,
        blurRadius: 4,
        nearBlur: false,
        highQuality: true
    },
    fog: {
        enabled: false,
        density: 0.1,
        intensity: 3,
        anisotropy: 0,
        spotLights: true,
        omniLights: true
    },
    lensFlare: {
        enabled: false,
        intensity: 1,
        scale: 0.5
    },
    autoExposure: {
        enabled: false,
        compensation: -2.5,
        speedDarkToLight: 3,
        speedLightToDark: 1
    },
    grading: {
        enabled: false,
        saturation: 1,
        brightness: 1,
        contrast: 1,
        tint: [1, 1, 1]
    },
    colorEnhance: {
        enabled: false,
        shadows: 0,
        highlights: 0,
        midtones: 0,
        vibrance: 0,
        dehaze: 0
    },
    colorLut: {
        enabled: false,
        lut: LUTS[0],
        intensity: 1
    },
    vignette: {
        enabled: true,
        inner: 0.3,
        outer: 1,
        curvature: 0.5,
        intensity: 0.6,
        color: [0, 0, 0]
    },
    fringing: {
        enabled: false,
        intensity: 50
    },
    scene: {
        sky: 10,
        emissive: 1,
        animate: true,
        text: true
    }
});

const lighting = app.scene.lighting;
lighting.shadowsEnabled = true;
lighting.shadowType = SHADOW_PCF5_16F;
lighting.shadowAtlasResolution = 2048;

// The room is closed, so there is no environment lighting, only a little ambient light
app.scene.ambientLight = new Color(0.03, 0.032, 0.04);

// The room: floor plates, ribbed walls with three door recesses and a ceiling with a skylight
const room = assets.room.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
app.root.addChild(room);

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
 * @param {number} gloss - The glossiness of the sphere.
 */
const createSphere = (position, radius, color, gloss) => {
    const material = new StandardMaterial();
    material.diffuse = color;
    material.useMetalness = true;
    material.metalness = 0;
    material.gloss = gloss;
    material.update();

    const sphere = new Entity('Sphere');
    sphere.addComponent('render', { type: 'sphere', material });
    sphere.setLocalPosition(position);
    sphere.setLocalScale(radius * 2, radius * 2, radius * 2);
    app.root.addChild(sphere);
};

createSphere(new Vec3(0, 1.26, 0), 0.9, new Color(0.7, 0.02, 0.02), 0.85);
createSphere(new Vec3(4, 1.15, 0.8), 0.6, new Color(0.9, 0.9, 0.88), 0.7);

/**
 * @typedef {object} Emissive
 * @property {StandardMaterial} material - The emissive material.
 * @property {number} intensity - The emissive intensity, scaled by the emissive setting.
 */

/** @type {Emissive[]} */
const emissives = [];

/**
 * Creates an emissive material, whose intensity is scaled by the emissive setting.
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
    material.update();
    emissives.push({ material, intensity });
    return material;
};

// The glowing doors, with a spot light in each of them, shining into the room
const DOORS = [
    { x: -4.5, color: new Color(1, 0.42, 0.12) },
    { x: 0, color: new Color(0.25, 0.8, 1) },
    { x: 4.5, color: new Color(1, 0.8, 0.35) }
];
const doorLights = DOORS.map(({ x, color }, i) => {
    const panel = new Entity(`Door Panel ${i}`);
    panel.addComponent('render', { type: 'box', material: createEmissiveMaterial(color, 4), castShadows: false });
    panel.setLocalPosition(x, 1.7, -9.45);
    panel.setLocalScale(1.7, 3.3, 0.02);
    app.root.addChild(panel);

    // the spot light shines down its -Y axis, so it is turned to face the room
    const light = new Entity(`Door ${i}`);
    light.addComponent('light', {
        type: 'spot',
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
    return light;
});

// A glowing orb drifting around the room
const orb = new Entity('Orb');
orb.addComponent('light', {
    type: 'omni',
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

// The sun shining through the skylight, which the volumetric fog scatters into light shafts. Its
// shadow map covers just the room.
const sun = new Entity('Sun');
sun.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.86, 0.68),
    intensity: 2.5,
    castShadows: true,
    shadowType: SHADOW_PCF3_32F,
    shadowResolution: 2048,
    shadowBias: 0.2,
    normalOffsetBias: 0.02
});
sun.light.shadowBounds = new BoundingBox(new Vec3(0, 3.4, 0), new Vec3(8.6, 3.4, 9.6));

// the light shines down its -Y axis, turned to the direction of the sun
sun.setRotation(new Quat().setFromDirections(Vec3.DOWN, new Vec3(0.13, -0.93, 0.35).normalize()));
app.root.addChild(sun);

// The color of the sky showing through the skylight and the windows, scaled by the sky brightness.
// A sky brighter than 1 blooms.
const SKY_COLOR = new Color(0.45, 0.6, 0.8);

// The camera standing at the front of the room, looking at the doors
const camera = new Entity('Camera');
camera.addComponent('camera', {
    fov: 60,
    nearClip: 0.1,
    farClip: 100
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

// The text on a 2D screen
const screen = new Entity('Screen');
screen.addComponent('screen', {
    referenceResolution: new Vec2(1280, 720),
    scaleBlend: 0.5,
    scaleMode: SCALEMODE_BLEND,
    screenSpace: true
});
app.root.addChild(screen);

/**
 * Adds a line of text to the screen.
 *
 * @param {string} text - The text.
 * @param {number} y - The vertical anchor of the text.
 * @param {Layer} layer - The layer the text is rendered on.
 * @param {Color} color - The color of the text.
 */
const addText = (text, y, layer, color) => {
    const entity = new Entity(text);
    entity.addComponent('element', {
        type: ELEMENTTYPE_TEXT,
        text,
        color,
        fontAsset: assets.font,
        fontSize: 22,
        anchor: new Vec4(0.5, y, 0.5, y),
        pivot: new Vec2(0.5, 0.5),
        layers: [layer.id]
    });
    screen.addChild(entity);
};
// the text on the World layer has a color brighter than 1, so it blooms - the UI does not expose
// an emissive intensity
addText(
    'Text on the World layer, post-processed',
    0.09,
    app.scene.layers.getLayerByName('World'),
    new Color(5, 2.2, 0.4)
);
addText(
    'Text on the UI layer, rendered after the post-processing',
    0.04,
    app.scene.layers.getLayerById(LAYERID_UI),
    Color.WHITE
);

// ------ Camera frame ------

const cameraFrame = new CameraFrame(app, camera.camera);

// the volumetric fog fills the room, and scatters the light of the sun and of the local lights
const fog = cameraFrame.volumetricFog;
fog.light = sun.light;
fog.maxDistance = 30;
fog.heightFalloff = 0.1;
fog.ambientColor.set(0.4, 0.5, 0.7);
fog.ambientIntensity = 0.01;

// SMAA, an alternative anti-aliasing to the multisampling and the TAA
const smaa = new SmaaEffect(device);
cameraFrame.addEffect(smaa);

// The lens flares of the orb and the doors. Each look places its elements along the axis from the
// light through the centre of the screen. Offsets of 0 sit on the light, 1 at the centre, 2
// mirrored across it. Sizes are fractions of the screen height.
const orbLook = {
    elements: [
        { shape: 'glow_disc', size: 0.14, intensity: 0.4 },
        { shape: 'spike_6', size: 0.4, intensity: 0.5 },
        { shape: 'iris_round', offset: 0.65, size: 0.035, intensity: 0.15, count: 2, spread: 0.25 },
        { shape: 'iris_hexagon', offset: 1.5, size: 0.06, intensity: 0.15 }
    ]
};
const doorLook = {
    elements: [
        { shape: 'anamorphic_glow', size: 0.35, aspect: 2.5, intensity: 0.2 },
        { shape: 'anamorphic_streak', size: 0.06, aspect: 22, intensity: 0.17 },
        { shape: 'glint', size: 0.5, intensity: 0.07 }
    ]
};

const lensFlare = new LensFlareEffect(device);
lensFlare.shapes = {
    resolution: 512,
    shapes: Object.fromEntries(flareAssets.map((asset) => [asset.name, asset.resource]))
};

const orbFlare = new LensFlare(orbLook, { light: orb.light });
orbFlare.occlusionOffset = 0.3;
lensFlare.add(orbFlare);

doorLights.forEach((light) => {
    // the light sits behind the glowing door, so its visibility is tested in front of it
    const flare = new LensFlare(doorLook, { light: light.light });
    flare.occlusionOffset = 0.5;
    lensFlare.add(flare);
});
cameraFrame.addEffect(lensFlare);

// auto exposure, adapting the exposure to the brightness of the scene
const autoExposure = new AutoExposureEffect(device);
cameraFrame.addEffect(autoExposure);

// The anti-aliasing methods: multisampling, SMAA, both, and TAA with and without its upscaling
/** @type {Record<string, { samples?: number, smaa?: boolean, taa?: boolean, upscale?: boolean }>} */
const AA_METHODS = {
    none: {},
    msaa: { samples: 4 },
    smaa: { smaa: true },
    msaaSmaa: { samples: 4, smaa: true },
    taa: { taa: true },
    taaUpscale: { taa: true, upscale: true }
};

const applySettings = () => {
    const settings = data.get('settings');

    cameraFrame.enabled = settings.frame.enabled;
    const rendering = cameraFrame.rendering;
    rendering.renderTargetScale = settings.frame.scale;
    rendering.toneMapping = settings.frame.toneMapping;
    cameraFrame.debug = settings.frame.debug === 'none' ? null : settings.frame.debug;

    const method = AA_METHODS[settings.antialiasing.method];
    rendering.samples = method.samples ?? 1;
    rendering.sharpness = settings.antialiasing.sharpness;
    smaa.enabled = !!method.smaa;
    cameraFrame.taa.enabled = !!method.taa;
    cameraFrame.taa.upscale = !!method.upscale;

    const bloom = cameraFrame.bloom;
    bloom.enabled = settings.bloom.enabled;
    bloom.intensity = math.lerp(0, 0.1, settings.bloom.intensity / 100);
    bloom.blurLevel = settings.bloom.blurLevel;
    bloom.threshold = settings.bloom.threshold;
    bloom.highQuality = settings.bloom.highQuality;

    const ssao = cameraFrame.ssao;
    ssao.enabled = settings.ssao.enabled;
    ssao.type = settings.ssao.type;
    ssao.intensity = settings.ssao.intensity;
    ssao.radius = settings.ssao.radius;
    ssao.samples = settings.ssao.samples;
    ssao.blurEnabled = settings.ssao.blur;

    const dof = cameraFrame.dof;
    dof.enabled = settings.dof.enabled;
    dof.focusDistance = settings.dof.focusDistance;
    dof.focusRange = settings.dof.focusRange;
    dof.blurRadius = settings.dof.blurRadius;
    dof.nearBlur = settings.dof.nearBlur;
    dof.highQuality = settings.dof.highQuality;

    fog.enabled = settings.fog.enabled;
    fog.density = settings.fog.density;
    fog.intensity = settings.fog.intensity;
    fog.anisotropy = settings.fog.anisotropy;
    fog.localSpotLights = settings.fog.spotLights;
    fog.localOmniLights = settings.fog.omniLights;

    lensFlare.enabled = settings.lensFlare.enabled;
    lensFlare.intensity = settings.lensFlare.intensity;
    lensFlare.scale = settings.lensFlare.scale;

    autoExposure.enabled = settings.autoExposure.enabled;
    autoExposure.compensation = settings.autoExposure.compensation;
    autoExposure.speedDarkToLight = settings.autoExposure.speedDarkToLight;
    autoExposure.speedLightToDark = settings.autoExposure.speedLightToDark;

    const grading = cameraFrame.grading;
    grading.enabled = settings.grading.enabled;
    grading.saturation = settings.grading.saturation;
    grading.brightness = settings.grading.brightness;
    grading.contrast = settings.grading.contrast;
    grading.tint.fromArray(settings.grading.tint);

    const colorEnhance = cameraFrame.colorEnhance;
    colorEnhance.enabled = settings.colorEnhance.enabled;
    colorEnhance.shadows = settings.colorEnhance.shadows;
    colorEnhance.highlights = settings.colorEnhance.highlights;
    colorEnhance.midtones = settings.colorEnhance.midtones;
    colorEnhance.vibrance = settings.colorEnhance.vibrance;
    colorEnhance.dehaze = settings.colorEnhance.dehaze;

    const colorLUT = cameraFrame.colorLUT;
    colorLUT.enabled = settings.colorLut.enabled;
    colorLUT.texture = app.assets.find(settings.colorLut.lut, 'texture').resource;
    colorLUT.intensity = settings.colorLut.intensity;

    const vignette = cameraFrame.vignette;
    vignette.enabled = settings.vignette.enabled;
    vignette.inner = settings.vignette.inner;
    vignette.outer = settings.vignette.outer;
    vignette.curvature = settings.vignette.curvature;
    vignette.intensity = settings.vignette.intensity;
    vignette.color.fromArray(settings.vignette.color);

    cameraFrame.fringing.enabled = settings.fringing.enabled;
    cameraFrame.fringing.intensity = settings.fringing.intensity;

    cameraFrame.update();

    emissives.forEach(({ material, intensity }) => {
        material.emissiveIntensity = intensity * settings.scene.emissive;
        material.update();
    });
    screen.enabled = settings.scene.text;
    camera.camera.clearColor = new Color(
        SKY_COLOR.r * settings.scene.sky,
        SKY_COLOR.g * settings.scene.sky,
        SKY_COLOR.b * settings.scene.sky
    );
};
applySettings();
data.on('*:set', applySettings);

let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    if (data.get('settings.scene.animate')) {
        time += dt;
    }

    // the orb circles the pedestals, bobbing up and down
    const orbAngle = time * 0.4;
    orb.setPosition(Math.sin(orbAngle) * 5.5, 2.2 + Math.sin(time * 1.1) * 0.6, 0.5 + Math.cos(orbAngle) * 3.2);
});

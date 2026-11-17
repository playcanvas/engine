// @config
//
// Alpha blending and opacity dithering are controlled independently. **Opacity** sets the strength
// of the alpha blend, while **Alpha Dither** sets the strength of the dither, both for the
// surface and for its shadow. **Dither Color** and **Dither Shadow** select the dither pattern
// used for the surface and for its shadow.
//

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_NORMAL,
    CameraComponentSystem,
    CameraFrame,
    Color,
    DITHER_BAYER16,
    Entity,
    FILLMODE_FILL_WINDOW,
    Keyboard,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_VSM_32F,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TEXTURETYPE_RGBP,
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
 * @import { Material, RenderComponent } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    envAtlas: new Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/studio-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType],

    // Disable anti-aliasing as TAA is used to smooth edges
    antialias: false
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.keyboard = new Keyboard(document.body);

// Render at full native resolution
device.maxPixelRatio = window.devicePixelRatio;

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ScriptHandler];

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

// Setup environment, used for reflections only: the backdrop is a dark void
app.scene.envAtlas = assets.envAtlas.resource;
app.scene.exposure = 1.2;
app.scene.skyboxIntensity = 0.1;
app.scene.layers.getLayerByName('Skybox').enabled = false;

/**
 * Creates a StandardMaterial using the metalness workflow.
 *
 * @param {Color} color - The base color.
 * @param {number} metalness - The metalness.
 * @param {number} gloss - The glossiness.
 * @param {number} [glow] - Optional emissive intensity, using the base color as the emissive color.
 * @returns {StandardMaterial} The material.
 */
const createMaterial = (color, metalness, gloss, glow = 0) => {
    const material = new StandardMaterial();
    material.diffuse = color;
    material.useMetalness = true;
    material.metalness = metalness;
    material.gloss = gloss;
    if (glow > 0) {
        material.diffuse = color.clone().mulScalar(0.2);
        material.emissive = color;
        material.emissiveIntensity = glow;
    }
    material.update();
    return material;
};

/**
 * Creates a render entity from a primitive and adds it to the scene.
 *
 * @param {Entity} parent - The parent entity.
 * @param {RenderComponent['type']} type - The primitive type.
 * @param {Material} material - The material.
 * @param {Vec3} position - The local position.
 * @param {Vec3} scale - The local scale.
 * @returns {Entity} The created entity.
 */
const createPrimitive = (parent, type, material, position, scale) => {
    const entity = new Entity(type);
    entity.addComponent('render', { type, material });
    entity.setLocalPosition(position);
    entity.setLocalScale(scale);
    parent.addChild(entity);
    return entity;
};

/**
 * Converts a hue to a saturated color.
 *
 * @param {number} hue - The hue in the 0..1 range.
 * @returns {Color} The color.
 */
const hueToColor = (hue) => {
    const f = (/** @type {number} */ n) => {
        const k = (n + hue * 6) % 6;
        return 1 - Math.max(0, Math.min(k, 4 - k, 1));
    };
    return new Color(f(5), f(3), f(1));
};

// Dark polished floor
createPrimitive(
    app.root,
    'plane',
    createMaterial(new Color(0.4, 0.4, 0.44), 0, 0.1),
    new Vec3(0, 0, 0),
    new Vec3(300, 1, 300)
);

/**
 * Creates a glass material. Alpha blending with dithering is enabled by the controls. Reflections
 * are kept at full strength, so only the glass tint fades with opacity.
 *
 * @param {Color} tint - The glass tint.
 * @returns {StandardMaterial} The glass material.
 */
const createGlass = (tint) => {
    const material = createMaterial(tint, 0, 0.95);
    material.blendType = BLEND_NORMAL;
    material.opacityFadesSpecular = false;
    material.update();
    return material;
};

/** @type {Entity[]} */
const spinners = [];

const metal = createMaterial(new Color(0.9, 0.9, 0.95), 1, 0.9);
const gold = createMaterial(new Color(1, 0.72, 0.3), 1, 0.85);

/**
 * Builds a display: a glowing helix of orbs around a gold spire on an illuminated plinth,
 * enclosed by a glass dome, with two tinted glass panels in front, so the dithering of several
 * overlapping layers is visible against fine, bright detail.
 *
 * @param {Vec3} position - The world-space position of the display.
 * @returns {StandardMaterial[]} The alpha-blended materials of the display.
 */
const buildDisplay = (position) => {
    const display = new Entity('display');
    display.setLocalPosition(position);
    app.root.addChild(display);

    // Plinth with a glowing rim
    createPrimitive(display, 'cylinder', metal, new Vec3(0, 0.25, 0), new Vec3(12.8, 0.5, 12.8));
    createPrimitive(
        display,
        'cylinder',
        createMaterial(new Color(0.2, 0.9, 1), 0, 0.5, 2),
        new Vec3(0, 0.06, 0),
        new Vec3(13.8, 0.12, 13.8)
    );

    // Rotating sculpture: a gold spire with a double helix of glowing orbs
    const sculpture = new Entity('sculpture');
    sculpture.setLocalPosition(0, 0.5, 0);
    display.addChild(sculpture);
    spinners.push(sculpture);

    createPrimitive(sculpture, 'cone', gold, new Vec3(0, 2.6, 0), new Vec3(1.8, 5.2, 1.8));

    const count = 28;
    for (let strand = 0; strand < 2; strand++) {
        for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            const angle = t * Math.PI * 4 + strand * Math.PI;
            const radius = (1.9 - t * 0.9) * 2;
            const size = (0.75 - t * 0.35) * 1.5;
            createPrimitive(
                sculpture,
                'sphere',
                createMaterial(hueToColor((t * 0.8 + strand * 0.5) % 1), 0, 0.9, 1.0),
                new Vec3(Math.cos(angle) * radius, 0.4 + t * 4.6, Math.sin(angle) * radius),
                new Vec3(size, size, size)
            );
        }
    }

    // Glass dome enclosing the sculpture
    const domeMaterial = createGlass(new Color(0.5, 0.8, 1));
    createPrimitive(display, 'cylinder', domeMaterial, new Vec3(0, 3.8, 0), new Vec3(10.8, 6.6, 10.8));

    // Tinted glass panels in front
    const pinkMaterial = createGlass(new Color(1, 0.3, 0.65));
    const amberMaterial = createGlass(new Color(1, 0.7, 0.15));
    createPrimitive(display, 'box', pinkMaterial, new Vec3(-2.2, 3.8, 7.5), new Vec3(6, 7.2, 0.15)).setLocalEulerAngles(
        0,
        8,
        0
    );
    createPrimitive(display, 'box', amberMaterial, new Vec3(2.2, 3.8, 9), new Vec3(6, 7.2, 0.15)).setLocalEulerAngles(
        0,
        -8,
        0
    );

    // Directional light from behind and above, casting soft VSM shadows of the glass and the
    // sculpture onto the floor in front of the display, where the camera sees them. The blur hides
    // the dither pattern in the shadow map. Spot lights cannot be used here, as VSM is only
    // supported for directional lights with clustered lighting.
    const sun = new Entity('sun');
    sun.addComponent('light', {
        type: 'directional',
        color: new Color(1, 0.95, 0.9),
        intensity: 1.3,
        range: 200,
        castShadows: true,
        shadowResolution: 2048,
        shadowType: SHADOW_VSM_32F,
        vsmBlurSize: 20,
        shadowBias: 0.1,
        normalOffsetBias: 0.1
    });
    sun.setLocalEulerAngles(66, 200, 0);
    display.addChild(sun);

    // Colored fill lights from either side, spilling pools of light on the floor
    [new Color(1, 0.25, 0.7), new Color(0.2, 0.6, 1)].forEach((color, i) => {
        const fill = new Entity('fill');
        fill.addComponent('light', {
            type: 'omni',
            color,
            intensity: 0.8,
            range: 30
        });
        fill.setLocalPosition(i ? 10 : -10, 2.5, 8);
        display.addChild(fill);
    });

    return [domeMaterial, pinkMaterial, amberMaterial];
};

const materials = buildDisplay(new Vec3(0, 0, 0));

// Create the camera
const cameraEntity = new Entity('Camera');
cameraEntity.addComponent('camera', {
    fov: 55,
    clearColor: new Color(0.005, 0.006, 0.012)
});
cameraEntity.setPosition(-0.0168, 12.6637, 30.0562);
cameraEntity.setEulerAngles(-26.9155, -13.2501, 0);
app.root.addChild(cameraEntity);

// Add camera controls
cameraEntity.addComponent('script');
cameraEntity.script.create(CameraControls, {
    properties: {
        enableFly: false,
        focusPoint: new Vec3(4.8, 2, 9.6),
        pitchRange: new Vec2(-90, 90),
        zoomRange: new Vec2(0.01, 40)
    }
});

app.on('update', (/** @type {number} */ dt) => {
    spinners.forEach((spinner) => spinner.rotate(0, 25 * dt, 0));
});

// ------ Custom render passes set up ------

const cameraFrame = new CameraFrame(app, cameraEntity.camera);
cameraFrame.rendering.toneMapping = TONEMAP_ACES;
cameraFrame.rendering.sceneColorMap = true;
cameraFrame.taa.jitter = 1;
cameraFrame.bloom.intensity = 0.015;
cameraFrame.vignette.intensity = 0.5;
cameraFrame.update();

const applySettings = () => {
    cameraFrame.taa.enabled = data.get('data.taa');
    cameraFrame.rendering.sharpness = cameraFrame.taa.enabled ? 1 : 0;
    cameraFrame.update();
};

// ------

// Handle UI changes
data.on('*:set', (/** @type {string} */ path, value) => {
    const propertyName = path.split('.')[1];

    // only the material properties: taa is a camera setting, and the initial values also fire an
    // event for the whole data, which has no property name
    if (propertyName && propertyName !== 'taa') {
        materials.forEach((material) => {
            material[propertyName] = value;
            material.update();
        });
    }

    applySettings();
});

// Initial values — opacity starts at 1, so the transparency comes from the dither alone. Lower the
// opacity to add alpha blending on top, which is controlled independently of the dither.
data.set('data', {
    taa: false,
    opacity: 1,
    alphaDither: 0.3,
    opacityDither: DITHER_BAYER16,
    opacityShadowDither: DITHER_BAYER16
});

// @config
// @flag HIDDEN

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

// Mesh instance overrides of material uniforms. All spheres share one StandardMaterial, whose
// diffuse color lives in the material uniform buffer. A mesh instance overriding that uniform gets
// its own copy of the buffer with the override applied, while overrides of uniforms outside the
// buffer keep using the per-draw scope path. The shared material animates its own diffuse color,
// so the copies have to follow the material while keeping their overrides.

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    font: new Asset('font', 'font', { url: './assets/fonts/arial.json' })
};

const device = await createGraphicsDevice(canvas, { deviceTypes: [deviceType] });
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ElementComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, FontHandler];

const app = new AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

app.scene.envAtlas = assets.helipad.resource;

const camera = new Entity('camera');
camera.addComponent('camera', {
    toneMapping: TONEMAP_ACES,
    clearColor: new Color(0.1, 0.1, 0.12)
});
camera.setLocalPosition(0, 1.4, 11.5);
camera.lookAt(Vec3.ZERO);
app.root.addChild(camera);

const light = new Entity('light');
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.95, 0.85),
    intensity: 2
});
light.setLocalEulerAngles(45, 30, 0);
app.root.addChild(light);

// the shared material - its diffuse color is stored in the material uniform buffer
const shared = new StandardMaterial();
shared.diffuse = new Color(0.6, 0.6, 0.6);
shared.gloss = 0.4;
shared.update();

// creates a labelled sphere using the shared material and returns its mesh instance
const createSphere = (label, x) => {
    const root = new Entity(label);
    root.setLocalPosition(x, 0, 0);
    app.root.addChild(root);

    const sphere = new Entity('sphere');
    sphere.addComponent('render', {
        type: 'sphere',
        material: shared
    });
    sphere.setLocalScale(1.5, 1.5, 1.5);
    root.addChild(sphere);

    const text = new Entity('label');
    text.addComponent('element', {
        type: ELEMENTTYPE_TEXT,
        text: label,
        fontAsset: assets.font,
        fontSize: 0.2,
        pivot: [0.5, 0.5],
        anchor: [0.5, 0.5, 0.5, 0.5]
    });
    text.setLocalPosition(0, 1.15, 0);
    root.addChild(text);

    return sphere.render.meshInstances[0];
};

// converts a hue (0..1) to a linear RGB triple, the form a material_diffuse override expects
const hueToLinear = (hue, target, saturation = 0.7, value = 0.9) => {
    hue -= Math.floor(hue);
    const sector = Math.floor(hue * 6);
    const f = hue * 6 - sector;
    const p = value * (1 - saturation);
    const q = value * (1 - f * saturation);
    const t = value * (1 - (1 - f) * saturation);
    const rgb = [
        [value, t, p],
        [q, value, p],
        [p, value, t],
        [p, q, value],
        [t, p, value],
        [value, p, q]
    ][sector];
    target[0] = Math.pow(rgb[0], 2.2);
    target[1] = Math.pow(rgb[1], 2.2);
    target[2] = Math.pow(rgb[2], 2.2);
    return target;
};

// 1. no overrides - shows the shared material color, which cycles slowly
createSphere('material', -3.8);

// 2. a static override of the diffuse color only
const overridden = createSphere('override: diffuse', -1.9);
overridden.setParameter('material_diffuse', hueToLinear(0, new Float32Array(3)));

// 3. an override changing every frame
const animated = createSphere('override: animated', 0);
const animatedColor = new Float32Array(3);

// 4. an override set and removed every 1.5 seconds - the sphere alternates between red and the
// material color
const toggled = createSphere('override: toggled', 1.9);
let toggleTime = 0;
let toggleOn = false;

// 5. diffuse, emissive and gloss overrides, all uniforms of the material uniform buffer and applied
// through the same copy of it
const mixed = createSphere('override: diffuse\n+ emissive + gloss', 3.8);
mixed.setParameter('material_diffuse', hueToLinear(0.6, new Float32Array(3)));
mixed.setParameter('material_emissive', new Float32Array([0.35, 0.12, 0.02]));
mixed.setParameter('material_gloss', 0.9);

const materialColor = new Color();
let time = 0;
app.on('update', (dt) => {
    time += dt;

    // the shared material cycles its own diffuse color slowly - every copy has to follow it
    const hue = time * 0.05;
    materialColor.set(0.6 + 0.4 * Math.sin(hue * Math.PI * 2), 0.6, 0.6 - 0.4 * Math.sin(hue * Math.PI * 2));
    shared.diffuse = materialColor;
    shared.update();

    // the animated override cycles quickly
    animated.setParameter('material_diffuse', hueToLinear(time * 0.5, animatedColor));

    // the toggled override comes and goes
    toggleTime += dt;
    if (toggleTime > 1.5) {
        toggleTime = 0;
        toggleOn = !toggleOn;
        if (toggleOn) {
            toggled.setParameter('material_diffuse', hueToLinear(0, new Float32Array(3)));
        } else {
            toggled.deleteParameter('material_diffuse');
        }
    }
});

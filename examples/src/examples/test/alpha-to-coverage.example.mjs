// @config
// @flag HIDDEN
//
// Internal test for `Material#alphaToCoverage`. One opacity ramp, three rows - **top:** alpha to
// coverage, **middle:** alpha blending, **bottom:** opaque. It needs a multi-sampled target whose
// first color attachment has an alpha channel, so the top row falls back to opaque with **MSAA**
// off - and, on WebGPU only, with the `111110F` **Format**, which has no alpha channel.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_NONE,
    BLEND_NORMAL,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    LightComponentSystem,
    PIXELFORMAT_RGBA16F,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    StandardMaterial,
    TextureHandler,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    checkerboard: new Asset('checkerboard', 'texture', { url: './assets/textures/checkboard.png' }),
    font: new Asset('font', 'font', { url: './assets/fonts/arial.json' })
};

const gfxOptions = {
    deviceTypes: [deviceType],

    // alpha to coverage needs a multi-sampled target - this is only the initial state of the back
    // buffer, which the MSAA control switches at runtime.
    antialias: true
};

const device = await createGraphicsDevice(canvas, gfxOptions);
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

app.scene.ambientLight = new Color(0.4, 0.4, 0.4);
app.scene.lighting.shadowsEnabled = false;

// a checkerboard backdrop, so anything showing through the spheres is obvious
const backdropMaterial = new StandardMaterial();
backdropMaterial.diffuseMap = assets.checkerboard.resource;
backdropMaterial.diffuseMapTiling.set(8, 5);
backdropMaterial.gloss = 0;
backdropMaterial.useMetalness = false;
backdropMaterial.update();

const backdrop = new Entity('Backdrop');
backdrop.addComponent('render', {
    type: 'plane',
    material: backdropMaterial
});
backdrop.setLocalPosition(0, 0, -3);
backdrop.setLocalEulerAngles(90, 0, 0);
backdrop.setLocalScale(24, 1, 14);
app.root.addChild(backdrop);

// the opacity ramp shared by all three rows
const opacities = [0.15, 0.35, 0.55, 0.75, 0.95];

/** @type {StandardMaterial[]} */
const alphaToCoverageMaterials = [];

/**
 * @param {string} message - The label text.
 * @param {number} y - Vertical position of the label.
 */
const createLabel = (message, y) => {
    const label = new Entity(`Label-${message}`);
    label.addComponent('element', {
        anchor: [0.5, 0.5, 0.5, 0.5],
        pivot: [0.5, 0.5],
        fontAsset: assets.font,
        fontSize: 0.32,
        text: message,
        type: ELEMENTTYPE_TEXT
    });
    label.setLocalPosition(0, y, 0);
    app.root.addChild(label);
};

/**
 * @param {number} rowY - Vertical position of the row.
 * @param {'coverage'|'blend'|'opaque'} mode - How transparency is resolved for this row.
 * @param {string} label - The label shown above the row.
 */
const createRow = (rowY, mode, label) => {
    createLabel(label, rowY + 0.95);

    opacities.forEach((opacity, index) => {
        const material = new StandardMaterial();
        material.diffuse = new Color(0.9, 0.35, 0.2);
        material.useMetalness = true;
        material.metalness = 0.1;
        material.gloss = 0.6;
        material.opacity = opacity;

        if (mode === 'coverage') {
            // no blending - the alpha is consumed by the MSAA coverage mask instead
            material.blendType = BLEND_NONE;
            material.alphaToCoverage = true;
            alphaToCoverageMaterials.push(material);
        } else if (mode === 'blend') {
            material.blendType = BLEND_NORMAL;
            material.depthWrite = false;
        } else {
            material.blendType = BLEND_NONE;
        }

        material.update();

        const sphere = new Entity(`Sphere-${mode}-${index}`);
        sphere.addComponent('render', {
            type: 'sphere',
            material: material
        });
        sphere.setLocalPosition((index - (opacities.length - 1) * 0.5) * 1.3, rowY, 0);
        sphere.setLocalScale(1.1, 1.1, 1.1);
        app.root.addChild(sphere);
    });
};

createRow(1.9, 'coverage', 'Alpha To Coverage');
createRow(0, 'blend', 'Alpha Blend');
createRow(-1.9, 'opaque', 'Opaque');

const light = new Entity('Light');
light.addComponent('light', {
    type: 'directional',
    castShadows: false,
    intensity: 1.5
});
light.setLocalEulerAngles(45, 20, 0);
app.root.addChild(light);

const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0.05, 0.06, 0.08)
});
camera.setLocalPosition(0, 1.0, 11);
camera.lookAt(new Vec3(0, 1.0, 0));
app.root.addChild(camera);

const cameraFrame = new CameraFrame(app, camera.camera);

// The back buffer's sample count is chosen when the graphics device is created, and there is no
// public API to change it afterwards. Both backends do however rebuild the back buffer whenever its
// cached size stops matching the canvas - neither of them relies on a multi-sampled WebGL context
// any more, as WebGL allocates the default framebuffer without antialiasing and resolves through a
// multi-sampled framebuffer it owns, and WebGPU owns its multi-sampled texture outright. So
// invalidating that cached size is enough to have the back buffer recreated with a new sample
// count. This deliberately pokes at semi-internal device state, which is fine for an internal test
// but is not something an application should rely on.
const setBackBufferSamples = (enabled) => {
    device.backBufferAntialias = enabled;
    device.samples = enabled ? device.maxSamples : 1;
    device.backBufferSize.set(-1, -1);
};

const applySettings = () => {
    const msaa = data.get('data.msaa');
    const useCameraFrame = data.get('data.cameraFrame');

    alphaToCoverageMaterials.forEach((material) => {
        material.alphaToCoverage = data.get('data.alphaToCoverage');
        material.update();
    });

    // the MSAA control drives whichever target is actually being rendered into
    setBackBufferSamples(msaa);

    cameraFrame.enabled = useCameraFrame;
    cameraFrame.rendering.samples = msaa ? device.maxSamples : 1;
    cameraFrame.rendering.renderFormats = [data.get('data.format')];
    cameraFrame.update();

    // read-only readout for the control panel. Only written when it changes, as this runs from the
    // observer's own change handler.
    const renderingTo = useCameraFrame ? 'Texture' : 'Backbuffer';
    if (data.get('data.renderingTo') !== renderingTo) {
        data.set('data.renderingTo', renderingTo);
    }
};

// set the initial state before subscribing, so that applySettings never runs against a
// partially populated observer
data.set('data', {
    alphaToCoverage: true,
    cameraFrame: false,
    msaa: true,
    format: PIXELFORMAT_RGBA16F,
    renderingTo: 'Backbuffer'
});

data.on('*:set', () => {
    applySettings();
});

applySettings();

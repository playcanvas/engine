import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_NORMAL,
    CameraComponentSystem,
    Color,
    DISPLAYFORMAT_LDR_SRGB,
    DITHER_BAYER8,
    DITHER_BLUENOISE,
    DITHER_IGNNOISE,
    DITHER_NONE,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    StandardMaterial,
    TONEMAP_LINEAR,
    TextureHandler,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    font: new Asset('font', 'font', { url: './assets/fonts/arial.json' })
};

const gfxOptions = {
    deviceTypes: [deviceType],

    // disable anti-aliasing to make dithering more pronounced
    antialias: false,

    // use sRGB for display format (only supported on WebGPU, fallbacks to LDR on WebGL2)
    displayFormat: DISPLAYFORMAT_LDR_SRGB
};

const device = await createGraphicsDevice(canvas, gfxOptions);

// make dithering more pronounced by rendering to lower resolution
device.maxPixelRatio = 1;

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

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Create an entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: Color.BLACK,
    toneMapping: TONEMAP_LINEAR
});
camera.translate(0, -0.5, 14);
camera.rotate(0, 0, 0);
app.root.addChild(camera);

const NUM_SPHERES_X = 4;
const NUM_SPHERES_Z = 10;

const ditherOptions = [DITHER_NONE, DITHER_BAYER8, DITHER_BLUENOISE, DITHER_IGNNOISE];

/**
 * @param {number} x - The x coordinate.
 * @param {number} z - The z coordinate.
 */
const createSphere = (x, z) => {
    const material = new StandardMaterial();
    material.name = `material-${ditherOptions[x]}-${z}`;
    material.emissive = new Color(1, 0, 0);
    material.specular = new Color(1, 1, 1);
    material.metalness = 0.0;
    material.gloss = 0.5;
    material.useMetalness = true;

    if (ditherOptions[x] === DITHER_NONE) {
        // alpha blending material
        material.blendType = BLEND_NORMAL;
    } else {
        // alpha dithering material
        material.opacityDither = ditherOptions[x];
    }

    // we want the spheres to seem to fade out in a linear fashion, so we need to convert
    // the perceived opacity value from sRGB to linear space
    const perceivedOpacity = (z + 1) / NUM_SPHERES_Z;
    const linearOpacity = Math.pow(perceivedOpacity, 2.2);
    material.opacity = linearOpacity;

    material.update();

    const sphere = new Entity(`entity-${ditherOptions[x]}-${z}`);
    sphere.addComponent('render', {
        material: material,
        type: 'sphere'
    });
    sphere.setLocalPosition(1.5 * (x - (NUM_SPHERES_X - 1) * 0.5), z - (NUM_SPHERES_Z - 1) * 0.5, 0);
    sphere.setLocalScale(0.9, 0.9, 0.9);
    app.root.addChild(sphere);
};
/**
 * @param {Asset} fontAsset - The font asset.
 * @param {string} message - The message.
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 */
const createText = (fontAsset, message, x, y) => {
    // Create a text element-based entity
    const text = new Entity();
    text.addComponent('element', {
        anchor: [0.5, 0.5, 0.5, 0.5],
        fontAsset: fontAsset,
        fontSize: 0.3,
        pivot: [0.5, 0.5],
        text: message,
        type: ELEMENTTYPE_TEXT
    });
    text.setLocalPosition(x, y, 0);
    app.root.addChild(text);
};

for (let i = 0; i < NUM_SPHERES_X; i++) {
    for (let j = 0; j < NUM_SPHERES_Z; j++) {
        createSphere(i, j);
    }
}

const y = (NUM_SPHERES_Z + 1) * -0.5;
createText(assets.font, 'Alpha\nBlend', NUM_SPHERES_X * -0.6, y);
createText(assets.font, 'Bayer8\nDither', NUM_SPHERES_X * -0.2, y);
createText(assets.font, 'Blue-noise\nDither', NUM_SPHERES_X * 0.2, y);
createText(assets.font, 'IGN-noise\nDither', NUM_SPHERES_X * 0.6, y);

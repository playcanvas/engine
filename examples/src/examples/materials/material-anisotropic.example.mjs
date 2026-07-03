import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

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

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

app.scene.skyboxMip = 1;
app.scene.envAtlas = assets.helipad.resource;

// Create an entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    toneMapping: TONEMAP_ACES
});
camera.translate(0, 9, 9);
camera.rotate(-48, 0, 0);
app.root.addChild(camera);

// Create an entity with a directional light component
const light = new Entity();
light.addComponent('light', {
    type: 'directional'
});
app.root.addChild(light);
const e = light.getLocalEulerAngles();
light.setLocalEulerAngles(e.x + 90, e.y - 75, e.z);

const NUM_SPHERES_X = 11;
const NUM_SPHERES_Z = 6;
/**
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} z - The z coordinate.
 */
const createSphere = (x, y, z) => {
    const material = new StandardMaterial();
    material.metalness = 1.0;
    material.gloss = z / (NUM_SPHERES_Z - 1);
    material.useMetalness = true;
    material.anisotropyIntensity = x / (NUM_SPHERES_X - 1);

    material.enableGGXSpecular = true;
    material.update();

    const sphere = new Entity();

    sphere.addComponent('render', {
        material: material,
        type: 'sphere'
    });
    sphere.setLocalPosition(x - (NUM_SPHERES_X - 1) * 0.5, y, z - (NUM_SPHERES_Z - 1) * 0.5);
    sphere.setLocalScale(0.7, 0.7, 0.7);
    app.root.addChild(sphere);
};
/**
 * @param {Asset} fontAsset - The font asset.
 * @param {string} message - The message.
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} z - The z coordinate.
 * @param {number} rotx - Rotation around x coordinate (euler angles).
 * @param {number} roty - Rotation around y coordinate (euler angles).
 */
const createText = (fontAsset, message, x, y, z, rotx, roty) => {
    // Create a text element-based entity
    const text = new Entity();
    text.addComponent('element', {
        anchor: [0.5, 0.5, 0.5, 0.5],
        fontAsset: fontAsset,
        fontSize: 0.5,
        pivot: [0.5, 0.5],
        text: message,
        type: ELEMENTTYPE_TEXT
    });
    text.setLocalPosition(x, y, z);
    text.setLocalEulerAngles(rotx, roty, 0);
    app.root.addChild(text);
};

for (let i = 0; i < NUM_SPHERES_Z; i++) {
    for (let j = 0; j < NUM_SPHERES_X; j++) {
        createSphere(j, 0, i);
    }
}

createText(assets.font, 'Anisotropy', 0, 0, (NUM_SPHERES_Z + 1) * 0.5, -90, 0);
createText(assets.font, 'Roughness', -(NUM_SPHERES_X + 1) * 0.5, 0, 0, -90, 90);

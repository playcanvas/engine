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
    MOUSEBUTTON_LEFT,
    Mouse,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
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

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, ElementComponentSystem];
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

app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 1;

// Create an entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    toneMapping: TONEMAP_ACES
});
camera.translate(0, 0, 9);
app.root.addChild(camera);

const NUM_SPHERES = 5;
/**
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} z - The z coordinate.
 */
const createSphere = (x, y, z) => {
    const material = new StandardMaterial();
    material.metalness = y / (NUM_SPHERES - 1);
    material.gloss = x / (NUM_SPHERES - 1);
    material.useMetalness = true;
    material.update();

    const sphere = new Entity();
    sphere.addComponent('render', {
        material: material,
        type: 'sphere'
    });
    sphere.setLocalPosition(x - (NUM_SPHERES - 1) * 0.5, y - (NUM_SPHERES - 1) * 0.5, z);
    sphere.setLocalScale(0.9, 0.9, 0.9);
    app.root.addChild(sphere);
};

/**
 * @param {Asset} fontAsset - The font asset.
 * @param {string} message - The message.
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} z - The z coordinate.
 * @param {number} rot - Euler rotation around z coordinate.
 */
const createText = (fontAsset, message, x, y, z, rot) => {
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
    text.setLocalEulerAngles(0, 0, rot);
    app.root.addChild(text);
};

for (let i = 0; i < NUM_SPHERES; i++) {
    for (let j = 0; j < NUM_SPHERES; j++) {
        createSphere(j, i, 0);
    }
}

createText(assets.font, 'Glossiness', 0, -(NUM_SPHERES + 1) * 0.5, 0, 0);
createText(assets.font, 'Metalness', -(NUM_SPHERES + 1) * 0.5, 0, 0, 90);

// rotate the skybox using mouse input
const mouse = new Mouse(document.body);

let x = 0;
let y = 0;
const rot = new Quat();

mouse.on('mousemove', event => {
    if (event.buttons[MOUSEBUTTON_LEFT]) {
        x += event.dx;
        y += event.dy;

        rot.setFromEulerAngles(0.2 * y, 0.2 * x, 0);
        app.scene.skyboxRotation = rot;
    }
});
app.on('destroy', () => mouse.detach());

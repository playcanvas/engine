// @config
// @flag HIDDEN

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_ADDITIVE,
    BLEND_ADDITIVEALPHA,
    BLEND_NONE,
    BLEND_NORMAL,
    BLEND_SCREEN,
    CULLFACE_NONE,
    CameraComponentSystem,
    Color,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    LightComponentSystem,
    Mouse,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TextureHandler,
    TouchDevice,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    script: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    font: new Asset('font', 'font', { url: './assets/fonts/arial.json' }),
    rocks: new Asset(
        'rocks',
        'texture',
        { url: './assets/textures/seaside-rocks01-diffuse-alpha.png' },
        { srgb: true }
    ),

    opacity: new Asset('rocks', 'texture', { url: './assets/textures/seaside-rocks01-roughness.jpg' })
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
    ElementComponentSystem,
    ScriptComponentSystem,
    LightComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, FontHandler, ScriptHandler];

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

// Create an entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.1, 1)
});
camera.translate(10, 6, 22);

// add orbit camera script with a mouse and a touch support
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        distanceMin: 12,
        distanceMax: 100
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');

app.root.addChild(camera);

const NUM_BOXES = 5;

// alpha blend modes for individual rows
const blendModes = [BLEND_ADDITIVE, BLEND_ADDITIVEALPHA, BLEND_SCREEN, BLEND_NORMAL, BLEND_NONE];

/**
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} z - The z coordinate.
 * @returns {Entity} The returned entity.
 */
const createPrimitive = (x, y, z) => {
    const material = new StandardMaterial();

    // emissive color
    material.emissive = new Color(x, y, 1 - y);

    // emissive texture
    material.emissiveMap = assets.rocks.resource;

    // opacity map - use a separate texture
    material.opacityMap = assets.opacity.resource;
    material.opacityMapChannel = 'r';

    // disable culling to see back faces as well
    material.cull = CULLFACE_NONE;

    // set up alpha test value
    material.alphaTest = (x + 1) / (NUM_BOXES + 1) - 0.1;

    // alpha blend mode
    material.blendType = blendModes[y];

    const box = new Entity();
    box.addComponent('render', {
        material: material,
        type: 'box',
        castShadows: true
    });
    box.setLocalPosition(x - (NUM_BOXES - 1) * 0.5, y - (NUM_BOXES - 1) * 0.5, z);
    box.setLocalScale(0.7, 0.7, 0.7);
    app.root.addChild(box);

    return box;
};

/** @type {Array<Entity>} */
const boxes = [];
for (let i = 0; i < NUM_BOXES; i++) {
    for (let j = 0; j < NUM_BOXES; j++) {
        boxes.push(createPrimitive(j, i, 0));
    }
}
/**
 * @param {Asset} fontAsset - The font asset.
 * @param {string} message - The message.
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} z - The z coordinate.
 * @param {number} rot - The z coordinate rotation (euler angles).
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

createText(assets.font, 'Alpha Test', 0, (NUM_BOXES + 1) * 0.5, 0, 0);
createText(assets.font, 'Alpha Blend', -(NUM_BOXES + 1) * 0.5, 0, 0, 90);

// ground
const groundMaterial = new StandardMaterial();
groundMaterial.diffuse = new Color(0.5, 0.5, 0.5);
groundMaterial.gloss = 0.4;
groundMaterial.metalness = 0.5;
groundMaterial.useMetalness = true;
groundMaterial.update();

const ground = new Entity();
ground.addComponent('render', {
    type: 'box',
    material: groundMaterial
});
ground.setLocalScale(30, 1, 30);
ground.setLocalPosition(0, -3, 0);
app.root.addChild(ground);

// light
const directionalLight = new Entity();
directionalLight.addComponent('light', {
    type: 'directional',
    color: Color.WHITE,
    castShadows: true,
    shadowDistance: 20,
    intensity: 1,
    shadowBias: 0.2,
    normalOffsetBias: 0.05,
    shadowResolution: 2048
});
directionalLight.setEulerAngles(45, 180, 0);
app.root.addChild(directionalLight);

// Set an update function on the app's update event
let time = 0;
const rot = new Quat();
app.on('update', (/** @type {number} */ dt) => {
    time += dt;

    // rotate the boxes
    rot.setFromEulerAngles(20 * time, 30 * time, 0);
    boxes.forEach((box) => {
        box.setRotation(rot);
    });
});

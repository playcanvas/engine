import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

/**
 * @import { Material } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    normal: new Asset('normal', 'texture', { url: './assets/textures/flakes5n.png' }),
    diffuse: new Asset('diffuse', 'texture', { url: './assets/textures/flakes5c.png' }),
    other: new Asset('other', 'texture', { url: './assets/textures/flakes5o.png' })
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

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
createOptions.resourceHandlers = [TextureHandler];

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
camera.translate(0, 0, 3);
app.root.addChild(camera);

// Create an entity with a directional light component
const light = new Entity();
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.8, 0.25)
});
app.root.addChild(light);
light.setLocalEulerAngles(85, -100, 0);

/**
 * function to create sphere
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} z - The z coordinate.
 * @param {Material} material - The material.
 */
const createSphere = (x, y, z, material) => {
    const sphere = new Entity();

    sphere.addComponent('render', {
        material: material,
        type: 'sphere'
    });
    sphere.setLocalPosition(x, y, z);
    sphere.setLocalScale(0.7, 0.7, 0.7);
    app.root.addChild(sphere);
};

const material = new StandardMaterial();
material.diffuseMap = assets.diffuse.resource;
material.metalnessMap = assets.other.resource;
material.metalnessMapChannel = 'r';
material.glossMap = assets.other.resource;
material.glossMapChannel = 'g';
material.normalMap = assets.normal.resource;
material.diffuse = new Color(0.6, 0.6, 0.9);
material.metalness = 1.0;
material.gloss = 0.9;
material.bumpiness = 0.7;
material.useMetalness = true;
material.update();

createSphere(-0.5, 0, 0, material);

const clearCoatMaterial = new StandardMaterial();
clearCoatMaterial.diffuseMap = assets.diffuse.resource;
clearCoatMaterial.metalnessMap = assets.other.resource;
clearCoatMaterial.metalnessMapChannel = 'r';
clearCoatMaterial.glossMap = assets.other.resource;
clearCoatMaterial.glossMapChannel = 'g';
clearCoatMaterial.normalMap = assets.normal.resource;
clearCoatMaterial.diffuse = new Color(0.6, 0.6, 0.9);
clearCoatMaterial.metalness = 1.0;
clearCoatMaterial.gloss = 0.9;
clearCoatMaterial.bumpiness = 0.7;
clearCoatMaterial.useMetalness = true;
clearCoatMaterial.clearCoat = 0.25;
clearCoatMaterial.clearCoatGloss = 0.9;
clearCoatMaterial.update();

createSphere(0.5, 0, 0, clearCoatMaterial);

// update things each frame
let time = 0;
app.on('update', dt => {
    // rotate camera around the objects
    time += dt;
    camera.setLocalPosition(3 * Math.sin(time * 0.5), 0, 3 * Math.cos(time * 0.5));
    camera.lookAt(Vec3.ZERO);
});

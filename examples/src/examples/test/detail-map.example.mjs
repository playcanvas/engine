// @config
// @flag HIDDEN

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    DETAILMODE_MUL,
    Entity,
    FILLMODE_FILL_WINDOW,
    Keyboard,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

/**
 * @import { Material } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    fly: new Asset('fly', 'script', { url: './scripts/camera/fly-camera.js' }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/morning-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    diffuse: new Asset('diffuse', 'texture', { url: './assets/textures/seaside-rocks01-color.jpg' }),
    diffuseDetail: new Asset('diffuse', 'texture', { url: './assets/textures/playcanvas.png' }),
    normal: new Asset('normal', 'texture', { url: './assets/textures/seaside-rocks01-normal.jpg' }),
    normalDetail: new Asset('normal', 'texture', { url: './assets/textures/normal-map.png' }),
    ao: new Asset('ao', 'texture', { url: './assets/textures/seaside-rocks01-ao.jpg' }),
    aoDetail: new Asset('ao', 'texture', { url: './assets/textures/playcanvas-grey.png' })
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
createOptions.keyboard = new Keyboard(document.body);

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

app.scene.envAtlas = assets.helipad.resource;
app.scene.exposure = 3;

// Create an entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    toneMapping: TONEMAP_ACES,
    fov: 75
});
camera.translate(0, 0, 3);
app.root.addChild(camera);

// Add fly camera script
camera.addComponent('script');
camera.script.create('flyCamera', {
    attributes: {
        speed: 100
    }
});

// Create an entity with an omni light component
const light = new Entity();
light.addComponent('light', {
    type: 'omni',
    color: new Color(1, 1, 1),
    intensity: 2,
    castShadows: false,
    range: 800
});
light.addComponent('render', {
    type: 'sphere'
});
light.setLocalScale(30, 30, 30);
light.setLocalPosition(200, -100, 0);
app.root.addChild(light);

// Material with detail maps
const tiling = 3;
const material = new StandardMaterial();
material.diffuseMap = assets.diffuse.resource;
material.diffuseDetailMode = DETAILMODE_MUL;
material.normalMap = assets.normal.resource;
material.aoMap = assets.ao.resource;
material.gloss = 0.3;
material.useMetalness = true;
material.diffuseMapTiling.set(tiling, tiling);
material.normalMapTiling.set(tiling, tiling);
material.heightMapTiling.set(tiling, tiling);
material.update();

/**
 * Helper function to create a 3d primitive including its material.
 *
 * @param {string} primitiveType - The primitive type.
 * @param {Vec3} position - The position.
 * @param {Vec3} scale - The scale.
 * @param {Material} material - The material.
 */
function createPrimitive(primitiveType, position, scale, material) {
    // Create the primitive using the material
    const primitive = new Entity();
    primitive.addComponent('render', {
        type: primitiveType,
        material: material,
        castShadows: false,
        receiveShadows: false
    });

    // Set position and scale and add it to scene
    primitive.setLocalPosition(position);
    primitive.setLocalScale(scale);
    app.root.addChild(primitive);
}

// Create the ground plane from the boxes
createPrimitive('box', new Vec3(0, -200, 0), new Vec3(800, 2, 800), material);
createPrimitive('box', new Vec3(0, 200, 0), new Vec3(800, 2, 800), material);

// walls
createPrimitive('box', new Vec3(400, 0, 0), new Vec3(2, 400, 800), material);
createPrimitive('box', new Vec3(-400, 0, 0), new Vec3(2, 400, 800), material);
createPrimitive('box', new Vec3(0, 0, -400), new Vec3(800, 400, 0), material);
createPrimitive('box', new Vec3(0, 0, 400), new Vec3(800, 400, 0), material);

// Initial values
data.set('data', {
    diffuse: true,
    normal: true,
    ao: true
});

// Update things each frame
app.on('update', (_dt) => {
    // Toggle diffuse detail map
    const diffuseEnabled = !!material.diffuseDetailMap;
    if (diffuseEnabled !== data.get('data.diffuse')) {
        material.diffuseDetailMap = diffuseEnabled ? null : assets.diffuseDetail.resource;
        material.update();
    }

    // Toggle normal detail map
    const normalEnabled = !!material.normalDetailMap;
    if (normalEnabled !== data.get('data.normal')) {
        material.normalDetailMap = normalEnabled ? null : assets.normalDetail.resource;
        material.update();
    }

    // Toggle ao detail map
    const aoEnabled = !!material.aoDetailMap;
    if (aoEnabled !== data.get('data.ao')) {
        material.aoDetailMap = aoEnabled ? null : assets.aoDetail.resource;
        material.update();
    }
});

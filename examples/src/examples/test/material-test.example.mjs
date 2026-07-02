// @config
// @flag HIDDEN

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    LAYERID_DEPTH,
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

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    normal: new Asset('normal', 'texture', { url: './assets/textures/seaside-rocks01-normal.jpg' }),
    diffuse: new Asset('diffuse', 'texture', { url: './assets/textures/seaside-rocks01-color.jpg' }),
    other: new Asset('other', 'texture', { url: './assets/textures/seaside-rocks01-height.jpg' }),
    gloss: new Asset('other', 'texture', { url: './assets/textures/seaside-rocks01-gloss.jpg' }),
    colors: new Asset('other', 'texture', { url: './assets/textures/colors.webp' }),
    hatch: new Asset('other', 'texture', { url: './assets/textures/hatch-0.jpg' })
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

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

app.scene.envAtlas = assets.helipad.resource;

// Depth layer is where the framebuffer is copied to a texture to be used in the following layers.
// Move the depth layer to take place after World and Skydome layers, to capture both of them.
const depthLayer = app.scene.layers.getLayerById(LAYERID_DEPTH);
app.scene.layers.remove(depthLayer);
app.scene.layers.insertOpaque(depthLayer, 2);

// Create an entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    toneMapping: TONEMAP_ACES
});
app.root.addChild(camera);

// Create an entity with a directional light component
const light = new Entity();
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.8, 0.25),
    intensity: 2
});
app.root.addChild(light);
light.setLocalEulerAngles(85, -100, 0);

const createObject = (x, y, z, material, scale) => {
    const obj = new Entity();
    obj.addComponent('render', {
        material: material,
        type: 'capsule'
    });
    obj.setLocalPosition(x, y, z);
    obj.setLocalScale(scale, scale, scale);
    app.root.addChild(obj);
};

// red pill it the sheen material
const materialSheen = new StandardMaterial();
materialSheen.diffuse = new Color(0.9, 0.6, 0.6);
materialSheen.useMetalness = true; // sheen requires metalness workflow
materialSheen.metalness = 0.5;

materialSheen.useSheen = true;
materialSheen.sheenMap = assets.other.resource;
materialSheen.sheen = new Color(0.9, 0.2, 0.1);
materialSheen.sheenGlossMap = assets.diffuse.resource;
materialSheen.sheenGloss = 0.7;
materialSheen.update();

// green pill - specular & specularity factor
const materialSpecFactor = new StandardMaterial();
materialSpecFactor.diffuse = new Color(0.6, 0.9, 0.6);
materialSpecFactor.gloss = 0.6;
materialSpecFactor.useMetalness = true;
materialSpecFactor.metalness = 0.8;
materialSpecFactor.metalnessMap = assets.other.resource;

materialSpecFactor.useMetalnessSpecularColor = true;
materialSpecFactor.specularityFactor = 0.5;
materialSpecFactor.specularityFactorTint = true;
materialSpecFactor.specularityFactorMap = assets.diffuse.resource;

materialSpecFactor.specularMap = assets.colors.resource;
materialSpecFactor.glossMap = assets.gloss.resource;
materialSpecFactor.update();

// blue pill - AO
const materialAO = new StandardMaterial();
materialAO.diffuse = new Color(0.6, 0.6, 0.9);
materialAO.aoMap = assets.gloss.resource;
materialAO.aoDetailMap = assets.hatch.resource;
materialAO.update();

createObject(-1, 0, 0, materialSheen, 0.7);
createObject(1, 0, 0, materialSpecFactor, 0.7);
createObject(0, 0, 1, materialAO, 0.7);

// update things each frame
let time = 0;
app.on('update', (dt) => {
    // rotate camera around the objects
    time += dt;
    camera.setLocalPosition(4 * Math.sin(time * 0.5), 0, 4 * Math.cos(time * 0.5));
    camera.lookAt(Vec3.ZERO);
});

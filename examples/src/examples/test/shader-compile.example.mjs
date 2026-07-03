// @config
// @flag HIDDEN

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    JsonHandler,
    Keyboard,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADERLANGUAGE_GLSL,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TRACEID_SHADER_COMPILE,
    TextureHandler,
    TouchDevice,
    Tracing,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// This example serves as a test framework for large shader compilation speed test. Enable tracking for it.
Tracing.set(TRACEID_SHADER_COMPILE, true);

const assets = {
    color: new Asset('color', 'texture', { url: './assets/textures/seaside-rocks01-color.jpg' }),
    normal: new Asset('normal', 'texture', { url: './assets/textures/seaside-rocks01-normal.jpg' }),
    gloss: new Asset('gloss', 'texture', { url: './assets/textures/seaside-rocks01-gloss.jpg' }),
    luts: new Asset('luts', 'json', { url: './assets/json/area-light-luts.json' }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: './assets/wasm/glslang/glslang.js',
    twgslUrl: './assets/wasm/twgsl/twgsl.js'
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.keyboard = new Keyboard(document.body);

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, JsonHandler];

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

/**
 * helper function to create a primitive with shape type, position, scale, color
 * @param {string} primitiveType - The primitive type.
 * @param {Vec3} position - The position.
 * @param {Vec3} scale - The scale.
 * @param {any} assetManifest - The asset manifest.
 * @param {boolean} [id] - Prevent shader compilation caching.
 * @returns {Entity} The entity.
 */
function createPrimitive(primitiveType, position, scale, assetManifest, id = false) {
    // create material of specified color
    const material = new StandardMaterial();
    material.gloss = 0.4;
    material.useMetalness = true;

    material.diffuseMap = assetManifest.color.resource;
    material.normalMap = assetManifest.normal.resource;
    material.glossMap = assetManifest.gloss.resource;
    material.metalness = 0.4;

    material.diffuseMapTiling.set(7, 7);
    material.normalMapTiling.set(7, 7);
    material.glossMapTiling.set(7, 7);

    // do a small update to a chunk to generate unique shader each time, to avoid any shader compilation caching
    if (id) {
        material.getShaderChunks(SHADERLANGUAGE_GLSL).set(
            'viewDirPS',
            `
                    void getViewDir() {
                        dViewDirW = normalize(view_position - vPositionW);
                        dViewDirW.x += 0.00001 * ${Math.random()};
                    }
                `
        );
    }

    material.update();

    // create primitive
    const primitive = new Entity();
    primitive.addComponent('render', {
        type: primitiveType,
        material: material
    });

    // set position and scale and add it to scene
    primitive.setLocalPosition(position);
    primitive.setLocalScale(scale);
    app.root.addChild(primitive);

    return primitive;
}

// enable area lights which are disabled by default for clustered lighting
app.scene.lighting.areaLightsEnabled = true;

// set the loaded area light LUT data
const luts = assets.luts.resource;
app.setAreaLightLuts(luts.LTC_MAT_1, luts.LTC_MAT_2);

// setup skydome
app.scene.skyboxMip = 1;
app.scene.skyboxIntensity = 0.7;
app.scene.envAtlas = assets.helipad.resource;

// create ground plane
createPrimitive('plane', new Vec3(0, 0, 0), new Vec3(20, 20, 20), assets);

// Create the camera, which renders entities
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.2, 0.2, 0.2),
    fov: 60,
    farClip: 100000,
    toneMapping: TONEMAP_ACES
});
app.root.addChild(camera);
camera.setLocalPosition(0, 15, 40);
camera.lookAt(0, 0, 0);

// generate a grid of spheres, each with a unique material / shader
for (let x = -10; x <= 10; x += 6) {
    for (let y = -10; y <= 10; y += 6) {
        const pos = new Vec3(x, 0.6, y);
        createPrimitive('sphere', pos, new Vec3(1, 1, 1), assets, true);
    }
}

// create some omni lights
const count = 10;
/** @type {Array<Entity>} */
const lights = [];
for (let i = 0; i < count; i++) {
    const color = new Color(Math.random(), Math.random(), Math.random(), 1);
    const light = new Entity();
    light.addComponent('light', {
        type: 'spot',
        color: color,
        intensity: 4,
        range: 16,
        castShadows: false
    });

    // attach a render component with a small cone to each light
    const material = new StandardMaterial();
    material.emissive = color;
    material.update();

    light.addComponent('render', {
        type: 'sphere',
        material: material
    });
    light.setLocalScale(0.5, 0.5, 0.5);

    app.root.addChild(light);
    lights.push(light);
}

// update things each frame
let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    time += dt;

    // orbit spot lights around
    lights.forEach((light, i) => {
        const angle = (i / lights.length) * Math.PI * 2;
        light.setLocalPosition(8 * Math.sin(time + angle), 4, 8 * Math.cos(time + angle));
    });
});

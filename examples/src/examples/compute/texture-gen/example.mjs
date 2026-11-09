// @config
// @flag WEBGL_DISABLED
//
// A compute shader generates an animated texture every frame, writing it to a storage texture. It
// reads the PlayCanvas logo from an input texture, and lays it over the pattern. Two instances of the
// shader generate two variants of the texture, dispatched together in a single compute pass. Each
// knot is painted with one of them, and the corner shows the textures as generated. The pattern
// tiles without seams, so it flows along the knots without a visible edge.

import {
    ADDRESS_REPEAT,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BindGroupFormat,
    BindStorageTextureFormat,
    BindTextureFormat,
    BindUniformBufferFormat,
    CameraComponentSystem,
    CameraFrame,
    Color,
    Compute,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    LAYERID_IMMEDIATE,
    LAYERID_UI,
    LAYERID_WORLD,
    LightComponentSystem,
    MiniStats,
    Mouse,
    PIXELFORMAT_RGBA8,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADERLANGUAGE_WGSL,
    SHADERSTAGE_COMPUTE,
    ScriptComponentSystem,
    Shader,
    StandardMaterial,
    TEXTUREDIMENSION_2D,
    TEXTURETYPE_RGBP,
    TONEMAP_NEUTRAL,
    Texture,
    TextureHandler,
    TextureRenderer,
    TouchDevice,
    UNIFORMTYPE_FLOAT,
    UniformBufferFormat,
    UniformFormat,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

import computeShaderWgsl from './compute-shader.wgsl';

/**
 * @import { RenderComponent } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    knot: new Asset('knot', 'container', { url: './assets/models/trefoil-knot.glb' }),
    logo: new Asset('logo', 'texture', { url: './assets/textures/playcanvas-grey.png' }),
    envAtlas: new Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/product-studio-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType]
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

const app = new AppBase(canvas);
app.init(createOptions);

const textures = new TextureRenderer(app);

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

// The compute dispatches and compute passes of each frame are shown next to the other stats
const miniStats = new MiniStats(app, MiniStats.getDefaultOptions(['compute']));

data.set('settings', {
    speed: 1,
    hue: 0.4
});

// The studio environment gives the knots their reflections. The camera does not render the skybox
// layer, so the background is the clear color.
app.scene.envAtlas = assets.envAtlas.resource;
app.scene.skyboxIntensity = 0.3;

// ----- The generated textures -----

// The input texture: the white PlayCanvas logo on gray
const logo = assets.logo.resource;

// a compute shader that generates a texture
const shader = device.supportsCompute
    ? new Shader(device, {
          name: 'ComputeShader',
          shaderLanguage: SHADERLANGUAGE_WGSL,
          cshader: computeShaderWgsl,

          computeUniformBufferFormats: {
              ub: new UniformBufferFormat(device, [
                  new UniformFormat('time', UNIFORMTYPE_FLOAT),
                  new UniformFormat('hue', UNIFORMTYPE_FLOAT)
              ])
          },

          // Format of a bind group, providing resources for the compute shader
          computeBindGroupFormat: new BindGroupFormat(device, [
              // a uniform buffer we provided format for
              new BindUniformBufferFormat('ub', SHADERSTAGE_COMPUTE),
              // Input texture, read without filtering
              new BindTextureFormat('inTexture', SHADERSTAGE_COMPUTE, undefined, undefined, false),
              // Output storage texture
              new BindStorageTextureFormat('outTexture', PIXELFORMAT_RGBA8, TEXTUREDIMENSION_2D)
          ])
      })
    : null;

/**
 * Creates a knot painted with a texture of its own, and an instance of the compute shader which
 * generates the texture each frame.
 *
 * @param {number} x - The position of the knot along the X axis.
 * @returns {{ knot: Entity, texture: Texture, compute: Compute }} The knot, its texture, and the
 * compute shader instance generating it.
 */
const createKnot = (x) => {
    // The storage texture the compute shader writes to, the same size as the logo texture, so the
    // shader reads and writes the same texel. It repeats along the knot.
    const texture = new Texture(device, {
        name: 'GeneratedTexture',
        width: logo.width,
        height: logo.height,
        format: PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: FILTER_LINEAR,
        magFilter: FILTER_LINEAR,
        addressU: ADDRESS_REPEAT,
        addressV: ADDRESS_REPEAT,

        // This is a storage texture, allowing compute shader to write to it
        storage: true
    });

    // Create an instance of the compute shader, and set the input and output textures
    const compute = new Compute(device, shader, 'ComputeGenerateTexture');
    compute.setParameter('inTexture', logo);
    compute.setParameter('outTexture', texture);

    // Glossy paint in the colors of the texture, which also glows a little with them
    const material = new StandardMaterial();
    material.diffuseMap = texture;
    material.emissiveMap = texture;
    material.emissive = Color.WHITE;
    material.emissiveIntensity = 1;
    material.gloss = 0.7;
    material.useMetalness = true;
    material.metalness = 0;
    material.update();

    const knot = assets.knot.resource.instantiateRenderEntity();
    knot.findComponents('render').forEach((render) => {
        /** @type {RenderComponent} */ (render).meshInstances[0].material = material;
    });
    knot.setLocalPosition(x, 0, 0);
    knot.setLocalScale(0.6, 0.6, 0.6);
    app.root.addChild(knot);

    return { knot, texture, compute };
};

// Two knots, each with a texture generated by its own instance of the compute shader. The second
// texture uses the opposite colors of the palette, and flows slower.
const variants = [
    { ...createKnot(-1.4), hue: 0, speed: 1 },
    { ...createKnot(1.4), hue: 0.5, speed: 0.6 }
];

// ----- The camera and the lights -----

const camera = new Entity('Camera');
// the camera frame treats the clear color as a linear color, so it is converted from sRGB
camera.addComponent('camera', {
    clearColor: new Color().fromString('#0c0e14').linear(),
    layers: [LAYERID_WORLD, LAYERID_IMMEDIATE, LAYERID_UI]
});
camera.addComponent('script');
camera.setLocalPosition(0, 0.5, 6.5);
app.root.addChild(camera);

const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = Vec3.ZERO;
cameraControls.enableFly = false;
cameraControls.pitchRange = new Vec2(-90, 90);
cameraControls.zoomRange = new Vec2(3, 15);

/**
 * Creates a directional light.
 *
 * @param {string} color - The color, as a hex string.
 * @param {number} intensity - The intensity.
 * @param {number[]} angles - The euler angles of the light.
 */
function createLight(color, intensity, angles) {
    const light = new Entity('Light');
    light.addComponent('light', {
        type: 'directional',
        color: new Color().fromString(color),
        intensity
    });
    light.setLocalEulerAngles(angles[0], angles[1], angles[2]);
    app.root.addChild(light);
}

// Seen from the starting camera position: a soft key light from the upper left, and two rim lights
// from behind the knots
createLight('#fff1e0', 1.2, [45, -35, 0]);
createLight('#ffffff', 0.8, [-60, 120, 0]);
createLight('#ffffff', 0.8, [-60, -120, 0]);

// Bloom makes the glowing lines of the texture glow. The neutral tone mapping keeps their colors.
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.samples = 4;
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;
cameraFrame.bloom.intensity = 0.03;
cameraFrame.bloom.blurLevel = 6;
cameraFrame.vignette.intensity = 0.5;
cameraFrame.update();

// ----- The texture previews -----

// A caption above the previews of the textures, drawn in the bottom right corner
const caption = document.createElement('div');
caption.textContent = 'Generated textures';
caption.style.cssText = `
    position: absolute; right: 2.5%; bottom: calc(2.5% + 20vh + 8px); pointer-events: none;
    font: 600 11px system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: #a7afbd;`;
document.body.appendChild(caption);
app.on('destroy', () => caption.remove());

let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    const settings = data.get('settings');
    time += dt * settings.speed;

    // the previews of the textures are square, a fifth of the height of the screen
    const height = 0.2;
    const width = (height * canvas.clientHeight) / canvas.clientWidth;

    variants.forEach(({ knot, texture, compute, hue, speed }, i) => {
        // Set up the dispatch generating the texture, a thread for each texel
        compute.setParameter('time', time * speed);
        compute.setParameter('hue', settings.hue + hue);
        compute.setupDispatchThreads(texture.width, texture.height);

        // slowly turn the knot, the two in opposite directions
        const direction = i === 0 ? 1 : -1;
        knot.setLocalEulerAngles(time * 5, direction * time * 12, 0);

        // show the texture in the bottom right corner, side by side
        textures.draw(texture, 0.975 - (2 - i) * width - (1 - i) * 0.01, 0.775, width, height);
    });

    // Dispatch both compute shaders in a single compute pass
    device.computeDispatch(
        variants.map((variant) => variant.compute),
        'ComputeGenerateTextureDispatch'
    );
});

export { miniStats };

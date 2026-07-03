// @config
// @flag WEBGL_DISABLED
//
// @credit
// title: UXR Icosahedron
// author: enealefons
// source: https://sketchfab.com/3d-models/uxr-icosahedron-66c69bd0538a455197aebe81ae3a4961
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BindGroupFormat,
    BindStorageTextureFormat,
    BindTextureFormat,
    BindUniformBufferFormat,
    CameraComponentSystem,
    Color,
    Compute,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    LightComponentSystem,
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
    TONEMAP_ACES,
    Texture,
    TextureHandler,
    UNIFORMTYPE_FLOAT,
    UNIFORMTYPE_VEC4,
    UniformBufferFormat,
    UniformFormat,
    Vec3,
    createGraphicsDevice,
    createScript
} from 'playcanvas';

import { deviceType } from 'examples/context';

import computeShaderWgsl from './compute-shader.wgsl';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    texture: new Asset('color', 'texture', { url: './assets/textures/seaside-rocks01-color.jpg' }),
    solid: new Asset('solid', 'container', { url: './assets/models/icosahedron.glb' }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

const app = new AppBase(canvas);
app.init(createOptions);
app.start();

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

// Setup skydome
app.scene.skyboxMip = 1;
app.scene.skyboxIntensity = 3;
app.scene.envAtlas = assets.helipad.resource;

// Create camera entity
const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(0.5, 0.6, 0.9),
    toneMapping: TONEMAP_ACES
});
app.root.addChild(camera);
camera.setPosition(0.6, 0, 5);

// Create directional light entity
const light = new Entity('light');
light.addComponent('light');
app.root.addChild(light);
light.setEulerAngles(45, 0, 0);

// a helper script that rotates the entity
const Rotator = createScript('rotator');
Rotator.prototype.update = function (/** @type {number} */ dt) {
    this.entity.rotate(10 * dt, 20 * dt, 30 * dt);
};

// a compute shader that will tint the input texture and write the result to the storage texture
const shader = device.supportsCompute
    ? new Shader(device, {
          name: 'ComputeShader',
          shaderLanguage: SHADERLANGUAGE_WGSL,
          cshader: computeShaderWgsl,

          computeUniformBufferFormats: {
              ub: new UniformBufferFormat(device, [
                  new UniformFormat('tint', UNIFORMTYPE_VEC4),
                  new UniformFormat('offset', UNIFORMTYPE_FLOAT),
                  new UniformFormat('frequency', UNIFORMTYPE_FLOAT)
              ])
          },

          // Format of a bind group, providing resources for the compute shader
          computeBindGroupFormat: new BindGroupFormat(device, [
              // a uniform buffer we provided format for
              new BindUniformBufferFormat('ub', SHADERSTAGE_COMPUTE),
              // Input textures
              new BindTextureFormat('inTexture', SHADERSTAGE_COMPUTE, undefined, undefined, false),
              // Output storage textures
              new BindStorageTextureFormat('outTexture', PIXELFORMAT_RGBA8, TEXTUREDIMENSION_2D)
          ])
      })
    : null;

// Helper function, which creates a cube entity, and an instance of the compute shader that will
// update its texture each frame
const createCubeInstance = (/** @type {Vec3} */ position) => {
    if (!device.supportsCompute) return null;

    // Create a storage texture, that the compute shader will write to. Make it the same dimensions
    // as the loaded input texture
    const storageTexture = new Texture(app.graphicsDevice, {
        name: 'outputTexture',
        width: assets.texture.resource.width,
        height: assets.texture.resource.height,
        format: PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: FILTER_LINEAR,
        magFilter: FILTER_LINEAR,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE,

        // This is a storage texture, allowing compute shader to write to it
        storage: true
    });

    // Create an instance of the compute shader, and set the input and output textures
    const compute = new Compute(device, shader, 'ComputeModifyTexture');
    compute.setParameter('inTexture', assets.texture.resource);
    compute.setParameter('outTexture', storageTexture);

    // Add a box in the scene, using the storage texture as a material
    const material = new StandardMaterial();
    material.diffuseMap = storageTexture;
    material.gloss = 0.6;
    material.metalness = 0.4;
    material.useMetalness = true;
    material.update();

    const solid = assets.solid.resource.instantiateRenderEntity();
    solid.findByName('Object_3').render.meshInstances[0].material = material;

    // Add the script to rotate the object
    solid.addComponent('script');
    solid.script.create('rotator');

    // Place it in the world
    solid.setLocalPosition(position);
    solid.setLocalScale(0.25, 0.25, 0.25);
    app.root.addChild(solid);

    return compute;
};

// Create two instances of cube / compute shader
const compute1 = createCubeInstance(new Vec3(0, 1, 0));
const compute2 = createCubeInstance(new Vec3(0, -1, 0));

let time = 0;
const srcTexture = assets.texture.resource;
app.on('update', (/** @type {number} */ dt) => {
    time += dt;

    if (device.supportsCompute) {
        // Set uniform buffer parameters
        compute1.setParameter('offset', 20 * time);
        compute1.setParameter('frequency', 0.1);
        compute1.setParameter('tint', [Math.sin(time) * 0.5 + 0.5, 1, 0, 1]);

        compute2.setParameter('offset', 10 * time);
        compute2.setParameter('frequency', 0.03);
        compute2.setParameter('tint', [1, 0, Math.sin(time) * 0.5 + 0.5, 1]);

        // Set up both dispatches
        compute1.setupDispatch(srcTexture.width, srcTexture.height);
        compute2.setupDispatch(srcTexture.width, srcTexture.height);

        // Dispatch both compute shaders in a single compute pass
        device.computeDispatch([compute1, compute2], 'ComputeModifyTextureDispatch');

        // debug render the generated textures
        app.drawTexture(0.6, 0.5, 0.6, 0.3, compute1.getParameter('outTexture'));
        app.drawTexture(0.6, -0.5, 0.6, 0.3, compute2.getParameter('outTexture'));
    }
});

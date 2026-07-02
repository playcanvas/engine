// @config
// @flag WEBGL_DISABLED
//
// @credit
// title: UXR Icosahedron
// author: enealefons
// source: https://sketchfab.com/3d-models/uxr-icosahedron-66c69bd0538a455197aebe81ae3a4961
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BUFFERUSAGE_COPY_DST,
    BUFFERUSAGE_COPY_SRC,
    BindGroupFormat,
    BindStorageBufferFormat,
    BindTextureFormat,
    CameraComponentSystem,
    Color,
    Compute,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADERLANGUAGE_WGSL,
    SHADERSTAGE_COMPUTE,
    ScriptComponentSystem,
    Shader,
    StorageBuffer,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    createGraphicsDevice,
    createScript,
    math
} from 'playcanvas';

import { deviceType } from 'examples/context';

import computeShaderWgsl from './compute-shader.wgsl';

// Note: the example is based on this article:
// https://webgpufundamentals.org/webgpu/lessons/webgpu-compute-shaders-histogram.html
// A simpler but less performant version of the compute shader is used for simplicity.

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
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

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

// setup skydome
app.scene.skyboxMip = 2;
app.scene.skyboxIntensity = 0.3;
app.scene.envAtlas = assets.helipad.resource;

// create camera entity
const camera = new Entity('camera');
camera.addComponent('camera', {
    toneMapping: TONEMAP_ACES
});
app.root.addChild(camera);
camera.setPosition(0, 0, 5);

// Enable the camera to render the scene's color map, available as uSceneColorMap in the shaders.
// This allows us to use the rendered scene as an input for the histogram compute shader.
camera.camera.requestSceneColorMap(true);

// create directional light entity
const light = new Entity('light');
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 1, 1),
    intensity: 15
});
app.root.addChild(light);
light.setEulerAngles(45, 0, 40);

// a helper script that rotates the entity
const Rotator = createScript('rotator');
Rotator.prototype.update = function (/** @type {number} */ dt) {
    this.entity.rotate(5 * dt, 10 * dt, -15 * dt);
};

// a compute shader that will compute the histogram of the input texture and write the result to the storage buffer
const shader = device.supportsCompute
    ? new Shader(device, {
          name: 'ComputeShader',
          shaderLanguage: SHADERLANGUAGE_WGSL,
          cshader: computeShaderWgsl,

          // format of a bind group, providing resources for the compute shader
          computeBindGroupFormat: new BindGroupFormat(device, [
              // input texture - the scene color map, without a sampler
              new BindTextureFormat('uSceneColorMap', SHADERSTAGE_COMPUTE, undefined, undefined, false),
              // output storage buffer
              new BindStorageBufferFormat('outBuffer', SHADERSTAGE_COMPUTE)
          ])
      })
    : null;

// Create a storage buffer to which the compute shader will write the histogram values.
const numBins = 256;
const histogramStorageBuffer = new StorageBuffer(
    device,
    numBins * 4, // 4 bytes per value, storing unsigned int
    BUFFERUSAGE_COPY_SRC | // needed for reading back the data to CPU
        BUFFERUSAGE_COPY_DST // needed for clearing the buffer
);

// Create an instance of the compute shader, and set the input and output data. Note that we do
// not provide a value for `uSceneColorMap` as this is done by the engine internally.
const compute = new Compute(device, shader, 'ComputeHistogram');
compute.setParameter('outBuffer', histogramStorageBuffer);

// instantiate the spinning mesh
const solid = assets.solid.resource.instantiateRenderEntity();
solid.addComponent('script');
solid.script.create('rotator');
solid.setLocalPosition(0, 0.4, 0);
solid.setLocalScale(0.35, 0.35, 0.35);
app.root.addChild(solid);

let firstFrame = true;
app.on('update', (/** @type {number} */ _dt) => {
    // The update function runs every frame before the frame gets rendered. On the first time it
    // runs, the scene color map has not been rendered yet, so we skip the first frame.
    if (firstFrame) {
        firstFrame = false;
        return;
    }

    if (device.supportsCompute) {
        // clear the storage buffer, to avoid the accumulation buildup
        histogramStorageBuffer.clear();

        // dispatch the compute shader
        compute.setupDispatch(app.graphicsDevice.width, app.graphicsDevice.height);
        device.computeDispatch([compute], 'HistogramDispatch');

        // Read back the histogram data from the storage buffer. None that the returned promise
        // will be resolved later, when the GPU is done running it, and so the histogram on the
        // screen will be up to few frames behind.
        const histogramData = new Uint32Array(numBins);
        histogramStorageBuffer.read(0, undefined, histogramData).then((data) => {
            // render the histogram using lines
            const scale = 1 / 50000;
            const positions = [];
            for (let x = 0; x < data.length; x++) {
                const value = math.clamp(data[x] * scale, 0, 0.2);
                positions.push(x * 0.001, -0.35, 4);
                positions.push(x * 0.001, value - 0.35, 4);
            }
            app.drawLineArrays(positions, Color.YELLOW);
        });
    }
});

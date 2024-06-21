// @config WEBGL_DISABLED
import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';
import files from 'examples/files';

// Note: the example is based on this article:
// https://webgpufundamentals.org/webgpu/lessons/webgpu-compute-shaders-histogram.html
// A simpler but less performant version of the compute shader is used for simplicity.

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    solid: new pc.Asset('solid', 'container', { url: rootPath + '/static/assets/models/icosahedron.glb' }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);
app.start();

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    // set up some general scene rendering properties
    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;

    // setup skydome
    app.scene.skyboxMip = 2;
    app.scene.skyboxIntensity = 0.3;
    app.scene.envAtlas = assets.helipad.resource;

    // create camera entity
    const camera = new pc.Entity('camera');
    camera.addComponent('camera');
    app.root.addChild(camera);
    camera.setPosition(0, 0, 5);

    // Enable the camera to render the scene's color map, available as uSceneColorMap in the shaders.
    // This allows us to use the rendered scene as an input for the histogram compute shader.
    camera.camera.requestSceneColorMap(true);

    // create directional light entity
    const light = new pc.Entity('light');
    light.addComponent('light', {
        type: 'directional',
        color: new pc.Color(1, 1, 1),
        intensity: 15
    });
    app.root.addChild(light);
    light.setEulerAngles(45, 0, 40);

    // a helper script that rotates the entity
    const Rotator = pc.createScript('rotator');
    Rotator.prototype.update = function (/** @type {number} */ dt) {
        this.entity.rotate(5 * dt, 10 * dt, -15 * dt);
    };

    // a compute shader that will compute the histogram of the input texture and write the result to the storage buffer
    const shader = device.supportsCompute ?
        new pc.Shader(device, {
            name: 'ComputeShader',
            shaderLanguage: pc.SHADERLANGUAGE_WGSL,
            cshader: files['compute-shader.wgsl'],

              // format of a bind group, providing resources for the compute shader
            computeBindGroupFormat: new pc.BindGroupFormat(device, [
                  // input texture - the scene color map, without a sampler
                new pc.BindTextureFormat('uSceneColorMap', pc.SHADERSTAGE_COMPUTE, undefined, undefined, false),
                  // output storage buffer
                new pc.BindStorageBufferFormat('outBuffer', pc.SHADERSTAGE_COMPUTE)
            ])
        }) :
        null;

    // Create a storage buffer to which the compute shader will write the histogram values.
    const numBins = 256;
    const histogramStorageBuffer = new pc.StorageBuffer(
        device,
        numBins * 4, // 4 bytes per value, storing unsigned int
        pc.BUFFERUSAGE_COPY_SRC | // needed for reading back the data to CPU
            pc.BUFFERUSAGE_COPY_DST // needed for clearing the buffer
    );

    // Create an instance of the compute shader, and set the input and output data. Note that we do
    // not provide a value for `uSceneColorMap` as this is done by the engine internally.
    const compute = new pc.Compute(device, shader, 'ComputeHistogram');
    compute.setParameter('outBuffer', histogramStorageBuffer);

    // instantiate the spinning mesh
    const solid = assets.solid.resource.instantiateRenderEntity();
    solid.addComponent('script');
    solid.script.create('rotator');
    solid.setLocalPosition(0, 0.4, 0);
    solid.setLocalScale(0.35, 0.35, 0.35);
    app.root.addChild(solid);

    let firstFrame = true;
    app.on('update', function (/** @type {number} */ dt) {
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
            device.computeDispatch([compute]);

            // Read back the histogram data from the storage buffer. None that the returned promise
            // will be resolved later, when the GPU is done running it, and so the histogram on the
            // screen will be up to few frames behind.
            const histogramData = new Uint32Array(numBins);
            histogramStorageBuffer.read(0, undefined, histogramData).then((data) => {
                // render the histogram using lines
                const scale = 1 / 50000;
                const positions = [];
                for (let x = 0; x < data.length; x++) {
                    const value = pc.math.clamp(data[x] * scale, 0, 0.2);
                    positions.push(x * 0.001, -0.35, 4);
                    positions.push(x * 0.001, value - 0.35, 4);
                }
                app.drawLineArrays(positions, pc.Color.YELLOW);
            });
        }
    });
});

export { app };

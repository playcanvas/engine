import * as pc from 'playcanvas';
import files from '@examples/files';
import { deviceType, rootPath } from '@examples/utils';

const canvas = document.getElementById('application-canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('No canvas found');
}

const assets = {
    rocks: new pc.Asset('rocks', 'texture', { url: rootPath + '/static/assets/textures/seaside-rocks01-color.jpg' })
};

const gfxOptions = {
    deviceTypes: [deviceType],

    // Even though we're using WGSL, we still need to provide glslang
    // and twgsl to compile shaders used internally by the engine.
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);

if (!device.isWebGPU) {
    throw new Error('WebGPU is required for this example.');
}

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [pc.RenderComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

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
assetListLoader.load(async () => {
    app.start();

    // This example will use a compute shader to count the number of pixels brighter than
    // a certain specified color. The result will be written to a buffer and read back to the CPU.
    const inputTexture = assets.rocks.resource;
    const compareColor = [0.5, 0.5, 0.5];

    const width = inputTexture.width;
    const height = inputTexture.height;
    // The buffer we pass to the GPU need to be initialized with the compare color and counters of 0.
    // Since the buffer is an uint32 array, we need to convert the color to 0-255 range.
    const init = [compareColor[0] * 255, compareColor[1] * 255, compareColor[2] * 255, 0, 0];

    const buffer = new pc.Buffer(app.graphicsDevice, {
        size: 5 * 4, // 5 uint32s (3 color components, 1 counter, 1 counter for brighter pixels).
        usage: pc.BUFFER_USAGE_STORAGE | pc.BUFFER_USAGE_COPY_SRC,
        mappedAtCreation: true,
    });

    new Uint32Array(buffer.getMappedRange()).set(init);
    buffer.unmap();

    app.graphicsDevice.scope.resolve("inout").setValue(buffer);
    app.graphicsDevice.scope.resolve("inputTexture").setValue(inputTexture);

    const shaderDefinition = {
        cshader: files['shader.wgsl'],
        shaderLanguage: pc.SHADERLANGUAGE_WGSL,
    };
    const shader = new pc.Shader(app.graphicsDevice, shaderDefinition);

    shader.computeBindGroupFormat = new pc.BindGroupFormat(device, [], [
        new pc.BindTextureFormat('inputTexture', pc.SHADERSTAGE_COMPUTE, pc.TEXTUREDIMENSION_2D, pc.SAMPLETYPE_FLOAT),
    ], [
        // No storage textures used.
    ], [
        new pc.BindBufferFormat('inout', pc.SHADERSTAGE_COMPUTE),
    ]);

    const compute = new pc.Compute(app.graphicsDevice, shader);

    // Get a buffer for the result of our compute work.
    // This needs to be requested before dispatching the compute work.
    const resultBuffer = compute.getBuffer(buffer);

    app.graphicsDevice.startComputePass();
    compute.dispatch(width, height);
    app.graphicsDevice.endComputePass();

    // Map the result buffer to the CPU to read the result.
    await resultBuffer.mapAsync();

    const data = new Uint32Array(resultBuffer.getMappedRange());

    console.log('number of pixels:', data[3]);
    console.log('number of pixels brighter than', compareColor, ':', data[4]);

    // Clean up the buffers we used.
    buffer.destroy(app.graphicsDevice);
    resultBuffer.destroy(app.graphicsDevice);
});

export { app };

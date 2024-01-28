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

const inputTexture = assets.rocks.resource;
const width = inputTexture.width;
const height = inputTexture.height;

const texture = new pc.Texture(app.graphicsDevice, {
    name: 'outputTexture',
    width,
    height,
    format: pc.PIXELFORMAT_RGBA8,
    mipmaps: false,
    storage: true
});

app.graphicsDevice.scope.resolve("outputTexture").setValue(texture);
app.graphicsDevice.scope.resolve("inputTexture").setValue(inputTexture);

const shaderDefinition = {
    cshader: files['shader.wgsl'],
    shaderLanguage: pc.SHADERLANGUAGE_WGSL,
};
const shader = new pc.Shader(app.graphicsDevice, shaderDefinition);

shader.computeBindGroupFormat = new pc.BindGroupFormat(device, [], [
    new pc.BindTextureFormat('inputTexture', pc.SHADERSTAGE_COMPUTE, pc.TEXTUREDIMENSION_2D, pc.SAMPLETYPE_FLOAT),
], [
    new pc.BindStorageTextureFormat('outputTexture', pc.PIXELFORMAT_RGBA8, pc.TEXTUREDIMENSION_2D),
], {
    compute: true
});

const compute = new pc.Compute(app.graphicsDevice, shader);
const buffer = compute.getBuffer(texture);

app.graphicsDevice.startComputePass();
compute.dispatch(width, height);
// TODO: potentially dispatch more compute work in the same pass.
app.graphicsDevice.endComputePass();

const data = await buffer.getMappedRange();

console.log(data);

buffer.destroy(app.graphicsDevice);

export { app };

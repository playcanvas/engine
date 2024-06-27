// @config WEBGL_DISABLED
// @config HIDDEN
import * as pc from 'playcanvas';
import files from 'examples/files';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// Even though we're using WGSL, we still need to provide glslang
// and twgsl to compile shaders used internally by the engine.
const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);


if (!device.isWebGPU) {
    throw new Error('WebGPU is required for this example.');
}

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem];
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

const shaderDefinition = {
    vshader: files['shader.wgsl'],
    fshader: files['shader.wgsl'],
    shaderLanguage: pc.SHADERLANGUAGE_WGSL,

    // For now WGSL shaders need to provide their own bind group formats as they aren't processed.
    // This has to match the ub_mesh struct in the shader.
    meshUniformBufferFormat: new pc.UniformBufferFormat(app.graphicsDevice, [
        new pc.UniformFormat('matrix_model', pc.UNIFORMTYPE_MAT4),
        new pc.UniformFormat('amount', pc.UNIFORMTYPE_FLOAT)
    ]),
    meshBindGroupFormat: new pc.BindGroupFormat(app.graphicsDevice, [])
};
const shader = new pc.Shader(app.graphicsDevice, shaderDefinition);

const material = new pc.Material();
material.shader = shader;

// create box entity
const box = new pc.Entity('cube');
box.addComponent('render', {
    type: 'box',
    material: material
});
app.root.addChild(box);

// create camera entity
const camera = new pc.Entity('camera');
camera.addComponent('camera', {
    clearColor: new pc.Color(0.5, 0.6, 0.9)
});
app.root.addChild(camera);
camera.setPosition(0, 0, 3);

// Rotate the box according to the delta time since the last frame.
// Update the material's 'amount' parameter to animate the color.
let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    box.rotate(10 * dt, 20 * dt, 30 * dt);

    time += dt;
    // animate the amount as a sine wave varying from 0 to 1
    material.setParameter('amount', (Math.sin(time * 4) + 1) * 0.5);
});

export { app };

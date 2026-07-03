// @config
//
// This example shows a basic usage of indirect drawing, and the compute shader changes the number of
// instances that are rendered.
//
// @flag WEBGL_DISABLED

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BindGroupFormat,
    BindStorageBufferFormat,
    BindUniformBufferFormat,
    CameraComponentSystem,
    Color,
    Compute,
    Entity,
    FILLMODE_FILL_WINDOW,
    Mat4,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADERLANGUAGE_WGSL,
    SHADERSTAGE_COMPUTE,
    Shader,
    ShaderChunks,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    UNIFORMTYPE_FLOAT,
    UNIFORMTYPE_IVEC4,
    UNIFORMTYPE_UINT,
    UniformBufferFormat,
    UniformFormat,
    Vec3,
    VertexBuffer,
    VertexFormat,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

import computeShaderWgsl from './compute-shader.wgsl';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
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

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem];
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

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// setup skydome
app.scene.skyboxMip = 2;
app.scene.exposure = 0.7;
app.scene.envAtlas = assets.helipad.resource;

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    toneMapping: TONEMAP_ACES
});
app.root.addChild(camera);
camera.translate(0, 0, 10);

// create standard material that will be used on the instanced spheres
const material = new StandardMaterial();
material.diffuse = new Color(1, 1, 0.5);
material.gloss = 1;
material.metalness = 1;
material.useMetalness = true;
material.update();

// Create a Entity with a sphere render component and the material
const sphere = new Entity('InstancingEntity');
sphere.addComponent('render', {
    material: material,
    type: 'sphere'
});
app.root.addChild(sphere);

// number of instances to render
const instanceCount = 1000;

// store matrices for individual instances into array
const matrices = new Float32Array(instanceCount * 16);
let matrixIndex = 0;

const radius = 5;
const pos = new Vec3();
const rot = new Quat();
const scl = new Vec3();
const matrix = new Mat4();

for (let i = 0; i < instanceCount; i++) {
    // generate positions / scales and rotations
    pos.set(
        Math.random() * radius - radius * 0.5,
        Math.random() * radius - radius * 0.5,
        Math.random() * radius - radius * 0.5
    );
    scl.set(0.2, 0.2, 0.2);
    rot.setFromEulerAngles(0, 0, 0);
    matrix.setTRS(pos, rot, scl);

    // copy matrix elements into array of floats
    for (let m = 0; m < 16; m++) matrices[matrixIndex++] = matrix.data[m];
}

// create static vertex buffer containing the matrices
const vbFormat = VertexFormat.getDefaultInstancingFormat(app.graphicsDevice);
const vertexBuffer = new VertexBuffer(app.graphicsDevice, vbFormat, instanceCount, {
    data: matrices
});

// initialize instancing using the vertex buffer on meshInstance of the created sphere
const sphereMeshInst = sphere.render.meshInstances[0];
sphereMeshInst.setInstancing(vertexBuffer);

// create a compute shader which will be used to update the number of instances to be rendered each frame
const shader = device.supportsCompute
    ? new Shader(device, {
          name: 'ComputeShader',
          shaderLanguage: SHADERLANGUAGE_WGSL,
          cshader: computeShaderWgsl,

          // include all WGSL chunks to be available for including in the compute shader
          cincludes: ShaderChunks.get(device, SHADERLANGUAGE_WGSL),

          // format of a uniform buffer used by the compute shader
          computeUniformBufferFormats: {
              ub: new UniformBufferFormat(device, [
                  // metadata about the mesh (how many indicies it has and similar, used to generate draw call parameters)
                  new UniformFormat('indirectMetaData', UNIFORMTYPE_IVEC4),

                  // time to animate number of visible instances
                  new UniformFormat('time', UNIFORMTYPE_FLOAT),

                  // maximum number of instances
                  new UniformFormat('maxInstanceCount', UNIFORMTYPE_UINT),

                  // indirect slot into storage buffer which stored draw call parameters
                  new UniformFormat('indirectSlot', UNIFORMTYPE_UINT)
              ])
          },

          // format of a bind group, providing resources for the compute shader
          computeBindGroupFormat: new BindGroupFormat(device, [
              // a uniform buffer we provided format for
              new BindUniformBufferFormat('ub', SHADERSTAGE_COMPUTE),

              // the buffer with indirect draw arguments
              new BindStorageBufferFormat('indirectDrawBuffer', SHADERSTAGE_COMPUTE)
          ])
      })
    : null;

// Create an instance of the compute shader, and provide it with uniform values that do not change each frame
const compute = new Compute(device, shader, 'ComputeModifyVB');
compute.setParameter('maxInstanceCount', instanceCount);
compute.setParameter('indirectMetaData', sphereMeshInst.getIndirectMetaData());

// Set an update function on the app's update event
let angle = 0;
let time = 0;
app.on('update', dt => {
    time += dt;

    // obtain available slot in the indirect draw buffer - this needs to be done each frame
    const indirectSlot = app.graphicsDevice.getIndirectDrawSlot();

    // and assign it to the mesh instance for all cameras (null parameter)
    sphereMeshInst.setIndirect(null, indirectSlot);

    // give compute shader the indirect draw buffer - this can change between frames, so assign it each frame
    compute.setParameter('indirectDrawBuffer', app.graphicsDevice.indirectDrawBuffer);

    // update compute shader parameters
    compute.setParameter('time', time);
    compute.setParameter('indirectSlot', indirectSlot);

    // set up the compute dispatch
    compute.setupDispatch(1);

    // dispatch the compute shader
    device.computeDispatch([compute], 'ComputeIndirectDraw');

    // orbit camera around
    angle += dt * 0.2;
    camera.setLocalPosition(8 * Math.sin(angle), 0, 8 * Math.cos(angle));
    camera.lookAt(Vec3.ZERO);
});

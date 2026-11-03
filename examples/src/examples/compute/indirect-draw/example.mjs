// @config
// @flag WEBGL_DISABLED
//
// Indirect drawing: the draw call takes its parameters from a GPU buffer, which a compute shader
// writes every frame. Here the compute shader sets the number of instances to draw, so the golden
// spiral of beads opens and closes like a flower, without the CPU knowing how many are drawn.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BindGroupFormat,
    BindStorageBufferFormat,
    BindUniformBufferFormat,
    CameraComponentSystem,
    CameraFrame,
    Color,
    Compute,
    Entity,
    FILLMODE_FILL_WINDOW,
    LAYERID_IMMEDIATE,
    LAYERID_UI,
    LAYERID_WORLD,
    LightComponentSystem,
    Mat4,
    MiniStats,
    Mouse,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADERLANGUAGE_WGSL,
    SHADERSTAGE_COMPUTE,
    ScriptComponentSystem,
    Shader,
    ShaderChunks,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_NEUTRAL,
    TextureHandler,
    TouchDevice,
    UNIFORMTYPE_FLOAT,
    UNIFORMTYPE_IVEC4,
    UNIFORMTYPE_UINT,
    UniformBufferFormat,
    UniformFormat,
    Vec2,
    Vec3,
    VertexBuffer,
    VertexFormat,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

import computeShaderWgsl from './compute-shader.wgsl';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
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

// The compute dispatches and compute passes of each frame are shown next to the other stats
const miniStats = new MiniStats(app, MiniStats.getDefaultOptions(['compute']));

data.set('settings', {
    speed: 1,
    instances: 2000
});

// The studio environment gives the beads their reflections. The camera does not render the skybox
// layer, so the background is the clear color.
app.scene.envAtlas = assets.envAtlas.resource;

// ----- The beads -----

// Polished gold
const material = new StandardMaterial();
material.diffuse = new Color(1, 0.76, 0.45);
material.useMetalness = true;
material.metalness = 1;
material.gloss = 0.8;
material.update();

// A sphere, drawn instanced as the beads
const flower = new Entity('Flower');
flower.addComponent('render', {
    material: material,
    type: 'sphere'
});
app.root.addChild(flower);

// The beads are placed on a golden spiral, the pattern of the seeds of a sunflower: each point is
// turned by the golden angle from the previous one, and moved a little further out, so the points
// fill a disc evenly. Only the points inside the outline of a flower with five petals are kept,
// and the flower curves up into a bowl, lifting the tips of the petals. The beads are stored from
// the center out, so drawing the first N of them draws the flower up to a radius.
const goldenAngle = Math.PI * (3 - Math.sqrt(5));
const flowerRadius = 5;
const points = 3200;

/** @type {number[]} */
const matrices = [];
const position = new Vec3();
const scale = new Vec3();
const matrix = new Mat4();

for (let i = 0; i < points; i++) {
    const distance = flowerRadius * Math.sqrt(i / points);
    const angle = i * goldenAngle;

    // the outline of the petals: the full radius at the middle of each petal, and less than half of
    // it between them
    const outline = flowerRadius * (0.35 + 0.65 * Math.abs(Math.cos(angle * 2.5)));
    if (distance > outline) continue;

    position.set(distance * Math.cos(angle), 0.1 * distance * distance, distance * Math.sin(angle));

    // the beads grow a little towards the tips of the petals
    const size = 0.11 + 0.03 * distance;
    scale.set(size, size, size);

    matrix.setTRS(position, Quat.IDENTITY, scale);
    matrices.push(...matrix.data);
}
const instanceCount = matrices.length / 16;

// Create static vertex buffer containing the matrices, and draw the sphere instanced using it
const vertexBuffer = new VertexBuffer(device, VertexFormat.getDefaultInstancingFormat(device), instanceCount, {
    data: new Float32Array(matrices)
});
const meshInstance = flower.render.meshInstances[0];
meshInstance.setInstancing(vertexBuffer);

// ----- The camera and the lights -----

const camera = new Entity('Camera');
// the camera frame treats the clear color as a linear color, so it is converted from sRGB
camera.addComponent('camera', {
    clearColor: new Color().fromString('#0c0e14').linear(),
    layers: [LAYERID_WORLD, LAYERID_IMMEDIATE, LAYERID_UI]
});
camera.addComponent('script');
camera.setLocalPosition(0, 8.5, 12);
app.root.addChild(camera);

const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = new Vec3(0, 1.2, 0);
cameraControls.enableFly = false;
cameraControls.pitchRange = new Vec2(-89, 0);
cameraControls.zoomRange = new Vec2(4, 20);

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

// Seen from the starting camera position: a warm key light from the upper left, and two colored
// rim lights from behind the flower
createLight('#fff1e0', 1.5, [45, -35, 0]);
createLight('#ff3da8', 2, [-60, 120, 0]);
createLight('#3d8bff', 2, [-60, -120, 0]);

// Bloom makes the highlights glow. The neutral tone mapping keeps the color of the gold.
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.samples = 4;
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;
cameraFrame.bloom.intensity = 0.02;
cameraFrame.bloom.blurLevel = 6;
cameraFrame.vignette.intensity = 0.5;
cameraFrame.update();

// ----- The compute shader -----

// A compute shader which writes the parameters of the draw call each frame, including the number of
// instances to draw
const shader = device.supportsCompute
    ? new Shader(device, {
          name: 'ComputeShader',
          shaderLanguage: SHADERLANGUAGE_WGSL,
          cshader: computeShaderWgsl,

          // Include all WGSL chunks to be available for including in the compute shader
          cincludes: ShaderChunks.get(device, SHADERLANGUAGE_WGSL),

          // Format of a uniform buffer used by the compute shader
          computeUniformBufferFormats: {
              ub: new UniformBufferFormat(device, [
                  // metadata about the mesh (how many indices it has and similar, used to generate draw call parameters)
                  new UniformFormat('indirectMetaData', UNIFORMTYPE_IVEC4),

                  // Time to animate number of visible instances
                  new UniformFormat('time', UNIFORMTYPE_FLOAT),

                  // Maximum number of instances
                  new UniformFormat('maxInstanceCount', UNIFORMTYPE_UINT),

                  // Indirect slot into storage buffer which stored draw call parameters
                  new UniformFormat('indirectSlot', UNIFORMTYPE_UINT)
              ])
          },

          // Format of a bind group, providing resources for the compute shader
          computeBindGroupFormat: new BindGroupFormat(device, [
              // a uniform buffer we provided format for
              new BindUniformBufferFormat('ub', SHADERSTAGE_COMPUTE),

              // The buffer with indirect draw arguments
              new BindStorageBufferFormat('indirectDrawBuffer', SHADERSTAGE_COMPUTE)
          ])
      })
    : null;

// Create an instance of the compute shader, and provide it with the mesh metadata, which does not
// change each frame
const compute = new Compute(device, shader, 'ComputeIndirectDraw');
compute.setParameter('indirectMetaData', meshInstance.getIndirectMetaData());

let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    const settings = data.get('settings');
    time += dt * settings.speed;

    // Obtain available slot in the indirect draw buffer - this needs to be done each frame
    const indirectSlot = device.getIndirectDrawSlot();

    // and assign it to the mesh instance for all cameras (null parameter)
    meshInstance.setIndirect(null, indirectSlot);

    // Give compute shader the indirect draw buffer - this can change between frames, so assign it each frame
    compute.setParameter('indirectDrawBuffer', device.indirectDrawBuffer);

    // Update compute shader parameters
    compute.setParameter('time', time);
    // the number of instances can't be more than the vertex buffer holds
    compute.setParameter('maxInstanceCount', Math.min(settings.instances, instanceCount));
    compute.setParameter('indirectSlot', indirectSlot);

    // Set up the compute dispatch, and dispatch the compute shader
    compute.setupDispatch(1);
    device.computeDispatch([compute], 'ComputeIndirectDraw');
});

export { miniStats };

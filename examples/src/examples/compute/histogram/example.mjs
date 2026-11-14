// @config
// @flag WEBGL_DISABLED
//
// A compute shader counts the colors of every pixel the camera renders into a histogram of the red,
// green and blue channels and the luminance. The panel draws the histogram straight from the GPU
// buffer the compute shader wrote, so it is never read back to the CPU. Three colored spot lights
// circle a ceramic knot, moving the channels apart and together.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_NORMAL,
    BUFFERUSAGE_COPY_DST,
    CULLFACE_NONE,
    CameraComponentSystem,
    Color,
    Compute,
    ComputePass,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    FOG_LINEAR,
    LAYERID_DEPTH,
    LAYERID_IMMEDIATE,
    LAYERID_UI,
    LAYERID_WORLD,
    LightComponentSystem,
    Mesh,
    MeshInstance,
    MiniStats,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADERLANGUAGE_WGSL,
    ScriptComponentSystem,
    Shader,
    ShaderMaterial,
    StandardMaterial,
    StorageBuffer,
    TEXTURETYPE_RGBP,
    TONEMAP_NEUTRAL,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

import computeShaderWgsl from './compute-shader.wgsl';
import panelFragmentWgsl from './panel.wgsl.frag';
import panelVertexWgsl from './panel.wgsl.vert';

// Note: the compute shader is based on this article:
// https://webgpufundamentals.org/webgpu/lessons/webgpu-compute-shaders-histogram.html

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    knot: new Asset('knot', 'container', { url: './assets/models/trefoil-knot.glb' }),
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
    exposure: 1,
    speed: 1
});

// The studio environment gives the knot soft reflections and a little ambient light. The camera
// does not render the skybox layer, so the background is the black clear color, and the floor
// fades to black in the distance.
app.scene.envAtlas = assets.envAtlas.resource;
app.scene.skyboxIntensity = 0.15;
app.scene.fog.type = FOG_LINEAR;
app.scene.fog.color = Color.BLACK;
app.scene.fog.start = 8;
app.scene.fog.end = 18;

// ----- The scene -----

// The knot, a model made for this example, floating above the floor
const knot = assets.knot.resource.instantiateRenderEntity();
knot.setLocalPosition(0, 1.9, 0);
knot.setLocalScale(0.8, 0.8, 0.8);
app.root.addChild(knot);

const floorMaterial = new StandardMaterial();
floorMaterial.diffuse = new Color(0.35, 0.35, 0.37);
floorMaterial.gloss = 0.4;
floorMaterial.update();

const floor = new Entity('Floor');
floor.addComponent('render', { type: 'plane', material: floorMaterial });
floor.setLocalScale(40, 1, 40);
app.root.addChild(floor);

// Three colored spot lights, which circle above the knot and shine down on it. Where their light
// overlaps, the colors add up to white.
const lights = ['#ff3da8', '#3dd8ff', '#ffb43d'].map((color) => {
    const light = new Entity('SpotLight');
    light.addComponent('light', {
        type: 'spot',
        color: new Color().fromString(color),
        intensity: 4,
        range: 20,
        innerConeAngle: 14,
        outerConeAngle: 26,
        castShadows: true,
        shadowResolution: 1024,
        shadowBias: 0.2,
        normalOffsetBias: 0.05
    });
    app.root.addChild(light);
    return light;
});

// ----- The camera -----

const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: Color.BLACK,
    toneMapping: TONEMAP_NEUTRAL,
    // the depth layer is where the camera captures the color map of the scene
    layers: [LAYERID_WORLD, LAYERID_DEPTH, LAYERID_IMMEDIATE, LAYERID_UI]
});
camera.addComponent('script');
camera.setLocalPosition(0, 3.5, 7.5);
app.root.addChild(camera);

const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = new Vec3(0, 1.6, 0);
cameraControls.enableFly = false;
cameraControls.pitchRange = new Vec2(-80, 5);
cameraControls.zoomRange = new Vec2(3, 15);

// Enable the camera to render the scene's color map. This allows us to use the rendered scene as an
// input for the histogram compute shader. The color map is captured once the opaque objects are
// rendered, so the histogram panel, rendered later in the UI layer, is not part of it.
camera.camera.requestSceneColorMap(true);

// ----- The histogram -----

// A compute shader that will compute the histogram of the scene color map and write the result to
// the storage buffer. Its resources use the simplified WGSL syntax, and are reflected automatically.
const shader = device.supportsCompute
    ? new Shader(device, {
          name: 'ComputeShader',
          shaderLanguage: SHADERLANGUAGE_WGSL,
          cshader: computeShaderWgsl
      })
    : null;

// Create a storage buffer to which the compute shader will write the histogram values, 256 bins
// for each of the red, green and blue channels and the luminance
const numBins = 256;
const histogramStorageBuffer = new StorageBuffer(
    device,
    4 * numBins * 4, // 4 bytes per value, storing unsigned int
    BUFFERUSAGE_COPY_DST // needed for clearing the buffer
);

// Create an instance of the compute shader, and set the input and output data. The scene color map
// of the camera is attached once - each dispatch then reads the color map the camera rendered most
// recently.
const compute = new Compute(device, shader, 'ComputeHistogram');
compute.setSceneColorMap(camera.camera.sceneColorMapHandle);
compute.setParameter('bins', histogramStorageBuffer);

// The compute shader runs after the camera renders, so it processes the color map of the frame the
// camera rendered
const computePass = new ComputePass(device, [compute]);
computePass.name = 'HistogramPass';
if (device.supportsCompute) {
    camera.camera.afterPasses.push(computePass);
}

// The material of the panel. Its shader reads the histogram from the storage buffer, and draws the
// panel with the histogram in it.
const panelMaterial = new ShaderMaterial({
    uniqueName: 'HistogramPanel',
    vertexWGSL: panelVertexWgsl,
    fragmentWGSL: panelFragmentWgsl
});
panelMaterial.name = 'HistogramPanel';
panelMaterial.setParameter('bins', histogramStorageBuffer);

// The number of pixels the histogram counted is set when the compute pass runs, which is after the
// panel renders in the first frame. The histogram is empty then, so any count shows it the same.
panelMaterial.setParameter('pixelCount', 1);

panelMaterial.blendType = BLEND_NORMAL;
panelMaterial.depthTest = false;
panelMaterial.depthWrite = false;
panelMaterial.cull = CULLFACE_NONE;
panelMaterial.update();

// The panel is a quad without a vertex buffer, its corners placed on the screen by the vertex
// shader. It is rendered in the UI layer, on top of the scene.
const panelMesh = new Mesh(device);
panelMesh.setIndices([0, 1, 2, 2, 1, 3]);
panelMesh.update();
const panelMeshInstance = new MeshInstance(panelMesh, panelMaterial);
panelMeshInstance.cull = false;

const panel = new Entity('HistogramPanel');
panel.addComponent('render', {
    meshInstances: [panelMeshInstance],
    layers: [LAYERID_UI]
});
app.root.addChild(panel);

// The page element the panel is drawn over, which sets its size and place, and holds its labels
const panelElement = document.createElement('div');
panelElement.style.cssText = `
    position: absolute; right: 20px; bottom: 20px; width: min(570px, calc(100% - 40px)); height: 255px;
    box-sizing: border-box; padding: 14px 16px; pointer-events: none; display: flex; justify-content: space-between;
    font: 600 11px system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: #a7afbd;`;
panelElement.innerHTML = `
    <span>Histogram</span>
    <span><span style="color: #ff5a6e">R</span>&nbsp;&nbsp;<span style="color: #4cd97b">G</span>&nbsp;&nbsp;<span
        style="color: #5b8cff">B</span>&nbsp;&nbsp;<span style="color: #ffffff">L</span></span>`;
document.body.appendChild(panelElement);
app.on('destroy', () => panelElement.remove());

// Right before the compute pass dispatches, set up the size of the dispatch, a thread for each
// texel of the color map the camera just rendered, and clear the storage buffer, to avoid the
// accumulation buildup. The panel was rendered earlier in the frame, and shows the histogram of the
// previous frame.
computePass.onBefore = () => {
    const { width, height } = camera.camera.sceneColorMapHandle;
    compute.setupDispatchThreads(width, height);
    histogramStorageBuffer.clear();
    panelMaterial.setParameter('pixelCount', width * height);
};

let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    const settings = data.get('settings');
    time += dt * settings.speed;
    app.scene.exposure = settings.exposure;

    // the lights circle the knot, a third of a turn apart, and rise and fall
    lights.forEach((light, i) => {
        const angle = time * 0.6 + (i * Math.PI * 2) / 3;
        light.setLocalPosition(4 * Math.cos(angle), 5.5 + Math.sin(time * 0.9 + i * 2), 4 * Math.sin(angle));
        light.lookAt(0, 1.2, 0);
        light.rotateLocal(90, 0, 0);
    });

    // slowly turn the knot
    knot.setLocalEulerAngles(0, time * 12, 0);

    // place the panel over its page element, converting its rectangle to normalized device
    // coordinates
    const rect = panelElement.getBoundingClientRect();
    const bounds = canvas.getBoundingClientRect();
    panelMaterial.setParameter('panelRect', [
        ((rect.left - bounds.left) / bounds.width) * 2 - 1,
        1 - ((rect.bottom - bounds.top) / bounds.height) * 2,
        ((rect.right - bounds.left) / bounds.width) * 2 - 1,
        1 - ((rect.top - bounds.top) / bounds.height) * 2
    ]);
    panelMaterial.setParameter('panelSize', [rect.width, rect.height]);
});

export { miniStats };

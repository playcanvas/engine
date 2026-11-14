// @config
// @flag WEBGL_DISABLED
//
// A compute shader moves the vertices of a mesh every frame, turning it into a liquid, iridescent
// blob. It writes the new positions and normals straight into the vertex buffer of the mesh, which
// is then rendered as usual. The glowing wireframe draws the same mesh, showing its vertices move.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_ADDITIVE,
    BindGroupFormat,
    BindStorageBufferFormat,
    BindUniformBufferFormat,
    BoundingBox,
    BoxGeometry,
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
    Mesh,
    MeshInstance,
    MiniStats,
    Mouse,
    RENDERSTYLE_WIREFRAME,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SEMANTIC_NORMAL,
    SEMANTIC_POSITION,
    SHADERLANGUAGE_WGSL,
    SHADERSTAGE_COMPUTE,
    ScriptComponentSystem,
    Shader,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_NEUTRAL,
    TextureHandler,
    TouchDevice,
    UNIFORMTYPE_FLOAT,
    UNIFORMTYPE_UINT,
    UniformBufferFormat,
    UniformFormat,
    Vec2,
    Vec3,
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
    amplitude: 0.5,
    speed: 1,
    wireframe: true
});

// The studio environment gives the blob its reflections. The camera does not render the skybox
// layer, so the background is the clear color.
app.scene.envAtlas = assets.envAtlas.resource;

// ----- The blob -----

// A finely divided box. The compute shader moves each vertex onto the blob surface along its
// direction from the center, which turns the box into a sphere with evenly spaced vertices, and no
// poles where the vertices crowd together. Its vertex buffer is created as a storage buffer, so the
// compute shader can write to it.
const mesh = Mesh.fromGeometry(
    device,
    new BoxGeometry({
        widthSegments: 48,
        lengthSegments: 48,
        heightSegments: 48
    }),
    { storageVertex: true }
);

// The bounds of the mesh are computed from the box, but the compute shader moves the vertices past
// them, so they are made large enough for culling to keep the blob visible
mesh.aabb = new BoundingBox(Vec3.ZERO, new Vec3(1.9, 1.9, 1.9));

// Polished metal with a thin film on it, which tints the reflections with shifting rainbow colors
const material = new StandardMaterial();
material.diffuse = new Color(0.95, 0.95, 0.97);
material.useMetalness = true;
material.metalness = 1;
material.gloss = 0.75;
material.useIridescence = true;
material.iridescence = 0.6;
material.iridescenceRefractionIndex = 1.5;
material.iridescenceThicknessMax = 550;
material.update();

const blob = new Entity('Blob');
blob.addComponent('render', {
    meshInstances: [new MeshInstance(mesh, material)]
});
app.root.addChild(blob);

// The wireframe renders the same mesh again, as glowing lines added on top of the blob. It is
// scaled up a little, so the lines are not hidden by the surface they lie on.
const wireMaterial = new StandardMaterial();
wireMaterial.diffuse = Color.BLACK;
wireMaterial.emissive = new Color().fromString('#4fd8ff');
wireMaterial.emissiveIntensity = 0.15;
wireMaterial.blendType = BLEND_ADDITIVE;
wireMaterial.depthWrite = false;
wireMaterial.useLighting = false;
wireMaterial.useSkybox = false;
wireMaterial.update();

const wireframe = new Entity('Wireframe');
wireframe.addComponent('render', {
    meshInstances: [new MeshInstance(mesh, wireMaterial)]
});
wireframe.render.renderStyle = RENDERSTYLE_WIREFRAME;
wireframe.setLocalScale(1.004, 1.004, 1.004);
blob.addChild(wireframe);

// ----- The camera and the lights -----

const camera = new Entity('Camera');
// the camera frame treats the clear color as a linear color, so it is converted from sRGB
camera.addComponent('camera', {
    clearColor: new Color().fromString('#0c0e14').linear(),
    layers: [LAYERID_WORLD, LAYERID_IMMEDIATE, LAYERID_UI]
});
camera.addComponent('script');
camera.setLocalPosition(0, 1, 5.8);
app.root.addChild(camera);

const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = Vec3.ZERO;
cameraControls.enableFly = false;
cameraControls.pitchRange = new Vec2(-90, 90);
cameraControls.zoomRange = new Vec2(2.5, 10);

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

// Seen from the starting camera position: a soft key light from the upper left, two colored rim
// lights from behind the blob, which outline it against the dark background, and a violet light
// from below
createLight('#fff1e0', 1.5, [45, -35, 0]);
createLight('#ff3da8', 3, [-60, 120, 0]);
createLight('#3d8bff', 3, [-60, -120, 0]);
createLight('#7a3dff', 2.5, [150, 0, 0]);

// Bloom makes the highlights and the wireframe glow. The neutral tone mapping keeps their colors.
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.samples = 4;
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;
cameraFrame.bloom.intensity = 0.03;
cameraFrame.bloom.blurLevel = 6;
cameraFrame.vignette.intensity = 0.5;
cameraFrame.update();

// ----- The compute shader -----

// The compute shader, which moves the vertices of the mesh every frame
const shader = device.supportsCompute
    ? new Shader(device, {
          name: 'ComputeShader',
          shaderLanguage: SHADERLANGUAGE_WGSL,
          cshader: computeShaderWgsl,

          // Format of a uniform buffer used by the compute shader
          computeUniformBufferFormats: {
              ub: new UniformBufferFormat(device, [
                  new UniformFormat('count', UNIFORMTYPE_UINT),
                  new UniformFormat('positionOffset', UNIFORMTYPE_UINT),
                  new UniformFormat('normalOffset', UNIFORMTYPE_UINT),
                  new UniformFormat('time', UNIFORMTYPE_FLOAT),
                  new UniformFormat('amplitude', UNIFORMTYPE_FLOAT)
              ])
          },

          // Format of a bind group, providing resources for the compute shader
          computeBindGroupFormat: new BindGroupFormat(device, [
              // a uniform buffer we provided format for
              new BindUniformBufferFormat('ub', SHADERSTAGE_COMPUTE),
              // The vertex buffer we want to modify
              new BindStorageBufferFormat('vb', SHADERSTAGE_COMPUTE)
          ])
      })
    : null;

// Information about the vertex buffer format - offset of position and normal attributes
// Note: data is stored non-interleaved, positions together, normals together, so no need
// to worry about stride
const format = mesh.vertexBuffer.format;
const positionElement = format.elements.find((e) => e.name === SEMANTIC_POSITION);
const normalElement = format.elements.find((e) => e.name === SEMANTIC_NORMAL);

// Create an instance of the compute shader, and provide it the mesh vertex buffer
const compute = new Compute(device, shader, 'ComputeModifyVB');
compute.setParameter('vb', mesh.vertexBuffer);
compute.setParameter('count', mesh.vertexBuffer.numVertices);
compute.setParameter('positionOffset', positionElement?.offset / 4); // number of floats offset
compute.setParameter('normalOffset', normalElement?.offset / 4); // number of floats offset

let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    const settings = data.get('settings');
    time += dt * settings.speed;

    // Update non-constant parameters each frame
    compute.setParameter('time', time);
    compute.setParameter('amplitude', settings.amplitude);

    // Set up the dispatch, a thread for each vertex
    compute.setupDispatchThreads(mesh.vertexBuffer.numVertices);

    // Dispatch the compute shader
    device.computeDispatch([compute], 'ModifyVBDispatch');

    // Slowly turn the blob, and show or hide the wireframe
    blob.setLocalEulerAngles(time * 4, time * 10, 0);
    wireframe.enabled = settings.wireframe;
});

export { miniStats };

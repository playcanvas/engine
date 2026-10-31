// @config
//
// This example shows how to use the instancing feature of a StandardMaterial to render multiple copies
// of a mesh.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    Mat4,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    Vec3,
    VertexBuffer,
    VertexFormat,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

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

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Setup skydome
app.scene.skyboxMip = 2;
app.scene.exposure = 0.3;
app.scene.envAtlas = assets.helipad.resource;

app.scene.ambientLight = new Color(0.1, 0.1, 0.1);

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    toneMapping: TONEMAP_ACES
});
app.root.addChild(camera);

// Move the camera back to see the cubes
camera.translate(0, 0, 10);

// Create standard material and enable instancing on it
const material = new StandardMaterial();
material.gloss = 0.6;
material.metalness = 0.7;
material.useMetalness = true;
material.update();

// Create a Entity with a cylinder render component and the instancing material
const cylinder = new Entity('InstancingEntity');
cylinder.addComponent('render', {
    material: material,
    type: 'cylinder'
});

// Add the box entity to the hierarchy
app.root.addChild(cylinder);

// Number of instances to render
const instanceCount = 1000;

// Store matrices for individual instances into array
const matrices = new Float32Array(instanceCount * 16);
let matrixIndex = 0;

const radius = 5;
const pos = new Vec3();
const rot = new Quat();
const scl = new Vec3();
const matrix = new Mat4();

for (let i = 0; i < instanceCount; i++) {
    // Generate random positions / scales and rotations
    pos.set(
        Math.random() * radius - radius * 0.5,
        Math.random() * radius - radius * 0.5,
        Math.random() * radius - radius * 0.5
    );
    scl.set(0.1 + Math.random() * 0.1, 0.1 + Math.random() * 0.3, 0.1 + Math.random() * 0.1);
    rot.setFromEulerAngles(i * 30, i * 50, i * 70);
    matrix.setTRS(pos, rot, scl);

    // Copy matrix elements into array of floats
    for (let m = 0; m < 16; m++) matrices[matrixIndex++] = matrix.data[m];
}

// Create static vertex buffer containing the matrices
const vbFormat = VertexFormat.getDefaultInstancingFormat(app.graphicsDevice);
const vertexBuffer = new VertexBuffer(app.graphicsDevice, vbFormat, instanceCount, {
    data: matrices
});

// Initialize instancing using the vertex buffer on meshInstance of the created box
const cylinderMeshInst = cylinder.render.meshInstances[0];
cylinderMeshInst.setInstancing(vertexBuffer);

// Set an update function on the app's update event
let angle = 0;
app.on('update', (dt) => {
    // Orbit camera around
    angle += dt * 0.2;
    camera.setLocalPosition(8 * Math.sin(angle), 0, 8 * Math.cos(angle));
    camera.lookAt(Vec3.ZERO);
});

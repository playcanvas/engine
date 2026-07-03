// @config
//
// This example shows how to override shader chunks of {accent:StandardMaterial}.
//
// @credit
// title: Low-poly Tree with Twisting Branches
// author: Sketchfab
// source: https://sketchfab.com/3d-models/low-poly-tree-with-twisting-branches-4e2589134f2442bcbdab51c1f306cd58
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    Mat4,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADERLANGUAGE_GLSL,
    SHADERLANGUAGE_WGSL,
    StandardMaterial,
    TONEMAP_ACES,
    TextureHandler,
    Vec3,
    VertexBuffer,
    VertexFormat,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

import * as shaderChunksGlsl from './shader-chunks.glsl.mjs';
import * as shaderChunksWgsl from './shader-chunks.wgsl.mjs';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    tree: new Asset('cube', 'container', { url: './assets/models/low-poly-tree.glb' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

// Determine shader language and import the appropriate shader chunks
const shaderLanguage = device.isWebGPU ? SHADERLANGUAGE_WGSL : SHADERLANGUAGE_GLSL;
const shaderChunks = device.isWebGPU ? shaderChunksWgsl : shaderChunksGlsl;

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
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

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

app.scene.ambientLight = new Color(0.4, 0.2, 0.0);

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    toneMapping: TONEMAP_ACES,
    clearColor: new Color(0.95, 0.95, 0.95)
});
app.root.addChild(camera);

// Add a shadow casting directional light
const light = new Entity();
light.addComponent('light', {
    type: 'directional',
    castShadows: true,
    shadowBias: 0.2,
    normalOffsetBias: 0.06,
    shadowDistance: 35
});
app.root.addChild(light);
light.setLocalEulerAngles(45, 30, 0);

// Number of tree instances to render
const instanceCount = 1000;

// Store matrices for individual instances into array
const matrices = new Float32Array(instanceCount * 16);
let matrixIndex = 0;

const pos = new Vec3();
const rot = new Quat();
const scl = new Vec3();
const matrix = new Mat4();

for (let i = 0; i < instanceCount; i++) {
    // Random points in the circle
    const maxRadius = 20;
    const angle = Math.random() * 2 * Math.PI;
    const radius = Math.sqrt(Math.random() * maxRadius ** 2);

    // Generate random positions / scales and rotations
    pos.set(radius * Math.cos(angle), 0, radius * Math.sin(angle));
    scl.set(0.1 + Math.random() * 0.2, 0.1 + Math.random() * 0.3, 0.1 + Math.random() * 0.2);
    pos.y = -1.5 + scl.y * 4.5;
    matrix.setTRS(pos, rot, scl);

    // Copy matrix elements into array of floats
    for (let m = 0; m < 16; m++) matrices[matrixIndex++] = matrix.data[m];
}

// Create static vertex buffer containing the matrices
const vbFormat = VertexFormat.getDefaultInstancingFormat(app.graphicsDevice);
const vertexBuffer = new VertexBuffer(app.graphicsDevice, vbFormat, instanceCount, {
    data: matrices
});

// Create a forest by setting up the tree model for instancing
const forest = assets.tree.resource.instantiateRenderEntity();
app.root.addChild(forest);
const meshInstance = forest.findComponent('render').meshInstances[0];
meshInstance.setInstancing(vertexBuffer);

// Apply shader chunks to the tree material
const treeChunks = meshInstance.material.getShaderChunks(shaderLanguage);
treeChunks.add(shaderChunks);
meshInstance.material.shaderChunksVersion = '2.8';

// Create a ground material - all chunks apart from swaying in the wind, so fog and color blending
const groundMaterial = new StandardMaterial();
const groundChunks = groundMaterial.getShaderChunks(shaderLanguage);
// Only add the chunks we need (excluding transformCoreVS which is for tree swaying)
groundChunks.add({
    diffusePS: shaderChunks.diffusePS,
    litUserMainEndPS: shaderChunks.litUserMainEndPS,
    litUserDeclarationPS: shaderChunks.litUserDeclarationPS
});
groundMaterial.shaderChunksVersion = '2.8';

const ground = new Entity('Ground');
ground.addComponent('render', {
    type: 'cylinder',
    material: groundMaterial
});
ground.setLocalScale(50, 1, 50);
ground.setLocalPosition(0, -2, 0);
app.root.addChild(ground);

// Update things every frame
let time = 0;
app.on('update', dt => {
    time += dt;

    // Update uniforms once per frame. Note that this needs to use unique uniform names, to make sure
    // nothing overrides those. Alternatively, you could 'setParameter' on the materials.
    app.graphicsDevice.scope.resolve('myTime').setValue(time);
    app.graphicsDevice.scope.resolve('myFogParams').setValue([-2, 2]);

    // Orbit camera around
    camera.setLocalPosition(18 * Math.sin(time * 0.05), 10, 18 * Math.cos(time * 0.05));
    camera.lookAt(Vec3.ZERO);
});

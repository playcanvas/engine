// @config
//
// This example demonstrates scrolling cloud shadows using a shader chunk
// override on {accent:StandardMaterial}.
//
// @credit
// title: Low-poly Tree with Twisting Branches
// author: Sketchfab
// source: https://sketchfab.com/3d-models/low-poly-tree-with-twisting-branches-4e2589134f2442bcbdab51c1f306cd58
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    ADDRESS_REPEAT,
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
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    Vec3,
    VertexBuffer,
    VertexFormat,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

import * as shaderChunksGlsl from './shader-chunks.glsl.mjs';
import * as shaderChunksWgsl from './shader-chunks.wgsl.mjs';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    tree: new Asset('tree', 'container', { url: './assets/models/low-poly-tree.glb' }),
    clouds: new Asset('clouds', 'texture', { url: './assets/textures/clouds.jpg' }),
    envAtlas: new Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/morning-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const shaderLanguage = device.isWebGPU ? SHADERLANGUAGE_WGSL : SHADERLANGUAGE_GLSL;
const shaderChunks = device.isWebGPU ? shaderChunksWgsl : shaderChunksGlsl;

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

const app = new AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

app.scene.envAtlas = assets.envAtlas.resource;
app.scene.skyboxMip = 1;
app.scene.exposure = 0.4;

// Camera
const camera = new Entity();
camera.addComponent('camera', {
    toneMapping: TONEMAP_ACES,
    clearColor: new Color(0.55, 0.7, 0.9)
});
app.root.addChild(camera);

// Directional light with shadows
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

// Instanced trees
const instanceCount = 1000;
const matrices = new Float32Array(instanceCount * 16);
let matrixIndex = 0;

const pos = new Vec3();
const rot = new Quat();
const scl = new Vec3();
const matrix = new Mat4();

for (let i = 0; i < instanceCount; i++) {
    const maxRadius = 20;
    const angle = Math.random() * 2 * Math.PI;
    const radius = Math.sqrt(Math.random() * maxRadius ** 2);

    pos.set(radius * Math.cos(angle), 0, radius * Math.sin(angle));
    scl.set(0.1 + Math.random() * 0.2, 0.1 + Math.random() * 0.3, 0.1 + Math.random() * 0.2);
    pos.y = -1.5 + scl.y * 4.5;
    matrix.setTRS(pos, rot, scl);

    for (let m = 0; m < 16; m++) matrices[matrixIndex++] = matrix.data[m];
}

const vbFormat = VertexFormat.getDefaultInstancingFormat(app.graphicsDevice);
const vertexBuffer = new VertexBuffer(app.graphicsDevice, vbFormat, instanceCount, {
    data: matrices
});

const forest = assets.tree.resource.instantiateRenderEntity();
app.root.addChild(forest);
const meshInstance = forest.findComponent('render').meshInstances[0];
meshInstance.setInstancing(vertexBuffer);

// Apply cloud shadow chunks to tree material
const treeMaterial = meshInstance.material;
treeMaterial.getShaderChunks(shaderLanguage).add(shaderChunks);
treeMaterial.shaderChunksVersion = '2.8';

// Ground plane with cloud shadow chunks
const groundMaterial = new StandardMaterial();
groundMaterial.getShaderChunks(shaderLanguage).add(shaderChunks);
groundMaterial.shaderChunksVersion = '2.8';

const ground = new Entity('Ground');
ground.addComponent('render', {
    type: 'cylinder',
    material: groundMaterial
});
ground.setLocalScale(50, 1, 50);
ground.setLocalPosition(0, -2, 0);
app.root.addChild(ground);

// Ensure the cloud texture wraps so the scrolling tiles seamlessly
const cloudTexture = assets.clouds.resource;
cloudTexture.addressU = ADDRESS_REPEAT;
cloudTexture.addressV = ADDRESS_REPEAT;

// Set default control values
data.set('data', {
    speed: 0.03,
    direction: 30,
    intensity: 0.9,
    scale: 0.01
});

const scope = app.graphicsDevice.scope;
let time = 0;
let offsetX = 0;
let offsetY = 0;

app.on('update', (dt) => {
    time += dt;

    const speed = data.get('data.speed');
    const directionDeg = data.get('data.direction');
    const intensity = data.get('data.intensity');
    const scale = data.get('data.scale');

    // Scroll direction from angle
    const dirRad = (directionDeg * Math.PI) / 180;
    offsetX += Math.cos(dirRad) * speed * dt;
    offsetY += Math.sin(dirRad) * speed * dt;

    // Set cloud shadow uniforms globally - all materials with the chunk receive them
    scope.resolve('cloudShadowTexture').setValue(cloudTexture);
    scope.resolve('cloudShadowOffset').setValue([offsetX, offsetY]);
    scope.resolve('cloudShadowScale').setValue(scale);
    scope.resolve('cloudShadowIntensity').setValue(intensity);

    // Orbit camera
    camera.setLocalPosition(18 * Math.sin(time * 0.05), 10, 18 * Math.cos(time * 0.05));
    camera.lookAt(Vec3.ZERO);
});

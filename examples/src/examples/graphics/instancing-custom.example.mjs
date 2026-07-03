// @config
//
// This example demonstrates how to customize the shader handling the instancing of a StandardMaterial.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SEMANTIC_ATTR12,
    SEMANTIC_ATTR13,
    SHADERLANGUAGE_GLSL,
    SHADERLANGUAGE_WGSL,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TYPE_FLOAT32,
    TextureHandler,
    Vec3,
    VertexBuffer,
    VertexFormat,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

import transformInstancingGlslVert from './transform-instancing.glsl.vert';
import transformInstancingWgslVert from './transform-instancing.wgsl.vert';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/table-mountain-env-atlas.png' },
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

// Setup skydome
app.scene.skyboxMip = 2;
app.scene.exposure = 0.8;
app.scene.envAtlas = assets.helipad.resource;

// Set up some general scene rendering properties
app.scene.ambientLight = new Color(0.1, 0.1, 0.1);

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    toneMapping: TONEMAP_ACES
});
app.root.addChild(camera);

// Create static vertex buffer containing the instancing data
const vbFormat = new VertexFormat(app.graphicsDevice, [
    { semantic: SEMANTIC_ATTR12, components: 3, type: TYPE_FLOAT32 }, // position
    { semantic: SEMANTIC_ATTR13, components: 1, type: TYPE_FLOAT32 } // scale
]);

// Store data for individual instances into array, 4 floats each
const instanceCount = 3000;
const data = new Float32Array(instanceCount * 4);

const range = 10;
for (let i = 0; i < instanceCount; i++) {
    const offset = i * 4;
    data[offset + 0] = Math.random() * range - range * 0.5; // x
    data[offset + 1] = Math.random() * range - range * 0.5; // y
    data[offset + 2] = Math.random() * range - range * 0.5; // z
    data[offset + 3] = 0.1 + Math.random() * 0.1; // scale
}

const vertexBuffer = new VertexBuffer(app.graphicsDevice, vbFormat, instanceCount, {
    data: data
});

// Create standard material - this will be used for instanced, but also non-instanced rendering
const material = new StandardMaterial();
material.gloss = 0.5;
material.metalness = 1;
material.diffuse = new Color(0.7, 0.5, 0.7);
material.useMetalness = true;

// Set up additional attributes needed for instancing
material.setAttribute('aInstPosition', SEMANTIC_ATTR12);
material.setAttribute('aInstScale', SEMANTIC_ATTR13);

// And a custom instancing shader chunk, which will be used in case the mesh instance has instancing enabled
material.shaderChunksVersion = '2.8';
material.getShaderChunks(SHADERLANGUAGE_GLSL).set('transformInstancingVS', transformInstancingGlslVert);
material.getShaderChunks(SHADERLANGUAGE_WGSL).set('transformInstancingVS', transformInstancingWgslVert);

material.update();

// Create an Entity with a sphere and the instancing material
const instancingEntity = new Entity('InstancingEntity');
instancingEntity.addComponent('render', {
    material: material,
    type: 'sphere'
});
app.root.addChild(instancingEntity);

// Initialize instancing using the vertex buffer on meshInstance of the created mesh instance
const meshInst = instancingEntity.render.meshInstances[0];
meshInst.setInstancing(vertexBuffer);

// Add a non-instanced sphere, using the same material. A non-instanced version of the shader
// is automatically created by the engine
const sphere = new Entity('sphere');
sphere.addComponent('render', {
    material: material,
    type: 'sphere'
});
sphere.setLocalScale(2, 2, 2);
app.root.addChild(sphere);

// An update function executes once per frame
let time = 0;
const spherePos = new Vec3();
app.on('update', dt => {
    time += dt;

    // move the large sphere up and down
    spherePos.set(0, Math.sin(time) * 2, 0);
    sphere.setLocalPosition(spherePos);

    // update uniforms of the instancing material
    material.setParameter('uTime', time);
    material.setParameter('uCenter', [spherePos.x, spherePos.y, spherePos.z]);

    // orbit camera around
    camera.setLocalPosition(8 * Math.sin(time * 0.1), 0, 8 * Math.cos(time * 0.1));
    camera.lookAt(Vec3.ZERO);
});

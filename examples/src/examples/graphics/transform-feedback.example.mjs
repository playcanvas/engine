// @config
// @flag WEBGPU_DISABLED

import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_ADDITIVEALPHA,
    BoundingBox,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    LightComponentSystem,
    Mesh,
    MeshInstance,
    PIXELFORMAT_RGBA8,
    PRIMITIVE_POINTS,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SEMANTIC_POSITION,
    ShaderMaterial,
    Texture,
    TextureHandler,
    TransformFeedback,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

import shaderCloudFrag from './shaderCloud.frag';
import shaderCloudVert from './shaderCloud.vert';
import shaderFeedbackVert from './shaderFeedback.vert';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

const app = new AppBase(canvas);
app.init(createOptions);

const assets = {
    statue: new Asset('statue', 'container', { url: './assets/models/statue.glb' })
};

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

app.scene.ambientLight = new Color(0.2, 0.2, 0.2);

// Create small 2D texture representing movement direction (wind)
const textureResolution = 10;
const textureData = new Uint8ClampedArray(textureResolution * textureResolution * 4);

for (let i = 0; i < textureResolution * textureResolution; i++) {
    // Rgb store biased movement direction
    textureData[i * 4] = 127 + Math.random() * 50 - 25;
    textureData[i * 4 + 1] = 127 + Math.random() * 50 - 25;
    textureData[i * 4 + 2] = 127 + Math.random() * 50 - 25;

    // Set alpha to 255 for debugging purposes
    textureData[i * 4 + 3] = 255;
}

// Create texture
const texture = new Texture(app.graphicsDevice, {
    width: textureResolution,
    height: textureResolution,
    format: PIXELFORMAT_RGBA8,
    cubemap: false,
    mipmaps: false,
    minFilter: FILTER_LINEAR,
    magFilter: FILTER_LINEAR,
    addressU: ADDRESS_CLAMP_TO_EDGE,
    addressV: ADDRESS_CLAMP_TO_EDGE
});

// Initialize it with data
const pixels = texture.lock();
pixels.set(textureData);
texture.unlock();

// Create main camera, which renders the world
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.1)
});
app.root.addChild(camera);

// Set up texture transform part, on webgl2 devices only
let tf;
let shader;
const areaSize = 30;

// Resolve parameters to simulation shader parameters
const areaSizeUniform = app.graphicsDevice.scope.resolve('areaSize');
const deltaTimeUniform = app.graphicsDevice.scope.resolve('deltaTime');
const directionSampler = app.graphicsDevice.scope.resolve('directionSampler');

// @ts-ignore engine-tsd
if (app.graphicsDevice.isWebGL2) {
    // Simulated particles
    const maxNumPoints = 200000;
    const positions = new Float32Array(4 * maxNumPoints);

    // Generate random data, these are used as seeds to generate particles in vertex shader
    for (let i = 0; i < maxNumPoints; i++) {
        positions[i * 4] = Math.random();
        positions[i * 4 + 1] = Math.random();
        positions[i * 4 + 2] = Math.random();

        // Set life time to 0 which triggers particle restart in shader
        positions[i * 4 + 3] = 0;
    }

    // Store these in a vertex buffer of a mesh
    const mesh = new Mesh(app.graphicsDevice);
    mesh.setPositions(positions, 4);
    mesh.update(PRIMITIVE_POINTS, false);

    // Set large bounding box so we don't need to update it each frame
    mesh.aabb = new BoundingBox(new Vec3(0, 0, 0), new Vec3(100, 100, 100));

    // Create the material from the vertex and fragment shaders which is used to render point sprites
    const material = new ShaderMaterial({
        uniqueName: 'TransformFeerback',
        vertexGLSL: shaderCloudVert,
        fragmentGLSL: shaderCloudFrag,
        attributes: { aPosition: SEMANTIC_POSITION }
    });

    material.blendType = BLEND_ADDITIVEALPHA;
    material.depthWrite = false;

    // Create the mesh instance
    const meshInstance = new MeshInstance(mesh, material);

    // Create an entity used to render the mesh instance using a render component
    const entity = new Entity();
    entity.addComponent('render', {
        type: 'asset',
        meshInstances: [meshInstance]
    });
    app.root.addChild(entity);

    // Set up transform feedback. This creates a clone of the vertex buffer, and sets up rendering to ping pong between them
    tf = new TransformFeedback(mesh.vertexBuffer);
    shader = TransformFeedback.createShader(app.graphicsDevice, shaderFeedbackVert, 'transformShaderExample', [
        'updated_vertex_position'
    ]);
}

// Update things each frame
let time = 0;
app.on('update', dt => {
    // Rotate camera around
    time += dt;
    camera.setLocalPosition(9 * Math.sin(time * 0.2), 6, 25 * Math.cos(time * 0.2));
    camera.lookAt(new Vec3(0, 3, 0));

    // If transform feedback was initialized
    if (tf) {
        // Set up simulation parameters
        areaSizeUniform.setValue(areaSize);
        deltaTimeUniform.setValue(dt);
        directionSampler.setValue(texture);

        // Execute simulation
        tf.process(shader);
    }
});

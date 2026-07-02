// @config
// @flag WEBGL_DISABLED

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BUFFERUSAGE_COPY_DST,
    BUFFERUSAGE_VERTEX,
    CameraComponentSystem,
    Compute,
    Entity,
    FILLMODE_FILL_WINDOW,
    Mesh,
    MeshInstance,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADERLANGUAGE_WGSL,
    ScriptComponentSystem,
    ScriptHandler,
    Shader,
    ShaderMaterial,
    StandardMaterial,
    StorageBuffer,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

import shaderRenderingFragmentWgsl from './shader-rendering.fragment.wgsl';
import shaderRenderingVertexWgsl from './shader-rendering.vertex.wgsl';
import shaderSharedWgsl from './shader-shared.wgsl';
import shaderSimulationWgsl from './shader-simulation.wgsl';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
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
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, ScriptComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ScriptHandler];

const app = new AppBase(canvas);
app.init(createOptions);
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

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

// set up some general scene rendering properties
app.scene.skyboxMip = 2;
app.scene.skyboxIntensity = 0.2;
app.scene.envAtlas = assets.helipad.resource;

// create camera entity
const cameraEntity = new Entity('camera');
cameraEntity.addComponent('camera', {
    toneMapping: TONEMAP_ACES
});
app.root.addChild(cameraEntity);
cameraEntity.setPosition(-150, -60, 190);

// add orbit camera script with a mouse and a touch support
cameraEntity.addComponent('script');
cameraEntity.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        frameOnStart: false,
        distanceMax: 500
    }
});
cameraEntity.script.create('orbitCameraInputMouse');
cameraEntity.script.create('orbitCameraInputTouch');

// ------- Particle simulation -------

const numParticles = 1024 * 1024;

// a compute shader that will simulate the particles stored in a storage buffer. No bind group
// or uniform buffer formats are provided - the loose uniforms (count, dt, sphereCount) and the
// storage buffers (particles, spheres) use the simplified WGSL syntax and are reflected
// automatically by the engine from the shader source.
const shader = device.supportsCompute
    ? new Shader(device, {
          name: 'SimulationShader',
          shaderLanguage: SHADERLANGUAGE_WGSL,
          cshader: shaderSharedWgsl + shaderSimulationWgsl
      })
    : null;

// Create a storage buffer to store particles
// see the particle size / alignment / padding here: https://tinyurl.com/particle-structure
const particleFloatSize = 12;
const particleStructSize = particleFloatSize * 4; // 4 bytes per float
const particleStorageBuffer = new StorageBuffer(
    device,
    numParticles * particleStructSize,
    BUFFERUSAGE_VERTEX | // vertex buffer reads it
        BUFFERUSAGE_COPY_DST // CPU copies initial data to it
);

// generate initial particle data
const particleData = new Float32Array(numParticles * particleFloatSize);
const velocity = new Vec3();
for (let i = 0; i < numParticles; ++i) {
    // random velocity inside a cone
    const r = 0.4 * Math.sqrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    velocity.set(r * Math.cos(theta), -1, r * Math.sin(theta));
    const speed = 0.6 + Math.random() * 0.6;
    velocity.normalize().mulScalar(speed);

    // store the data in the buffer at matching offsets
    const base = i * particleFloatSize;

    // position
    particleData[base + 0] = velocity.x;
    particleData[base + 1] = velocity.y;
    particleData[base + 2] = velocity.z;

    // time since collision - large as no recent collision
    particleData[base + 3] = 100;

    // old position (spawn position)
    particleData[base + 4] = 0;
    particleData[base + 5] = 0;
    particleData[base + 6] = 0;

    // original velocity
    particleData[base + 8] = velocity.x;
    particleData[base + 9] = velocity.y;
    particleData[base + 10] = velocity.z;
}

// upload the data to the buffer
particleStorageBuffer.write(0, particleData);

// collision spheres
const numSpheres = 3;
const sphereData = new Float32Array(numSpheres * 4);

const sphereMaterial = new StandardMaterial();
sphereMaterial.gloss = 0.6;
sphereMaterial.metalness = 0.4;
sphereMaterial.useMetalness = true;
sphereMaterial.update();

const addSphere = (index, x, y, z, r) => {
    const base = index * 4;
    sphereData[base + 0] = x;
    sphereData[base + 1] = y;
    sphereData[base + 2] = z;
    sphereData[base + 3] = r;

    // visuals
    const sphere = new Entity();
    sphere.addComponent('render', {
        type: 'sphere',
        material: sphereMaterial
    });
    sphere.setLocalScale(r * 2, r * 2, r * 2);
    sphere.setLocalPosition(x, y, z);
    app.root.addChild(sphere);

    return sphere;
};

// add 3 sphere
addSphere(0, 28, -70, 0, 27);
const s1 = addSphere(1, -38, -130, 0, 35);
addSphere(2, 45, -210, 35, 70);

// camera focuses on one of the spheres
cameraEntity.script.orbitCamera.focusEntity = s1;

// upload the sphere data to the buffer
const sphereStorageBuffer = new StorageBuffer(device, numSpheres * 16, BUFFERUSAGE_COPY_DST);
sphereStorageBuffer.write(0, sphereData);

// Create an instance of the compute shader and assign buffers to it
const compute = new Compute(device, shader, 'ComputeParticles');
compute.setParameter('particles', particleStorageBuffer);
compute.setParameter('spheres', sphereStorageBuffer);

// constant uniforms
compute.setParameter('count', numParticles);
compute.setParameter('sphereCount', numSpheres);

// ------- Particle rendering -------

// material to render the particles using WGSL shader as GLSL does not have access to storage buffers
const material = new ShaderMaterial({
    uniqueName: 'ParticleRenderShader',
    vertexWGSL: shaderSharedWgsl + shaderRenderingVertexWgsl,
    fragmentWGSL: shaderSharedWgsl + shaderRenderingFragmentWgsl
});

// rendering shader needs the particle storage buffer to read the particle data
material.setParameter('particles', particleStorageBuffer);

// index buffer - two triangles (6 indices) per particle using 4 vertices
const indices = new Uint32Array(numParticles * 6);
for (let i = 0; i < numParticles; ++i) {
    const vertBase = i * 4;
    const triBase = i * 6;
    indices[triBase + 0] = vertBase;
    indices[triBase + 1] = vertBase + 2;
    indices[triBase + 2] = vertBase + 1;
    indices[triBase + 3] = vertBase + 1;
    indices[triBase + 4] = vertBase + 2;
    indices[triBase + 5] = vertBase + 3;
}

// create a mesh without vertex buffer - we will use the particle storage buffer to supply positions
const mesh = new Mesh(device);
mesh.setIndices(indices);
mesh.update();
const meshInstance = new MeshInstance(mesh, material);
meshInstance.cull = false; // disable culling as we did not supply custom aabb for the mesh instance

const entity = new Entity('ParticleRenderingEntity');
entity.addComponent('render', {
    meshInstances: [meshInstance]
});
app.root.addChild(entity);

app.on('update', (/** @type {number} */ dt) => {
    if (device.supportsCompute) {
        // update non-constant parameters each frame
        compute.setParameter('dt', dt);

        // dispatch the compute shader to simulate the particles
        compute.setupDispatch(1024 / 64, 1024);
        device.computeDispatch([compute], 'ComputeParticlesDispatch');
    }
});

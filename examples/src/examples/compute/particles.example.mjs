// @config WEBGL_DISABLED
import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';
import files from 'examples/files';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbit: new pc.Asset('script', 'script', { url: rootPath + '/static/scripts/camera/orbit-camera.js' }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.ScriptComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ScriptHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);
app.start();

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    // set up some general scene rendering properties
    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;
    app.scene.skyboxMip = 2;
    app.scene.skyboxIntensity = 0.2;
    app.scene.envAtlas = assets.helipad.resource;

    // create camera entity
    const cameraEntity = new pc.Entity('camera');
    cameraEntity.addComponent('camera');
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

    // a compute shader that will simulate the particles stored in a storage buffer
    const shader = device.supportsCompute ?
        new pc.Shader(device, {
            name: 'SimulationShader',
            shaderLanguage: pc.SHADERLANGUAGE_WGSL,
            cshader: files['shader-shared.wgsl'] + files['shader-simulation.wgsl'],

              // format of a uniform buffer used by the compute shader
            computeUniformBufferFormats: {
                ub: new pc.UniformBufferFormat(device, [
                    new pc.UniformFormat('count', pc.UNIFORMTYPE_UINT),
                    new pc.UniformFormat('dt', pc.UNIFORMTYPE_FLOAT),
                    new pc.UniformFormat('sphereCount', pc.UNIFORMTYPE_UINT)
                ])
            },

              // format of a bind group, providing resources for the compute shader
            computeBindGroupFormat: new pc.BindGroupFormat(device, [
                  // a uniform buffer we provided the format for
                new pc.BindUniformBufferFormat('ub', pc.SHADERSTAGE_COMPUTE),
                  // particle storage buffer
                new pc.BindStorageBufferFormat('particles', pc.SHADERSTAGE_COMPUTE),
                  // rad only collision spheres
                new pc.BindStorageBufferFormat('spheres', pc.SHADERSTAGE_COMPUTE, true)
            ])
        }) :
        null;

    // Create a storage buffer to store particles
    // see the particle size / alignment / padding here: https://tinyurl.com/particle-structure
    const particleFloatSize = 12;
    const particleStructSize = particleFloatSize * 4; // 4 bytes per float
    const particleStorageBuffer = new pc.StorageBuffer(
        device,
        numParticles * particleStructSize,
        pc.BUFFERUSAGE_VERTEX | // vertex buffer reads it
            pc.BUFFERUSAGE_COPY_DST // CPU copies initial data to it
    );

    // generate initial particle data
    const particleData = new Float32Array(numParticles * particleFloatSize);
    const velocity = new pc.Vec3();
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

    const sphereMaterial = new pc.StandardMaterial();
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
        const sphere = new pc.Entity();
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
    const sphereStorageBuffer = new pc.StorageBuffer(device, numSpheres * 16, pc.BUFFERUSAGE_COPY_DST);
    sphereStorageBuffer.write(0, sphereData);

    // Create an instance of the compute shader and assign buffers to it
    const compute = new pc.Compute(device, shader, 'ComputeParticles');
    compute.setParameter('particles', particleStorageBuffer);
    compute.setParameter('spheres', sphereStorageBuffer);

    // constant uniforms
    compute.setParameter('count', numParticles);
    compute.setParameter('sphereCount', numSpheres);

    // ------- Particle rendering -------

    // use WGSL shader for rendering as GLSL does not have access to storage buffers
    const shaderSource = files['shader-shared.wgsl'] + files['shader-rendering.wgsl'];
    const shaderDefinition = {
        vshader: shaderSource,
        fshader: shaderSource,
        shaderLanguage: pc.SHADERLANGUAGE_WGSL,

        // For now WGSL shaders need to provide their own bind group formats as they aren't processed.
        // This has to match the structs in the shader.
        meshUniformBufferFormat: new pc.UniformBufferFormat(app.graphicsDevice, [
            new pc.UniformFormat('matrix_model', pc.UNIFORMTYPE_MAT4)
        ]),
        meshBindGroupFormat: new pc.BindGroupFormat(app.graphicsDevice, [
            // particle storage buffer in read-only mode
            new pc.BindStorageBufferFormat('particles', pc.SHADERSTAGE_VERTEX | pc.SHADERSTAGE_FRAGMENT, true)
        ])
    };

    // material to render the particles
    const material = new pc.Material();
    material.name = 'ParticleRenderingMaterial';
    material.shader = new pc.Shader(app.graphicsDevice, shaderDefinition);

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
    const mesh = new pc.Mesh(device);
    mesh.setIndices(indices);
    mesh.update();
    const meshInstance = new pc.MeshInstance(mesh, material);
    meshInstance.cull = false; // disable culling as we did not supply custom aabb for the mesh instance

    const entity = new pc.Entity('ParticleRenderingEntity');
    entity.addComponent('render', {
        meshInstances: [meshInstance]
    });
    app.root.addChild(entity);

    app.on('update', function (/** @type {number} */ dt) {
        if (device.supportsCompute) {
            // update non-constant parameters each frame
            compute.setParameter('dt', dt);

            // dispatch the compute shader to simulate the particles
            compute.setupDispatch(1024 / 64, 1024);
            device.computeDispatch([compute]);
        }
    });
});

export { app };

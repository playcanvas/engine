// @config DESCRIPTION This example shows a basic usage of indirect drawing, and the compute shader changes the number of instances that are rendered.
// @config WEBGL_DISABLED
import files from 'examples/files';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/helipad-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

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
    app.start();

    // setup skydome
    app.scene.skyboxMip = 2;
    app.scene.exposure = 0.7;
    app.scene.envAtlas = assets.helipad.resource;

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        toneMapping: pc.TONEMAP_ACES
    });
    app.root.addChild(camera);
    camera.translate(0, 0, 10);

    // create standard material that will be used on the instanced spheres
    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color(1, 1, 0.5);
    material.gloss = 1;
    material.metalness = 1;
    material.useMetalness = true;
    material.update();

    // Create a Entity with a sphere render component and the material
    const sphere = new pc.Entity('InstancingEntity');
    sphere.addComponent('render', {
        material: material,
        type: 'sphere'
    });
    app.root.addChild(sphere);

    // number of instances to render
    const instanceCount = 1000;

    // store matrices for individual instances into array
    const matrices = new Float32Array(instanceCount * 16);
    let matrixIndex = 0;

    const radius = 5;
    const pos = new pc.Vec3();
    const rot = new pc.Quat();
    const scl = new pc.Vec3();
    const matrix = new pc.Mat4();

    for (let i = 0; i < instanceCount; i++) {
        // generate positions / scales and rotations
        pos.set(
            Math.random() * radius - radius * 0.5,
            Math.random() * radius - radius * 0.5,
            Math.random() * radius - radius * 0.5
        );
        scl.set(0.2, 0.2, 0.2);
        rot.setFromEulerAngles(0, 0, 0);
        matrix.setTRS(pos, rot, scl);

        // copy matrix elements into array of floats
        for (let m = 0; m < 16; m++) matrices[matrixIndex++] = matrix.data[m];
    }

    // create static vertex buffer containing the matrices
    const vbFormat = pc.VertexFormat.getDefaultInstancingFormat(app.graphicsDevice);
    const vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, vbFormat, instanceCount, {
        data: matrices
    });

    // initialize instancing using the vertex buffer on meshInstance of the created sphere
    const sphereMeshInst = sphere.render.meshInstances[0];
    sphereMeshInst.setInstancing(vertexBuffer);

    // create a compute shader which will be used to update the number of instances to be rendered each frame
    const shader = device.supportsCompute ?
        new pc.Shader(device, {
            name: 'ComputeShader',
            shaderLanguage: pc.SHADERLANGUAGE_WGSL,
            cshader: files['compute-shader.wgsl'],

            // include all WGSL chunks to be available for including in the compute shader
            cincludes: pc.ShaderChunks.get(device, pc.SHADERLANGUAGE_WGSL),

            // format of a uniform buffer used by the compute shader
            computeUniformBufferFormats: {
                ub: new pc.UniformBufferFormat(device, [

                    // metadata about the mesh (how many indicies it has and similar, used to generate draw call parameters)
                    new pc.UniformFormat('indirectMetaData', pc.UNIFORMTYPE_IVEC4),

                    // time to animate number of visible instances
                    new pc.UniformFormat('time', pc.UNIFORMTYPE_FLOAT),

                    // maximum number of instances
                    new pc.UniformFormat('maxInstanceCount', pc.UNIFORMTYPE_UINT),

                    // indirect slot into storage buffer which stored draw call parameters
                    new pc.UniformFormat('indirectSlot', pc.UNIFORMTYPE_UINT)
                ])
            },

            // format of a bind group, providing resources for the compute shader
            computeBindGroupFormat: new pc.BindGroupFormat(device, [
                // a uniform buffer we provided format for
                new pc.BindUniformBufferFormat('ub', pc.SHADERSTAGE_COMPUTE),

                // the buffer with indirect draw arguments
                new pc.BindStorageBufferFormat('indirectDrawBuffer', pc.SHADERSTAGE_COMPUTE)
            ])
        }) :
        null;

    // Create an instance of the compute shader, and provide it with uniform values that do not change each frame
    const compute = new pc.Compute(device, shader, 'ComputeModifyVB');
    compute.setParameter('maxInstanceCount', instanceCount);
    compute.setParameter('indirectMetaData', sphereMeshInst.getIndirectMetaData());

    // Set an update function on the app's update event
    let angle = 0;
    let time = 0;
    app.on('update', (dt) => {
        time += dt;

        // obtain available slot in the indirect draw buffer - this needs to be done each frame
        const indirectSlot = app.graphicsDevice.getIndirectDrawSlot();

        // and assign it to the mesh instance for all cameras (null parameter)
        sphereMeshInst.setIndirect(null, indirectSlot);

        // give compute shader the indirect draw buffer - this can change between frames, so assign it each frame
        compute.setParameter('indirectDrawBuffer', app.graphicsDevice.indirectDrawBuffer);

        // update compute shader parameters
        compute.setParameter('time', time);
        compute.setParameter('indirectSlot', indirectSlot);

        // set up the compute dispatch
        compute.setupDispatch(1);

        // dispatch the compute shader
        device.computeDispatch([compute], 'ComputeIndirectDraw');

        // orbit camera around
        angle += dt * 0.2;
        camera.setLocalPosition(8 * Math.sin(angle), 0, 8 * Math.cos(angle));
        camera.lookAt(pc.Vec3.ZERO);
    });
});

export { app };

// @config DESCRIPTION <div style='color: black;'>This example shows how to override shader chunks of StandardMaterial.</div>
import { deviceType, rootPath, localImport } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    tree: new pc.Asset('cube', 'container', { url: `${rootPath}/static/assets/models/low-poly-tree.glb` })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

// Determine shader language and import the appropriate shader chunks
const shaderLanguage = device.isWebGPU ? pc.SHADERLANGUAGE_WGSL : pc.SHADERLANGUAGE_GLSL;
const shaderChunkFile = device.isWebGPU ? 'shader-chunks.wgsl.mjs' : 'shader-chunks.glsl.mjs';
const shaderChunks = await localImport(shaderChunkFile);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

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

    app.scene.ambientLight = new pc.Color(0.4, 0.2, 0.0);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        toneMapping: pc.TONEMAP_ACES,
        clearColor: new pc.Color(0.95, 0.95, 0.95)
    });
    app.root.addChild(camera);

    // add a shadow casting directional light
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'directional',
        castShadows: true,
        shadowBias: 0.2,
        normalOffsetBias: 0.06,
        shadowDistance: 35
    });
    app.root.addChild(light);
    light.setLocalEulerAngles(45, 30, 0);

    // number of tree instances to render
    const instanceCount = 1000;

    // store matrices for individual instances into array
    const matrices = new Float32Array(instanceCount * 16);
    let matrixIndex = 0;

    const pos = new pc.Vec3();
    const rot = new pc.Quat();
    const scl = new pc.Vec3();
    const matrix = new pc.Mat4();

    for (let i = 0; i < instanceCount; i++) {

        // random points in the circle
        const maxRadius = 20;
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.sqrt(Math.random() * (maxRadius ** 2));

        // generate random positions / scales and rotations
        pos.set(radius * Math.cos(angle), 0, radius * Math.sin(angle));
        scl.set(0.1 + Math.random() * 0.2, 0.1 + Math.random() * 0.3, 0.1 + Math.random() * 0.2);
        pos.y = -1.5 + scl.y * 4.5;
        matrix.setTRS(pos, rot, scl);

        // copy matrix elements into array of floats
        for (let m = 0; m < 16; m++) matrices[matrixIndex++] = matrix.data[m];
    }

    // create static vertex buffer containing the matrices
    const vbFormat = pc.VertexFormat.getDefaultInstancingFormat(app.graphicsDevice);
    const vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, vbFormat, instanceCount, {
        data: matrices
    });

    // create a forest by setting up the tree model for instancing
    const forest = assets.tree.resource.instantiateRenderEntity();
    app.root.addChild(forest);
    const meshInstance = forest.findComponent('render').meshInstances[0];
    meshInstance.setInstancing(vertexBuffer);

    // apply shader chunks to the tree material
    const treeChunks = meshInstance.material.getShaderChunks(shaderLanguage);
    treeChunks.add(shaderChunks);
    meshInstance.material.shaderChunksVersion = '2.8';

    // create a ground material - all chunks apart from swaying in the wind, so fog and color blending
    const groundMaterial = new pc.StandardMaterial();
    const groundChunks = groundMaterial.getShaderChunks(shaderLanguage);
    // only add the chunks we need (excluding transformCoreVS which is for tree swaying)
    groundChunks.add({
        diffusePS: shaderChunks.diffusePS,
        litUserMainEndPS: shaderChunks.litUserMainEndPS,
        litUserDeclarationPS: shaderChunks.litUserDeclarationPS
    });
    groundMaterial.shaderChunksVersion = '2.8';

    const ground = new pc.Entity('Ground');
    ground.addComponent('render', {
        type: 'cylinder',
        material: groundMaterial
    });
    ground.setLocalScale(50, 1, 50);
    ground.setLocalPosition(0, -2, 0);
    app.root.addChild(ground);

    // update things every frame
    let time = 0;
    app.on('update', (dt) => {
        time += dt;

        // update uniforms once per frame. Note that this needs to use unique uniform names, to make sure
        // nothing overrides those. Alternatively, you could 'setParameter' on the materials.
        app.graphicsDevice.scope.resolve('myTime').setValue(time);
        app.graphicsDevice.scope.resolve('myFogParams').setValue([-2, 2]);

        // orbit camera around
        camera.setLocalPosition(18 * Math.sin(time * 0.05), 10, 18 * Math.cos(time * 0.05));
        camera.lookAt(pc.Vec3.ZERO);
    });
});

export { app };

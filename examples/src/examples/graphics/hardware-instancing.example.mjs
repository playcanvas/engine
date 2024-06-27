import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
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
    app.scene.exposure = 0.3;
    app.scene.envAtlas = assets.helipad.resource;

    // set up some general scene rendering properties
    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;

    app.scene.ambientLight = new pc.Color(0.1, 0.1, 0.1);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {});
    app.root.addChild(camera);

    // Move the camera back to see the cubes
    camera.translate(0, 0, 10);

    // create standard material and enable instancing on it
    const material = new pc.StandardMaterial();
    material.gloss = 0.6;
    material.metalness = 0.7;
    material.useMetalness = true;
    material.update();

    // Create a Entity with a cylinder render component and the instancing material
    const cylinder = new pc.Entity('InstancingEntity');
    cylinder.addComponent('render', {
        material: material,
        type: 'cylinder'
    });

    // add the box entity to the hierarchy
    app.root.addChild(cylinder);

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
        // generate random positions / scales and rotations
        pos.set(
            Math.random() * radius - radius * 0.5,
            Math.random() * radius - radius * 0.5,
            Math.random() * radius - radius * 0.5
        );
        scl.set(0.1 + Math.random() * 0.1, 0.1 + Math.random() * 0.3, 0.1 + Math.random() * 0.1);
        rot.setFromEulerAngles(i * 30, i * 50, i * 70);
        matrix.setTRS(pos, rot, scl);

        // copy matrix elements into array of floats
        for (let m = 0; m < 16; m++) matrices[matrixIndex++] = matrix.data[m];
    }

    // create static vertex buffer containing the matrices
    const vbFormat = pc.VertexFormat.getDefaultInstancingFormat(app.graphicsDevice);
    const vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, vbFormat, instanceCount, {
        data: matrices
    });

    // initialize instancing using the vertex buffer on meshInstance of the created box
    const cylinderMeshInst = cylinder.render.meshInstances[0];
    cylinderMeshInst.setInstancing(vertexBuffer);

    // Set an update function on the app's update event
    let angle = 0;
    app.on('update', function (dt) {
        // orbit camera around
        angle += dt * 0.2;
        camera.setLocalPosition(8 * Math.sin(angle), 0, 8 * Math.cos(angle));
        camera.lookAt(pc.Vec3.ZERO);
    });
});

export { app };

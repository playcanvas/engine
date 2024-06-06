// @config WEBGPU_DISABLED
import * as pc from 'playcanvas';
import files from 'examples/files';
import { deviceType, loadES5, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const CORE = await loadES5('https://cdn.jsdelivr.net/npm/@loaders.gl/core@2.3.6/dist/dist.min.js');
const DRACO = await loadES5('https://cdn.jsdelivr.net/npm/@loaders.gl/draco@2.3.6/dist/dist.min.js');

// This example uses draco point cloud loader library from https://loaders.gl/
// Note that many additional formats are supported by the library and can be used.
const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

/** @type {pc.GraphicsDevice} */
const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);


const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

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

/**
 * @param {string} url - The url to load.
 */
async function loadModel(url) {
    console.log('loader.gl example url', url);
    // load the url using the draco format loader
    // @ts-ignore: cannot find CORE and DRACO
    const modelData = await CORE.load(url, DRACO.DracoLoader);

    // loaded colors only contain RGB, convert it to an array of RGBA with alpha of 255
    const srcColors = modelData.attributes.COLOR_0.value;
    const numVertices = srcColors.length / modelData.attributes.COLOR_0.size;
    const colors32 = new Uint8Array(numVertices * 4);
    for (let i = 0; i < numVertices; i++) {
        colors32[i * 4 + 0] = srcColors[i * 3 + 0];
        colors32[i * 4 + 1] = srcColors[i * 3 + 1];
        colors32[i * 4 + 2] = srcColors[i * 3 + 2];
        colors32[i * 4 + 3] = 255;
    }

    // based on the loaded data, create the mesh with position and color vertex data
    const mesh = new pc.Mesh(app.graphicsDevice);
    mesh.clear(true, false);
    mesh.setPositions(modelData.attributes.POSITION.value, modelData.attributes.POSITION.size);
    mesh.setColors32(colors32);
    mesh.update(pc.PRIMITIVE_POINTS);

    const shader = pc.createShaderFromCode(app.graphicsDevice, files['shader.vert'], files['shader.frag'], 'MyShader', {
        aPosition: pc.SEMANTIC_POSITION,
        aColor: pc.SEMANTIC_COLOR
    });

    // create material using the shader
    const material = new pc.Material();
    material.shader = shader;
    material.blendType = pc.BLENDMODE_ONE_MINUS_DST_ALPHA;
    material.cull = pc.CULLFACE_NONE;

    // Add an entity with a render component to render the mesh
    const entity = new pc.Entity();
    entity.addComponent('render', {
        material: material,
        meshInstances: [new pc.MeshInstance(mesh, material)]
    });

    app.root.addChild(entity);
}
// Create an Entity with a camera component
const camera = new pc.Entity();
camera.addComponent('camera', {
    clearColor: new pc.Color(0.1, 0.1, 0.1),
    farClip: 100
});
camera.translate(-20, 15, 20);
camera.lookAt(0, 7, 0);
app.root.addChild(camera);
// Load the draco model, don't wait for it.
loadModel(rootPath + '/static/assets/models/park_points.drc');
// update things each frame
let time = 0;
app.on('update', function (dt) {
    time += dt;
    // orbit the camera
    if (camera) {
        camera.setLocalPosition(40 * Math.sin(time * 0.5), 10, 20 * Math.cos(time * 0.5));
        camera.lookAt(pc.Vec3.ZERO);
    }
});

export { app };

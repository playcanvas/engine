import * as pc from 'playcanvas';
import files from 'examples/files';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

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
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

const assets = {
    statue: new pc.Asset('statue', 'container', { url: rootPath + '/static/assets/models/statue.glb' })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Ensure canvas is resized when window changes size
    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);
    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
    });

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.1, 0.1, 0.1)
    });
    camera.translate(0, 7, 24);

    // Add entity into scene hierarchy
    app.root.addChild(camera);
    app.start();

    // Create a new Entity
    const entity = assets.statue.resource.instantiateRenderEntity();
    app.root.addChild(entity);

    // Create the shader definition and shader from the vertex and fragment shaders
    const shader = pc.createShaderFromCode(app.graphicsDevice, files['shader.vert'], files['shader.frag'], 'myShader', {
        aPosition: pc.SEMANTIC_POSITION,
        aUv0: pc.SEMANTIC_TEXCOORD0
    });

    // Create a new material with the new shader
    const material = new pc.Material();
    material.shader = shader;

    // find all render components
    const renderComponents = entity.findComponents('render');

    // for all render components
    renderComponents.forEach(function (/** @type {pc.RenderComponent} */ render) {
        // For all meshes in the render component, assign new material
        render.meshInstances.forEach(function (meshInstance) {
            meshInstance.material = material;
        });

        // set it to render as points
        render.renderStyle = pc.RENDERSTYLE_POINTS;
    });

    let currentTime = 0;
    app.on('update', function (dt) {
        // Update the time and pass it to shader
        currentTime += dt;
        material.setParameter('uTime', currentTime);

        // Rotate the model
        entity.rotate(0, 15 * dt, 0);
    });
});

export { app };

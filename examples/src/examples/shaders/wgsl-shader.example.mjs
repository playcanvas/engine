// @config WEBGL_DISABLED
// @config HIDDEN
import files from 'examples/files';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    diffuse: new pc.Asset('color', 'texture', { url: `${rootPath}/static/assets/textures/playcanvas.png` })
};

// Even though we're using WGSL, we still need to provide glslang
// and twgsl to compile shaders used internally by the engine.
const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);


if (!device.isWebGPU) {
    throw new Error('WebGPU is required for this example.');
}

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
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

    const material = new pc.ShaderMaterial({
        uniqueName: 'MyWGSLShader',
        vertexWGSL: files['shader.vert.wgsl'],
        fragmentWGSL: files['shader.frag.wgsl'],
        attributes: {
            position: pc.SEMANTIC_POSITION,
            texCoords: pc.SEMANTIC_TEXCOORD0
        }
    });

    material.setParameter('diffuseTexture', assets.diffuse.resource);

    // create box entity
    const box = new pc.Entity('cube');
    box.addComponent('render', {
        type: 'box',
        material: material
    });
    app.root.addChild(box);

    // create camera entity
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.5, 0.6, 0.9)
    });
    app.root.addChild(camera);
    camera.setPosition(0, 0, 3);

    // Rotate the box according to the delta time since the last frame.
    // Update the material's 'amount' parameter to animate the color.
    let time = 0;
    app.on('update', (/** @type {number} */ dt) => {
        box.rotate(10 * dt, 20 * dt, 30 * dt);

        time += dt;
        // animate the amount as a sine wave varying from 0 to 1
        material.setParameter('amount', (Math.sin(time * 4) + 1) * 0.5);
    });
});

export { app };

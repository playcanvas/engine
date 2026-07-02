import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    RENDERSTYLE_POINTS,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    ShaderMaterial,
    TextureHandler,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

import shaderFrag from './shader.frag';
import shaderVert from './shader.vert';

/**
 * @import { RenderComponent } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: './assets/wasm/glslang/glslang.js',
    twgslUrl: './assets/wasm/twgsl/twgsl.js'
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

const app = new AppBase(canvas);
app.init(createOptions);

const assets = {
    statue: new Asset('statue', 'container', { url: './assets/models/statue.glb' })
};

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.1)
});
camera.translate(0, 7, 24);

// Add entity into scene hierarchy
app.root.addChild(camera);
app.start();

// Create a new Entity
const entity = assets.statue.resource.instantiateRenderEntity();
app.root.addChild(entity);

// Create a new material with a custom shader
const material = new ShaderMaterial({
    uniqueName: 'MyShader',
    vertexGLSL: shaderVert,
    fragmentGLSL: shaderFrag,
    attributes: {
        aPosition: SEMANTIC_POSITION,
        aUv0: SEMANTIC_TEXCOORD0
    }
});

// find all render components
const renderComponents = entity.findComponents('render');

// for all render components
renderComponents.forEach((/** @type {RenderComponent} */ render) => {
    // For all meshes in the render component, assign new material
    render.meshInstances.forEach((meshInstance) => {
        meshInstance.material = material;
    });

    // set it to render as points
    render.renderStyle = RENDERSTYLE_POINTS;
});

let currentTime = 0;
app.on('update', (dt) => {
    // Update the time and pass it to shader
    currentTime += dt;
    material.setParameter('uTime', currentTime);

    // Rotate the model
    entity.rotate(0, 15 * dt, 0);
});

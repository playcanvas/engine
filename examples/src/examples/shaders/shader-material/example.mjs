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
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    ShaderMaterial,
    TextureHandler,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

import shaderGlslFrag from './shader.glsl.frag';
import shaderGlslVert from './shader.glsl.vert';
import shaderWgslFrag from './shader.wgsl.frag';
import shaderWgslVert from './shader.wgsl.vert';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    diffuse: new Asset('color', 'texture', { url: './assets/textures/playcanvas.png' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

const app = new AppBase(canvas);
app.init(createOptions);

await new Promise((resolve) => {
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

const material = new ShaderMaterial({
    uniqueName: 'ShaderMaterialExample',
    vertexGLSL: shaderGlslVert,
    fragmentGLSL: shaderGlslFrag,
    vertexWGSL: shaderWgslVert,
    fragmentWGSL: shaderWgslFrag,
    attributes: {
        aPosition: SEMANTIC_POSITION,
        aUv0: SEMANTIC_TEXCOORD0
    }
});

material.setParameter('diffuseTexture', assets.diffuse.resource);
material.update();

// Create box entity
const box = new Entity('cube');
box.addComponent('render', {
    type: 'box',
    material: material
});
app.root.addChild(box);

// Create camera entity
const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(0.5, 0.6, 0.9)
});
app.root.addChild(camera);
camera.setPosition(0, 0, 3);

// Rotate the box according to the delta time since the last frame.
// Update the material's 'amount' parameter to animate the color.
let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    box.rotate(10 * dt, 20 * dt, 30 * dt);

    time += dt;
    // Animate the amount as a sine wave varying from 0 to 1
    material.setParameter('amount', (Math.sin(time * 4) + 1) * 0.5);
});

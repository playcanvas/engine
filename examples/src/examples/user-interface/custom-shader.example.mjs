import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_ADDITIVEALPHA,
    ButtonComponentSystem,
    CameraComponentSystem,
    Color,
    ELEMENTTYPE_IMAGE,
    ElementComponentSystem,
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SCALEMODE_BLEND,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    ScreenComponentSystem,
    ShaderMaterial,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec4,
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
    playcanvas: new Asset('playcanvas', 'texture', { url: './assets/textures/playcanvas.png' }, { srgb: true })
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
createOptions.elementInput = new ElementInput(canvas);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    ScreenComponentSystem,
    ButtonComponentSystem,
    ElementComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, FontHandler];

const app = new AppBase(canvas);
app.init(createOptions);

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

app.start();

// Create a camera
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(30 / 255, 30 / 255, 30 / 255)
});
app.root.addChild(camera);

// Create a 2D screen
const screen = new Entity();
screen.addComponent('screen', {
    referenceResolution: new Vec2(1280, 720),
    scaleBlend: 0.5,
    scaleMode: SCALEMODE_BLEND,
    screenSpace: true
});
app.root.addChild(screen);

// Create a new material with the new shader and additive alpha blending
const material = new ShaderMaterial({
    uniqueName: 'myUIShader',
    vertexGLSL: shaderGlslVert,
    fragmentGLSL: shaderGlslFrag,
    vertexWGSL: shaderWgslVert,
    fragmentWGSL: shaderWgslFrag,
    attributes: {
        vertex_position: SEMANTIC_POSITION,
        vertex_texCoord0: SEMANTIC_TEXCOORD0
    }
});
material.blendType = BLEND_ADDITIVEALPHA;
material.depthWrite = true;
material.setParameter('uDiffuseMap', assets.playcanvas.resource);
material.update();

// Create the UI image element with the custom material
const entity = new Entity();
entity.addComponent('element', {
    pivot: new Vec2(0.5, 0.5),
    anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
    width: 350,
    height: 350,
    type: ELEMENTTYPE_IMAGE
});
entity.element.material = material;
screen.addChild(entity);

// Update the material's 'amount' parameter to animate the inverse effect
let time = 0;
app.on('update', (dt) => {
    time += dt;
    // Animate the amount as a sine wave varying from 0 to 1
    material.setParameter('amount', (Math.sin(time * 4) + 1) * 0.5);
});

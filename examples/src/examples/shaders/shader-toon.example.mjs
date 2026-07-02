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
    Keyboard,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SEMANTIC_NORMAL,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    ShaderMaterial,
    TextureHandler,
    TouchDevice,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

import shaderGlslFrag from './shader.glsl.frag';
import shaderGlslVert from './shader.glsl.vert';
import shaderWgslFrag from './shader.wgsl.frag';
import shaderWgslVert from './shader.wgsl.vert';

/**
 * @import { RenderComponent, Texture } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    statue: new Asset('statue', 'container', { url: './assets/models/statue.glb' })
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
createOptions.keyboard = new Keyboard(document.body);

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

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

app.scene.ambientLight = new Color(0.2, 0.2, 0.2);

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5)
});
camera.translate(0, 7, 24);

// Create an Entity with a omni light component and a sphere model component.
const light = new Entity();
light.addComponent('light', {
    type: 'omni',
    color: new Color(1, 1, 1),
    radius: 10
});
light.translate(0, 1, 0);

// Add entities into scene hierarchy
app.root.addChild(camera);
app.root.addChild(light);

// Create a new material with a custom shader
const material = new ShaderMaterial({
    uniqueName: 'toon',
    vertexGLSL: shaderGlslVert,
    fragmentGLSL: shaderGlslFrag,
    vertexWGSL: shaderWgslVert,
    fragmentWGSL: shaderWgslFrag,
    attributes: {
        aPosition: SEMANTIC_POSITION,
        aNormal: SEMANTIC_NORMAL,
        aUv: SEMANTIC_TEXCOORD0
    }
});

// create a hierarchy of entities with render components, representing the statue model
const entity = assets.statue.resource.instantiateRenderEntity();
app.root.addChild(entity);

/**
 * Set the new material on all meshes in the model, and use original texture from the model on the new material
 * @type {Texture | null}
 */
/** @type {Array<RenderComponent>} */
const renders = entity.findComponents('render');
renders.forEach((render) => {
    render.meshInstances.forEach((meshInstance) => {
        meshInstance.material = material;
    });
});

// material parameters
const lightPosArray = [light.getPosition().x, light.getPosition().y, light.getPosition().z];
material.setParameter('uLightPos', lightPosArray);
material.update();

// rotate the statue
app.on('update', (dt) => {
    entity.rotate(0, 60 * dt, 0);
});

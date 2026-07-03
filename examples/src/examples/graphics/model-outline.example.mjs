import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    Keyboard,
    Layer,
    LightComponentSystem,
    Mouse,
    PIXELFORMAT_RGBA8,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RenderTarget,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    Texture,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    outline: new Asset('outline', 'script', { url: './scripts/posteffects/posteffect-outline.js' })
};
const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: './assets/wasm/glslang/glslang.js',
    twgslUrl: './assets/wasm/twgsl/twgsl.js'
};
const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.keyboard = new Keyboard(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [ScriptHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

app.scene.ambientLight = new Color(0.2, 0.2, 0.2);

/**
 * Helper function to create a primitive with shape type, position, scale, color and layer.
 *
 * @param {string} primitiveType - The primitive type.
 * @param {number | Vec3} position - The position.
 * @param {number | Vec3} scale - The scale.
 * @param {Color} color - The color.
 * @param {number[]} layer - The layer.
 * @returns {Entity} The new primitive entity.
 */
function createPrimitive(primitiveType, position, scale, color, layer) {
    // create material of specified color
    const material = new StandardMaterial();
    material.diffuse = color;
    material.update();

    // create primitive
    const primitive = new Entity();
    primitive.addComponent('render', {
        type: primitiveType,
        layers: layer,
        material: material
    });

    // set position and scale and add it to scene
    primitive.setLocalPosition(position);
    primitive.setLocalScale(scale);
    app.root.addChild(primitive);

    return primitive;
}

// create texture and render target for rendering into, including depth buffer
function createRenderTarget() {
    const texture = new Texture(app.graphicsDevice, {
        name: 'OutlineObjects',
        width: app.graphicsDevice.width,
        height: app.graphicsDevice.height,
        format: PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: FILTER_LINEAR,
        magFilter: FILTER_LINEAR
    });
    return new RenderTarget({
        colorBuffer: texture,
        depth: true
    });
}

let renderTarget = createRenderTarget();

// create a layer for rendering to texture, and add it to the layers
const outlineLayer = new Layer({ name: 'OutlineLayer' });
app.scene.layers.push(outlineLayer);

// get existing layers
const worldLayer = app.scene.layers.getLayerByName('World');
const uiLayer = app.scene.layers.getLayerByName('UI');

// create ground plane and 3 primitives, visible in both layers
createPrimitive('plane', new Vec3(0, 0, 0), new Vec3(20, 20, 20), new Color(0.3, 0.5, 0.3), [worldLayer.id]);
createPrimitive('sphere', new Vec3(-2, 1, 0), new Vec3(2, 2, 2), new Color(1, 0, 0), [worldLayer.id]);
createPrimitive('box', new Vec3(2, 1, 0), new Vec3(2, 2, 2), new Color(1, 1, 0), [worldLayer.id, outlineLayer.id]);
createPrimitive('cone', new Vec3(0, 1, -2), new Vec3(2, 2, 2), new Color(0, 1, 1), [worldLayer.id]);

// Create main camera, which renders entities in world layer
const camera = new Entity('MainCamera');
camera.addComponent('camera', {
    clearColor: new Color(0.2, 0.2, 0.4),
    layers: [worldLayer.id, uiLayer.id]
});
camera.translate(0, 20, 25);
camera.lookAt(Vec3.ZERO);

// Create outline camera, which renders entities in outline layer into the render target
const outlineCamera = new Entity('Outline Camera');
outlineCamera.addComponent('camera', {
    clearColor: new Color(0.0, 0.0, 0.0, 0.0),
    layers: [outlineLayer.id],
    renderTarget: renderTarget,

    // set the priority of outlineCamera to lower number than the priority of the main camera (which is at default 0)
    // to make it rendered first each frame
    priority: -1
});
app.root.addChild(outlineCamera);

// @ts-ignore engine-tsd
const outline = new OutlineEffect(app.graphicsDevice, 3);
outline.color = new Color(0, 0.5, 1, 1);
outline.texture = renderTarget.colorBuffer;
camera.camera.postEffects.addEffect(outline);

app.root.addChild(camera);

// Create an Entity with a omni light component and add it to both layers
const light = new Entity();
light.addComponent('light', {
    type: 'omni',
    color: new Color(1, 1, 1),
    range: 20,
    castShadows: true,
    shadowBias: 0.05,
    normalOffsetBias: 0.03,
    layers: [worldLayer.id]
});
light.translate(0, 2, 5);
app.root.addChild(light);

// Ensure canvas is resized when window changes size + render target handling
const resize = () => {
    app.resizeCanvas();

    // re-create the render target for the outline camera
    renderTarget.colorBuffer.destroy();
    renderTarget.destroy();
    renderTarget = createRenderTarget();
    outlineCamera.camera.renderTarget = renderTarget;
    outline.texture = renderTarget.colorBuffer;
};
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// update things each frame
let time = 0;
app.on('update', dt => {
    time += dt;

    // rotate the camera around the objects
    camera.setLocalPosition(12 * Math.sin(time), 5, 12 * Math.cos(time));
    camera.lookAt(Vec3.ZERO);

    // outline camera needs to match the main camera
    outlineCamera.setLocalPosition(camera.getLocalPosition());
    outlineCamera.setLocalRotation(camera.getLocalRotation());
});

import {
    AppBase,
    AppOptions,
    BLEND_NORMAL,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    Layer,
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    StandardMaterial,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];

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

app.start();

app.scene.ambientLight = new Color(0.2, 0.2, 0.2);

// Create a new layer to put in front of everything
const layer = new Layer({
    name: 'Front Layer'
});

// get the world layer index
const worldLayer = app.scene.layers.getLayerByName('World');
const idx = app.scene.layers.getTransparentIndex(worldLayer);

// insert the new layer after the world layer
app.scene.layers.insert(layer, idx + 1);

// Create an Entity with a camera component
// Make sure it renders both World and Front Layer
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5),
    layers: [worldLayer.id, layer.id]
});
camera.translate(0, 0, 24);
app.root.addChild(camera);

// Create an Entity with a omni light component
// Make sure it lights both World and Front Layer
const light = new Entity();
light.addComponent('light', {
    type: 'omni',
    color: new Color(1, 1, 1),
    range: 100,
    layers: [worldLayer.id, layer.id]
});
light.translate(5, 0, 15);
app.root.addChild(light);

// red material is semi-transparent
const red = new StandardMaterial();
red.diffuse.set(1, 0, 0);
red.blendType = BLEND_NORMAL;
red.opacity = 0.5;
red.update();

// blue material does not test the existing depth buffer
const blue = new StandardMaterial();
blue.diffuse.set(0, 0, 1);
blue.depthTest = false;
blue.update();

// red box is rendered first in World layer
const redBox = new Entity();
redBox.addComponent('render', {
    type: 'box',
    material: red
});
redBox.setLocalScale(5, 5, 5);
app.root.addChild(redBox);

// blue box is rendered in the Front Layer which is after World
// because it does not test for depth
// and is in a later layer
// it is visible even though it should be inside the red box
const blueBox = new Entity();
blueBox.addComponent('render', {
    type: 'box',
    material: blue,
    layers: [layer.id] // try removing this line, the blue box will appear inside the red one
});
blueBox.setLocalScale(2.5, 2.5, 2.5);
app.root.addChild(blueBox);

app.on('update', (dt) => {
    if (redBox) {
        redBox.rotate(0, 10 * dt, 0);
    }
    if (blueBox) {
        blueBox.rotate(0, -10 * dt, 0);
    }
});

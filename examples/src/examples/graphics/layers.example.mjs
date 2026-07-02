import * as pc from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

app.start();

app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

// create a new layer to put in front of everything
const layer = new pc.Layer({
    name: 'Front Layer'
});

// get the world layer index
const worldLayer = app.scene.layers.getLayerByName('World');
const idx = app.scene.layers.getTransparentIndex(worldLayer);

// insert the new layer after the world layer
app.scene.layers.insert(layer, idx + 1);

// create an entity with a camera component
// make sure it renders both world and front layer
const camera = new pc.Entity();
camera.addComponent('camera', {
    clearColor: new pc.Color(0.4, 0.45, 0.5),
    layers: [worldLayer.id, layer.id]
});
camera.translate(0, 0, 24);
app.root.addChild(camera);

// create an entity with a omni light component
// make sure it lights both world and front layer
const light = new pc.Entity();
light.addComponent('light', {
    type: 'omni',
    color: new pc.Color(1, 1, 1),
    range: 100,
    layers: [worldLayer.id, layer.id]
});
light.translate(5, 0, 15);
app.root.addChild(light);

// red material is semi-transparent
const red = new pc.StandardMaterial();
red.diffuse.set(1, 0, 0);
red.blendType = pc.BLEND_NORMAL;
red.opacity = 0.5;
red.update();

// blue material does not test the existing depth buffer
const blue = new pc.StandardMaterial();
blue.diffuse.set(0, 0, 1);
blue.depthTest = false;
blue.update();

// red box is rendered first in world layer
const redBox = new pc.Entity();
redBox.addComponent('render', {
    type: 'box',
    material: red
});
redBox.setLocalScale(5, 5, 5);
app.root.addChild(redBox);

// blue box is rendered in the front layer which is after world
// because it does not test for depth
// and is in a later layer
// it is visible even though it should be inside the red box
const blueBox = new pc.Entity();
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

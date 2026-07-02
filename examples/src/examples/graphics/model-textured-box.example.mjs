import * as pc from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    clouds: new pc.Asset('clouds', 'texture', { url: './assets/textures/clouds.jpg' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler];

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

await new Promise((resolve) => {
    new pc.AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

// material with the diffuse texture
const material = new pc.StandardMaterial();
material.diffuseMap = assets.clouds.resource;
material.update();

// create a entity with a box model component
const box = new pc.Entity();
box.addComponent('render', {
    type: 'box',
    material: material
});

// create an entity with a omni light component and a sphere model component.
const light = new pc.Entity();
light.addComponent('light', {
    type: 'omni',
    color: new pc.Color(1, 0, 0),
    radius: 10
});
light.addComponent('render', {
    type: 'sphere'
});
// scale the sphere down to 0.1m
light.setLocalScale(0.1, 0.1, 0.1);

// create an entity with a camera component
const camera = new pc.Entity();
camera.addComponent('camera', {
    clearColor: new pc.Color(0.4, 0.45, 0.5)
});

// add the new entities to the hierarchy
app.root.addChild(box);
app.root.addChild(light);
app.root.addChild(camera);

// move the camera 10m along the z-axis
camera.translate(0, 0, 10);

// set an update function on the app's update event
let angle = 0;
app.on('update', (dt) => {
    angle += dt;
    if (angle > 360) {
        angle = 0;
    }

    // move the light in a circle
    light.setLocalPosition(3 * Math.sin(angle), 0, 3 * Math.cos(angle));

    // rotate the box
    box.setEulerAngles(angle * 2, angle * 4, angle * 8);
});

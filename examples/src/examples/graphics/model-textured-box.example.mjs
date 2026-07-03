import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    StandardMaterial,
    TextureHandler,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    clouds: new Asset('clouds', 'texture', { url: './assets/textures/clouds.jpg' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
createOptions.resourceHandlers = [TextureHandler];

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

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

app.scene.ambientLight = new Color(0.2, 0.2, 0.2);

// material with the diffuse texture
const material = new StandardMaterial();
material.diffuseMap = assets.clouds.resource;
material.update();

// Create a Entity with a Box model component
const box = new Entity();
box.addComponent('render', {
    type: 'box',
    material: material
});

// Create an Entity with a omni light component and a sphere model component.
const light = new Entity();
light.addComponent('light', {
    type: 'omni',
    color: new Color(1, 0, 0),
    radius: 10
});
light.addComponent('render', {
    type: 'sphere'
});
// Scale the sphere down to 0.1m
light.setLocalScale(0.1, 0.1, 0.1);

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5)
});

// Add the new Entities to the hierarchy
app.root.addChild(box);
app.root.addChild(light);
app.root.addChild(camera);

// Move the camera 10m along the z-axis
camera.translate(0, 0, 10);

// Set an update function on the app's update event
let angle = 0;
app.on('update', dt => {
    angle += dt;
    if (angle > 360) {
        angle = 0;
    }

    // Move the light in a circle
    light.setLocalPosition(3 * Math.sin(angle), 0, 3 * Math.cos(angle));

    // Rotate the box
    box.setEulerAngles(angle * 2, angle * 4, angle * 8);
});

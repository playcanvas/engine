import {
    AppBase,
    AppOptions,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    TextureHandler,
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
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

const app = new AppBase(canvas);
app.init(createOptions);

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

app.scene.ambientLight = new Color(0.2, 0.2, 0.2);

app.scene.lighting.shadowsEnabled = false;

// All render component primitive shape types
const shapes = ['box', 'plane', 'cone', 'cylinder', 'sphere', 'capsule'];
let x = -1,
    y = -1;

shapes.forEach((shape) => {
    // Create an entity with a render component
    const entity = new Entity(shape);
    entity.addComponent('render', {
        type: shape
    });
    app.root.addChild(entity);

    // Lay out the 6 primitives in two rows, 3 per row
    entity.setLocalPosition(x * 1.2, y, 0);
    if (x++ === 1) {
        x = -1;
        y = 1;
    }
});

// Create an entity with a directional light component
const light = new Entity();
light.addComponent('light', {
    type: 'directional',
    castShadows: false
});
app.root.addChild(light);
light.setLocalEulerAngles(45, 30, 0);

// Create an entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5)
});
app.root.addChild(camera);
camera.setLocalPosition(0, 0, 5);

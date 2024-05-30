import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);


const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

app.start();

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

app.scene.lighting.shadowsEnabled = false;

// All render component primitive shape types
const shapes = ['box', 'plane', 'cone', 'cylinder', 'sphere', 'capsule'];
let x = -1,
    y = -1;

shapes.forEach(function (shape) {
    // Create an entity with a render component
    const entity = new pc.Entity(shape);
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
const light = new pc.Entity();
light.addComponent('light', {
    type: 'directional',
    castShadows: false
});
app.root.addChild(light);
light.setLocalEulerAngles(45, 30, 0);

// Create an entity with a camera component
const camera = new pc.Entity();
camera.addComponent('camera', {
    clearColor: new pc.Color(0.4, 0.45, 0.5)
});
app.root.addChild(camera);
camera.setLocalPosition(0, 0, 5);

export { app };

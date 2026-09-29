import {
    AppBase,
    AppOptions,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    Mouse,
    PIXELFORMAT_SRGBA8,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    StandardMaterial,
    Texture,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
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

// A UV test texture: an 8x8 grid of cells, with the hue changing along u and each cell labelled with
// its column and row, so the orientation and any stretching of the UVs are easy to see
const cells = 8;
const cellSize = 64;
const gridCanvas = document.createElement('canvas');
gridCanvas.width = gridCanvas.height = cells * cellSize;
const context = /** @type {CanvasRenderingContext2D} */ (gridCanvas.getContext('2d'));
context.font = `bold ${cellSize * 0.3}px sans-serif`;
context.textAlign = 'center';
context.textBaseline = 'middle';
for (let column = 0; column < cells; column++) {
    for (let row = 0; row < cells; row++) {
        context.fillStyle = `hsl(${(column * 360) / cells}, 70%, ${(column + row) % 2 ? 45 : 65}%)`;
        context.fillRect(column * cellSize, row * cellSize, cellSize, cellSize);
        context.fillStyle = '#000000';
        context.fillText(`${column},${row}`, (column + 0.5) * cellSize, (row + 0.5) * cellSize);
    }
}

const uvTexture = new Texture(device, {
    name: 'uv-grid',
    width: gridCanvas.width,
    height: gridCanvas.height,
    format: PIXELFORMAT_SRGBA8,
    mipmaps: true,
    anisotropy: 8
});
uvTexture.setSource(gridCanvas);

// A single material shared by all shapes, so the texture toggle applies to all of them
const material = new StandardMaterial();

// All render component primitive shape types
const shapes = ['box', 'plane', 'cone', 'cylinder', 'sphere', 'capsule'];
let x = -1,
    y = -1;

shapes.forEach((shape) => {
    // Create an entity with a render component
    const entity = new Entity(shape);
    entity.addComponent('render', {
        type: shape,
        material: material
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

// Create an entity with a camera component, orbiting the shapes
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5)
});
camera.addComponent('script');
app.root.addChild(camera);
camera.setLocalPosition(0, 0, 5);

camera.script.create(CameraControls, {
    properties: {
        focusPoint: Vec3.ZERO,
        enableFly: false
    }
});

// Apply the diffuse texture when the texture toggle is on
const applyTexture = () => {
    material.diffuseMap = data.get('settings.texture') ? uvTexture : null;
    material.update();
};

data.set('settings', {
    texture: false
});
applyTexture();

const settingsEvent = data.on('*:set', (/** @type {string} */ path) => {
    if (path.startsWith('settings.')) {
        applyTexture();
    }
});

app.on('destroy', () => {
    settingsEvent.unbind();
    uvTexture.destroy();
});

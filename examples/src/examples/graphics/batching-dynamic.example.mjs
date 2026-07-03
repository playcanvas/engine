import {
    AppBase,
    AppOptions,
    BatchManager,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    StandardMaterial,
    Vec3,
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

createOptions.batchManager = BatchManager;

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

// Create two materials
const material1 = new StandardMaterial();
material1.diffuse = new Color(1, 1, 0);
material1.gloss = 0.4;
material1.metalness = 0.5;
material1.useMetalness = true;
material1.update();

const material2 = new StandardMaterial();
material2.diffuse = new Color(0, 1, 1);
material2.gloss = 0.4;
material2.metalness = 0.5;
material2.useMetalness = true;
material2.update();

// Create a single BatchGroup. Make it dynamic to allow batched meshes to be freely moved every frame.
const batchGroup = app.batcher.addGroup('Meshes', true, 100);

// Create various primitive instances using one of the two materials
const numInstances = 500;
const shapes = ['box', 'cone', 'cylinder', 'sphere', 'capsule'];
/** @type {Entity[]} */
const entities = [];
for (let i = 0; i < numInstances; i++) {
    // Random shape
    const shapeName = shapes[Math.floor(Math.random() * shapes.length)];

    const entity = new Entity();

    // Create render component
    entity.addComponent('render', {
        type: shapeName,
        material: Math.random() < 0.5 ? material1 : material2,
        castShadows: true,

        // Add it to the batchGroup - this instructs engine to try and render these meshes in a small number of draw calls.
        // There will be at least 2 draw calls, one for each material
        batchGroupId: batchGroup.id
    });

    // Add entity for rendering
    app.root.addChild(entity);

    // Keep in the list to adjust positions each frame
    entities.push(entity);
}

// Create an Entity for the ground
const ground = new Entity();
ground.addComponent('render', {
    type: 'box',
    material: material2
});
ground.setLocalScale(150, 1, 150);
ground.setLocalPosition(0, -26, 0);
app.root.addChild(ground);

// Create an entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.2, 0.2, 0.2)
});
app.root.addChild(camera);

// Create an entity with a directional light component
// Add it as a child of a camera to rotate with the camera
const light = new Entity();
light.addComponent('light', {
    type: 'directional',
    castShadows: true,
    shadowBias: 0.2,
    normalOffsetBias: 0.06,
    shadowDistance: 150
});
camera.addChild(light);
light.setLocalEulerAngles(15, 30, 0);

// Set an update function on the app's update event
let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    time += dt;

    // Move all entities along orbits
    for (let i = 0; i < entities.length; i++) {
        const radius = 5 + (20.0 * i) / numInstances;
        const speed = i / numInstances;
        entities[i].setLocalPosition(
            radius * Math.sin(i + time * speed),
            radius * Math.cos(i + time * speed),
            radius * Math.cos(i + 2 * time * speed)
        );
        entities[i].lookAt(Vec3.ZERO);
    }

    // Orbit camera around
    camera.setLocalPosition(70 * Math.sin(time), 0, 70 * Math.cos(time));
    camera.lookAt(Vec3.ZERO);
});

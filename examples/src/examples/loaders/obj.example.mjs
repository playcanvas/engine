import {
    AppBase,
    AppOptions,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    ModelComponentSystem,
    ModelHandler,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TextureHandler,
    createGraphicsDevice,
    math
} from 'playcanvas';
import { ObjModelParser } from 'playcanvas/scripts/esm/parsers/obj-model.mjs';

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

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    ModelComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, ModelHandler];

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

app.scene.ambientLight = new Color(0.2, 0.2, 0.2);

// OBJ Parser is not enabled by default in engine. Add the parser to the model resource handler
app.loader.getHandler('model').addParser(new ObjModelParser(app.graphicsDevice));

const objurl = './assets/models/monkey.obj';
/** @type {Entity} */
let entity;
app.assets.loadFromUrl(objurl, 'model', (err, asset) => {
    app.start();

    entity = new Entity();
    entity.addComponent('model');
    entity.model.model = asset.resource;
    app.root.addChild(entity);

    // add a randomly generated material to all mesh instances
    const mis = entity.model.meshInstances;
    for (let i = 0; i < mis.length; i++) {
        const material = new StandardMaterial();
        material.diffuse = new Color(math.random(0, 1), math.random(0, 1), math.random(0, 1));
        material.update();
        mis[i].material = material;
    }
});

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5)
});
camera.translate(0, 0, 5);
app.root.addChild(camera);

// Create an Entity with a omni light component
const light = new Entity();
light.addComponent('light', {
    type: 'omni',
    color: new Color(1, 1, 1),
    range: 100
});
light.translate(5, 0, 15);
app.root.addChild(light);

app.on('update', (dt) => {
    if (entity) {
        entity.rotate(0, 100 * dt, 0);
    }
});

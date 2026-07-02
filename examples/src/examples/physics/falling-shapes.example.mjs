import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    CollisionComponentSystem,
    Color,
    ContainerHandler,
    ElementComponentSystem,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    JsonHandler,
    Keyboard,
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RigidBodyComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TextureHandler,
    Vec3,
    WasmModule,
    createGraphicsDevice,
    math
} from 'playcanvas';

import { deviceType } from 'examples/context';

/**
 * @import { RigidBodyComponent } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

WasmModule.setConfig('Ammo', {
    glueUrl: './assets/wasm/ammo/ammo.wasm.js',
    wasmUrl: './assets/wasm/ammo/ammo.wasm.wasm',
    fallbackUrl: './assets/wasm/ammo/ammo.js'
});
await new Promise((resolve) => {
    WasmModule.getInstance('Ammo', () => resolve());
});

const assets = {
    torus: new Asset('torus', 'container', { url: './assets/models/torus.glb' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.keyboard = new Keyboard(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    CollisionComponentSystem,
    RigidBodyComponentSystem,
    ElementComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, JsonHandler, FontHandler];

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

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

app.scene.ambientLight = new Color(0.2, 0.2, 0.2);

// Set the gravity for our rigid bodies
app.systems.rigidbody.gravity.set(0, -9.81, 0);
/**
 * @param {Color} color - The color of the material.
 * @returns {StandardMaterial} The new material.
 */
function createMaterial(color) {
    const material = new StandardMaterial();
    material.diffuse = color;
    // we need to call material.update when we change its properties
    material.update();
    return material;
}

// create a few materials for our objects
const red = createMaterial(new Color(1, 0.3, 0.3));
const gray = createMaterial(new Color(0.7, 0.7, 0.7));

// ***********    Create our floor   *******************

const floor = new Entity();
floor.addComponent('render', {
    type: 'box',
    material: gray
});

// scale it
floor.setLocalScale(10, 1, 10);

// add a rigidbody component so that other objects collide with it
floor.addComponent('rigidbody', {
    type: 'static',
    restitution: 0.5
});

// add a collision component
floor.addComponent('collision', {
    type: 'box',
    halfExtents: new Vec3(5, 0.5, 5)
});

// add the floor to the hierarchy
app.root.addChild(floor);

// ***********    Create lights   *******************

// make our scene prettier by adding a directional light
const light = new Entity();
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 1, 1),
    castShadows: true,
    shadowBias: 0.2,
    shadowDistance: 25,
    normalOffsetBias: 0.05,
    shadowResolution: 2048
});

// set the direction for our light
light.setLocalEulerAngles(45, 30, 0);

// Add the light to the hierarchy
app.root.addChild(light);

// ***********    Create camera    *******************

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.5, 0.5, 0.8),
    farClip: 50
});

// add the camera to the hierarchy
app.root.addChild(camera);

// Move the camera a little further away
camera.translate(0, 10, 15);
camera.lookAt(0, 2, 0);

/**
 * Helper function which creates a template for a collider.
 *
 * @param {string} type - The render component type.
 * @param {object} collisionOptions - The options for the collision component.
 * @param {Entity} [template] - The template entity to use.
 * @returns {Entity} The new template entity.
 */
const createTemplate = (type, collisionOptions, template) => {
    // add a render component (visible mesh)
    if (!template) {
        template = new Entity();
        template.addComponent('render', {
            type: type
        });
    }

    // ...a rigidbody component of type 'dynamic' so that it is simulated by the physics engine...
    template.addComponent('rigidbody', {
        type: 'dynamic',
        mass: 50,
        restitution: 0.5
    });

    // ... and a collision component
    template.addComponent('collision', collisionOptions);

    return template;
};

// ***********    Create templates    *******************

// Create a template for a falling box
const boxTemplate = createTemplate('box', {
    type: 'box',
    halfExtents: new Vec3(0.5, 0.5, 0.5)
});

// A sphere...
const sphereTemplate = createTemplate('sphere', {
    type: 'sphere',
    radius: 0.5
});

// A capsule...
const capsuleTemplate = createTemplate('capsule', {
    type: 'capsule',
    radius: 0.5,
    height: 2
});

// A cylinder...
const cylinderTemplate = createTemplate('cylinder', {
    type: 'cylinder',
    radius: 0.5,
    height: 1
});

// A torus mesh...
const container = assets.torus.resource;
const meshTemplate = container.instantiateRenderEntity();

createTemplate(
    null,
    {
        type: 'mesh',
        renderAsset: container.renders[0]
    },
    meshTemplate
);

// add all the templates to an array so that
// we can randomly spawn them
const templates = [boxTemplate, sphereTemplate, capsuleTemplate, cylinderTemplate, meshTemplate];

// disable the templates because we don't want them to be visible
// we'll just use them to clone other Entities
templates.forEach((template) => {
    template.enabled = false;
});

// ***********    Update Function   *******************

// initialize variables for our update function
let timer = 0;
let count = 40;

// Set an update function on the application's update event
app.on('update', (dt) => {
    // create a falling box every 0.2 seconds
    if (count > 0) {
        timer -= dt;
        if (timer <= 0) {
            count--;
            timer = 0.2;

            // Clone a random template and position it above the floor
            const template = templates[Math.floor(Math.random() * templates.length)];
            const clone = template.clone();
            // enable the clone because the template is disabled
            clone.enabled = true;

            app.root.addChild(clone);

            clone.rigidbody.teleport(math.random(-1, 1), 10, math.random(-1, 1));
            clone.rigidbody.angularVelocity = new Vec3(
                Math.random() * 10 - 5,
                Math.random() * 10 - 5,
                Math.random() * 10 - 5
            );
        }
    }

    // Show active bodies in red and frozen bodies in gray
    app.root.findComponents('rigidbody').forEach((/** @type {RigidBodyComponent} */ body) => {
        body.entity.render.meshInstances[0].material = body.isActive() ? red : gray;
    });
});

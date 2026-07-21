import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    CollisionComponentSystem,
    Color,
    ContainerHandler,
    ELEMENTTYPE_TEXT,
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
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

/**
 * @import { Material, RenderComponent } from 'playcanvas'
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
    font: new Asset('font', 'font', { url: './assets/fonts/arial.json' })
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

/**
 * @param {Color} color - The color.
 * @returns {StandardMaterial} - The material.
 */
function createMaterial(color) {
    const material = new StandardMaterial();
    material.diffuse = color;
    material.update();
    return material;
}

// Create a couple of materials
const red = createMaterial(new Color(1, 0, 0));
const green = createMaterial(new Color(0, 1, 0));

// Create light
const light = new Entity();
light.addComponent('light', {
    type: 'directional'
});

app.root.addChild(light);
light.setEulerAngles(45, 30, 0);

// Create camera
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.5, 0.5, 0.8)
});

app.root.addChild(camera);
camera.setPosition(5, 0, 15);

/**
 * @param {string} type - The shape type.
 * @param {Material} material - The material.
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} z - The z coordinate.
 * @returns {Entity} - The created entity.
 */
function createPhysicalShape(type, material, x, y, z) {
    const e = new Entity();

    // Have to set the position of the entity before adding the static rigidbody
    // component because static bodies cannot be moved after creation
    app.root.addChild(e);
    e.setPosition(x, y, z);

    e.addComponent('render', {
        type: type,
        material: material
    });
    e.addComponent('rigidbody', {
        type: 'static'
    });
    e.addComponent('collision', {
        type: type,
        height: type === 'capsule' ? 2 : 1
    });

    return e;
}

// Create two rows of physical geometric shapes
const types = ['box', 'capsule', 'cone', 'cylinder', 'sphere'];
types.forEach((type, idx) => {
    createPhysicalShape(type, green, idx * 2 + 1, 2, 0);
});
types.forEach((type, idx) => {
    createPhysicalShape(type, green, idx * 2 + 1, -2, 0);
});

// Allocate some colors
const white = new Color(1, 1, 1);
const blue = new Color(0, 0, 1);

// Allocate some vectors
const start = new Vec3();
const end = new Vec3();
const temp = new Vec3();

// Set an update function on the application's update event
let time = 0;
let y = 0;
app.on('update', (dt) => {
    time += dt;

    // Reset all shapes to green
    app.root.findComponents('render').forEach((/** @type {RenderComponent}*/ render) => {
        render.material = green;
    });

    y = 2 + 1.2 * Math.sin(time);
    start.set(0, y, 0);
    end.set(10, y, 0);

    // Render the ray used in the raycast
    app.drawLine(start, end, white);

    const result = app.systems.rigidbody.raycastFirst(start, end);
    if (result) {
        result.entity.render.material = red;

        // Render the normal on the surface from the hit point
        temp.copy(result.normal).mulScalar(0.3).add(result.point);
        app.drawLine(result.point, temp, blue);
    }

    y = -2 + 1.2 * Math.sin(time);
    start.set(0, y, 0);
    end.set(10, y, 0);

    // Render the ray used in the raycast
    app.drawLine(start, end, white);

    const results = app.systems.rigidbody.raycastAll(start, end);
    results.forEach((result) => {
        result.entity.render.material = red;

        // Render the normal on the surface from the hit point
        temp.copy(result.normal).mulScalar(0.3).add(result.point);
        app.drawLine(result.point, temp, blue);
    }, this);
});

/**
 * @param {Asset} fontAsset - The font asset.
 * @param {string} message - The message.
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} z - The z coordinate.
 * @param {number} rot - Euler-rotation around z coordinate.
 */
const createText = (fontAsset, message, x, y, z, rot) => {
    // Create a text element-based entity
    const text = new Entity();
    text.addComponent('element', {
        anchor: [0.5, 0.5, 0.5, 0.5],
        fontAsset: fontAsset,
        fontSize: 0.5,
        pivot: [0, 0.5],
        text: message,
        type: ELEMENTTYPE_TEXT
    });
    text.setLocalPosition(x, y, z);
    text.setLocalEulerAngles(0, 0, rot);
    app.root.addChild(text);
};

createText(assets.font, 'raycastFirst', 0.5, 3.75, 0, 0);
createText(assets.font, 'raycastAll', 0.5, -0.25, 0, 0);

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    CollisionComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RigidBodyComponentSystem,
    StandardMaterial,
    TextureHandler,
    WasmModule,
    createGraphicsDevice,
    math
} from 'playcanvas';

import { deviceType } from 'examples/context';

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

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    CollisionComponentSystem,
    RigidBodyComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

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
    material.update();
    return material;
}

// ***********    Create our floor   *******************

const floor = new Entity();
floor.addComponent('render', {
    type: 'box',
    material: createMaterial(new Color(0.7, 0.7, 0.7))
});
floor.setLocalScale(24, 1, 12);
floor.setLocalPosition(0, -0.5, 0);
floor.addComponent('rigidbody', {
    type: 'static',
    restitution: 0.5
});
floor.addComponent('collision', {
    type: 'box',
    halfExtents: [12, 0.5, 6]
});
app.root.addChild(floor);

// ***********    Create lights   *******************

const light = new Entity();
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 1, 1),
    castShadows: true,
    shadowBias: 0.2,
    shadowDistance: 40,
    normalOffsetBias: 0.05,
    shadowResolution: 2048
});
light.setLocalEulerAngles(45, 30, 0);
app.root.addChild(light);

// ***********    Create camera    *******************

const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.5, 0.5, 0.8),
    farClip: 100
});
app.root.addChild(camera);
camera.translate(0, 9, 14);
camera.lookAt(0, 0.5, 0);

// ***********    Create the tori    *******************

// A single torus mesh is used for every mesh collider below. The torus lies flat: its ring
// runs at a radius of 1 around the local Y axis, with a tube radius of 0.25. All the colliders
// share one set of collision triangle data - each one applies its own entity scale to it.
const container = assets.torus.resource;
const torusRender = container.renders[0];

/**
 * Creates a static torus with a mesh collider that follows the entity scale.
 *
 * @param {number} x - The X position of the torus.
 * @param {number} scale - The uniform scale of the torus.
 * @returns {Entity} The torus entity.
 */
const createTorus = (x, scale) => {
    const torus = container.instantiateRenderEntity();
    torus.setLocalScale(scale, scale, scale);
    torus.setLocalPosition(x, 0.25 * scale, 0);
    torus.addComponent('rigidbody', {
        type: 'static',
        restitution: 0.4
    });
    torus.addComponent('collision', {
        type: 'mesh',
        renderAsset: torusRender
    });
    app.root.addChild(torus);
    return torus;
};

// Three tori at fixed scales. Spheres dropped over a ring come to rest on it, spheres dropped
// over the hole fall through - at every scale, because the collision mesh follows the entity.
const tori = [createTorus(-6, 0.5), createTorus(-2, 1), createTorus(2, 1.5)];

// ...and one whose scale is animated every frame. Its mesh collider is rebuilt automatically
// whenever the entity scale changes, without rebuilding the shared triangle data.
const pulsing = createTorus(6, 1);
tori.push(pulsing);

// ***********    Create the spheres    *******************

const sphereTemplate = new Entity();
sphereTemplate.addComponent('render', {
    type: 'sphere',
    material: createMaterial(new Color(1, 0.3, 0.3))
});
sphereTemplate.setLocalScale(0.4, 0.4, 0.4);
sphereTemplate.addComponent('rigidbody', {
    type: 'dynamic',
    mass: 1,
    restitution: 0.4
});
sphereTemplate.addComponent('collision', {
    type: 'sphere',
    radius: 0.2
});
sphereTemplate.enabled = false;

// ***********    Update Function   *******************

let time = 0;
let spawnTimer = 0;
let spawned = 0;

app.on('update', (dt) => {
    time += dt;

    // Pulse the fourth torus between half and one and a half times its size, keeping it on the floor
    const scale = 1 + 0.5 * Math.sin(time);
    pulsing.setLocalScale(scale, scale, scale);
    pulsing.setLocalPosition(6, 0.25 * scale, 0);

    // Drop a sphere over a random torus every quarter second, somewhere around its ring
    spawnTimer -= dt;
    if (spawned < 100 && spawnTimer <= 0) {
        spawnTimer = 0.25;
        spawned++;

        const torus = tori[Math.floor(Math.random() * tori.length)];
        const position = torus.getPosition();
        const radius = torus.getLocalScale().x * math.random(0.5, 1.2);
        const angle = math.random(0, Math.PI * 2);

        const sphere = sphereTemplate.clone();
        sphere.enabled = true;
        app.root.addChild(sphere);
        sphere.rigidbody.teleport(position.x + Math.cos(angle) * radius, 6, position.z + Math.sin(angle) * radius);
    }
});

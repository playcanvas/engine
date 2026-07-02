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
    JsonHandler,
    KEY_R,
    Keyboard,
    LightComponentSystem,
    ModelComponentSystem,
    RESOLUTION_AUTO,
    RigidBodyComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    TEXTURETYPE_RGBP,
    TextureHandler,
    Vec3,
    WasmModule,
    createGraphicsDevice
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
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    script1: new Asset('script1', 'script', { url: './scripts/camera/tracking-camera.js' }),
    script2: new Asset('script2', 'script', { url: './scripts/physics/render-physics.js' }),
    script3: new Asset('script3', 'script', { url: './scripts/physics/action-physics-reset.js' }),
    script4: new Asset('script4', 'script', { url: './scripts/physics/vehicle.js' })
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
    ModelComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    CollisionComponentSystem,
    RigidBodyComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, JsonHandler];

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

// setup skydome
app.scene.skyboxMip = 2;
app.scene.exposure = 0.3;
app.scene.envAtlas = assets.helipad.resource;

const lighting = app.scene.lighting;
lighting.shadowsEnabled = false;

// Create a static ground shape for our car to drive on
const ground = new Entity('Ground');
ground.addComponent('rigidbody', {
    type: 'static'
});
ground.addComponent('collision', {
    type: 'box',
    halfExtents: new Vec3(50, 0.5, 50)
});
ground.setLocalPosition(0, -0.5, 0);
app.root.addChild(ground);

// Create 4 wheels for our vehicle
const wheels = [
    { name: 'Front Left Wheel', pos: new Vec3(0.8, 0.4, 1.2), front: true },
    { name: 'Front Right Wheel', pos: new Vec3(-0.8, 0.4, 1.2), front: true },
    { name: 'Back Left Wheel', pos: new Vec3(0.8, 0.4, -1.2), front: false },
    { name: 'Back Right Wheel', pos: new Vec3(-0.8, 0.4, -1.2), front: false }
].map((wheelDef) => {
    // Create a wheel
    const wheel = new Entity(wheelDef.name);
    wheel.addComponent('script');
    wheel.script.create('vehicleWheel', {
        attributes: {
            debugRender: true,
            isFront: wheelDef.front
        }
    });
    wheel.setLocalPosition(wheelDef.pos);
    return wheel;
});

// Create a physical vehicle
const vehicle = new Entity('Vehicle');
vehicle.addComponent('rigidbody', {
    mass: 800,
    type: 'dynamic'
});
vehicle.addComponent('collision', {
    type: 'compound'
});
vehicle.addComponent('script');
vehicle.script.create('vehicle', {
    attributes: {
        wheels: wheels
    }
});
vehicle.script.create('vehicleControls');
vehicle.script.create('actionPhysicsReset', {
    attributes: {
        event: 'reset'
    }
});
vehicle.setLocalPosition(0, 2, 0);

// Create the car chassis, offset upwards in Y from the compound body
const chassis = new Entity('Chassis');
chassis.addComponent('collision', {
    type: 'box',
    halfExtents: [0.6, 0.35, 1.65]
});
chassis.setLocalPosition(0, 0.65, 0);

// Create the car chassis, offset upwards in Y from the compound body
const cab = new Entity('Cab');
cab.addComponent('collision', {
    type: 'box',
    halfExtents: [0.5, 0.2, 1]
});
cab.setLocalPosition(0, 1.2, -0.25);

// Add the vehicle to the hierarchy
wheels.forEach((wheel) => {
    vehicle.addChild(wheel);
});
vehicle.addChild(chassis);
vehicle.addChild(cab);
app.root.addChild(vehicle);

// Build a wall of blocks for the car to smash through
for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 5; j++) {
        const block = new Entity('Block');
        block.addComponent('rigidbody', {
            type: 'dynamic'
        });
        block.addComponent('collision', {
            type: 'box'
        });
        block.addComponent('script');
        block.script.create('actionPhysicsReset', {
            attributes: {
                event: 'reset'
            }
        });
        block.setLocalPosition(i - 4.5, j + 0.5, -10);
        app.root.addChild(block);
    }
}

// Create a directional light source
const light = new Entity('Directional Light');
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

// Create a camera to render the scene
const camera = new Entity('Camera');
camera.addComponent('camera');
camera.addComponent('script');
camera.script.create('trackingCamera', {
    attributes: {
        target: vehicle
    }
});
camera.translate(0, 10, 15);
camera.lookAt(0, 0, 0);
app.root.addChild(camera);

// Enable rendering and resetting of all rigid bodies in the scene
app.root.addComponent('script');
app.root.script.create('renderPhysics', {
    attributes: {
        drawShapes: true,
        opacity: 1
    }
});

app.keyboard.on('keydown', (e) => {
    if (e.key === KEY_R) {
        app.fire('reset');
    }
});

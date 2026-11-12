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
    KEY_A,
    KEY_D,
    KEY_DOWN,
    KEY_LEFT,
    KEY_R,
    KEY_RIGHT,
    KEY_S,
    KEY_UP,
    KEY_W,
    Keyboard,
    LightComponentSystem,
    ModelComponentSystem,
    RESOLUTION_AUTO,
    RigidBodyComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
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
    script2: new Asset('script2', 'script', { url: './scripts/physics/action-physics-reset.js' }),
    script3: new Asset('script3', 'script', { url: './scripts/physics/vehicle.js' })
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

// Setup skydome
app.scene.skyboxMip = 2;
app.scene.exposure = 0.6;
app.scene.envAtlas = assets.helipad.resource;

// Creates a simple glossy material, optionally glowing
const createMaterial = (hex, { metalness = 0, gloss = 0.6, emissive = 0 } = {}) => {
    const color = new Color().fromString(hex);
    const material = new StandardMaterial();
    material.diffuse = color;
    material.useMetalness = true;
    material.metalness = metalness;
    material.gloss = gloss;
    if (emissive > 0) {
        material.emissive = color;
        material.emissiveIntensity = emissive;
    }
    material.update();
    return material;
};

const materials = {
    ground: createMaterial('#3a4150', { gloss: 0.3 }),
    line: createMaterial('#e8e8e8', { gloss: 0.3 }),
    body: createMaterial('#e8452c', { metalness: 0.3, gloss: 0.8 }),
    cab: createMaterial('#1b2733', { metalness: 0.5, gloss: 0.9 }),
    tire: createMaterial('#16181c', { gloss: 0.3 }),
    spoke: createMaterial('#c9ced6', { metalness: 1, gloss: 0.7 }),
    headlight: createMaterial('#fff2c4', { emissive: 4 }),
    taillight: createMaterial('#ff2a2a', { emissive: 3 }),
    blocks: ['#f2b134', '#4fb99f', '#59a5d8', '#a78bd9', '#ef6f8b'].map((hex) => createMaterial(hex))
};

/**
 * Creates a visual entity using one of the primitive shapes.
 *
 * @param {string} name - The entity name.
 * @param {'box' | 'cylinder'} type - The primitive type.
 * @param {StandardMaterial} material - The material to render with.
 * @param {Vec3} position - The local position.
 * @param {Vec3} scale - The local scale.
 * @returns {Entity} The new entity.
 */
const createShape = (name, type, material, position, scale) => {
    const entity = new Entity(name);
    entity.addComponent('model', { type, material, castShadows: true, receiveShadows: true });
    entity.setLocalPosition(position);
    entity.setLocalScale(scale);
    return entity;
};

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
ground.addChild(createShape('Ground Visual', 'box', materials.ground, Vec3.ZERO, new Vec3(100, 1, 100)));
app.root.addChild(ground);

// Dashed line down the middle of the track
for (let z = -48; z < 48; z += 4) {
    app.root.addChild(createShape('Line', 'box', materials.line, new Vec3(0, 0.01, z), new Vec3(0.3, 0.02, 2)));
}

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
            isFront: wheelDef.front
        }
    });
    wheel.setLocalPosition(wheelDef.pos);

    // The tire is a cylinder lying on its side, and the spoke pokes out of its sides so the spin is visible
    const tire = createShape('Tire', 'cylinder', materials.tire, Vec3.ZERO, new Vec3(0.8, 0.4, 0.8));
    tire.setLocalEulerAngles(0, 0, 90);
    wheel.addChild(tire);
    wheel.addChild(createShape('Spoke', 'box', materials.spoke, Vec3.ZERO, new Vec3(0.42, 0.1, 0.55)));
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

// Create the car cab, offset upwards in Y from the compound body
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

// Visuals matching the collision boxes, plus the lights
vehicle.addChild(createShape('Body', 'box', materials.body, new Vec3(0, 0.65, 0), new Vec3(1.2, 0.7, 3.3)));
vehicle.addChild(createShape('Cabin', 'box', materials.cab, new Vec3(0, 1.2, -0.25), new Vec3(1, 0.4, 2)));
[-0.4, 0.4].forEach((x) => {
    vehicle.addChild(
        createShape('Headlight', 'box', materials.headlight, new Vec3(x, 0.75, 1.66), new Vec3(0.3, 0.15, 0.05))
    );
    vehicle.addChild(
        createShape('Taillight', 'box', materials.taillight, new Vec3(x, 0.75, -1.66), new Vec3(0.3, 0.15, 0.05))
    );
});
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
        block.addComponent('model', {
            type: 'box',
            material: materials.blocks[j],
            castShadows: true,
            receiveShadows: true
        });
        block.addComponent('script');
        block.script.create('actionPhysicsReset', {
            attributes: {
                event: 'reset'
            }
        });
        block.setLocalPosition(i - 4.5, j + 0.5, 10);
        app.root.addChild(block);
    }
}

// Create a directional light source
const light = new Entity('Directional Light');
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.96, 0.9),
    intensity: 1.5,
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
camera.addComponent('camera', {
    toneMapping: TONEMAP_ACES
});
camera.addComponent('script');
camera.script.create('trackingCamera', {
    attributes: {
        target: vehicle
    }
});
camera.translate(0, 10, -15);
camera.lookAt(0, 0, 0);
app.root.addChild(camera);

// Driving: WASD or the arrow keys on a keyboard, on-screen buttons on a touch screen
const keyboard = /** @type {Keyboard} */ (app.keyboard);
const keys = {
    left: [KEY_LEFT, KEY_A],
    right: [KEY_RIGHT, KEY_D],
    forward: [KEY_UP, KEY_W],
    reverse: [KEY_DOWN, KEY_S]
};
const touch = { left: false, right: false, forward: false, reverse: false };
const held = (action) => touch[action] || keys[action].some((key) => keyboard.isPressed(key));

app.on('update', () => {
    const steering = (held('left') ? 1 : 0) - (held('right') ? 1 : 0);
    const throttle = (held('forward') ? 1 : 0) - (held('reverse') ? 1 : 0);
    /** @type {any} */ (vehicle.script).vehicle.fire('vehicle:controls', steering, throttle);
});

app.keyboard.on('keydown', (e) => {
    if (e.key === KEY_R) {
        app.fire('reset');
    }
});

const overlay = document.createElement('div');
overlay.style.cssText = 'position: absolute; inset: 0; pointer-events: none; font: 15px system-ui; color: #fff;';
document.body.appendChild(overlay);
app.on('destroy', () => overlay.remove());

if (window.matchMedia('(pointer: coarse)').matches) {
    const addButton = (label, position, onDown, onUp) => {
        const button = document.createElement('button');
        button.textContent = label;
        button.style.cssText = `position: absolute; width: 72px; height: 72px; pointer-events: auto;
            border: 2px solid #ffffff80; border-radius: 50%; background: #1b273399; color: #fff;
            font: 28px system-ui; touch-action: none; user-select: none; -webkit-user-select: none; ${position};`;
        button.addEventListener('pointerdown', (event) => {
            button.setPointerCapture(event.pointerId);
            button.style.background = '#e8452ccc';
            onDown();
        });
        for (const type of ['pointerup', 'pointercancel']) {
            button.addEventListener(type, () => {
                button.style.background = '#1b273399';
                onUp?.();
            });
        }
        overlay.appendChild(button);
    };

    const hold = (action) => [() => (touch[action] = true), () => (touch[action] = false)];
    addButton('◀', 'left: 20px; bottom: 20px', ...hold('left'));
    addButton('▶', 'left: 104px; bottom: 20px', ...hold('right'));
    addButton('▲', 'right: 20px; bottom: 104px', ...hold('forward'));
    addButton('▼', 'right: 20px; bottom: 20px', ...hold('reverse'));
    addButton('↺', 'right: 20px; top: 20px; width: 48px; height: 48px; font-size: 22px', () => app.fire('reset'));
} else {
    const hint = document.createElement('div');
    hint.textContent = 'W A S D or arrow keys to drive · R to reset';
    hint.style.cssText = `position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%); padding: 8px 16px;
        border-radius: 20px; background: #1b273399; text-shadow: 0 1px 2px #0008;`;
    overlay.appendChild(hint);
}

import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

pc.WasmModule.setConfig('Ammo', {
    glueUrl: rootPath + '/static/lib/ammo/ammo.wasm.js',
    wasmUrl: rootPath + '/static/lib/ammo/ammo.wasm.wasm',
    fallbackUrl: rootPath + '/static/lib/ammo/ammo.js'
});

await new Promise((resolve) => {
    pc.WasmModule.getInstance('Ammo', () => resolve());
});

const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    script1: new pc.Asset('script1', 'script', { url: rootPath + '/static/scripts/camera/tracking-camera.js' }),
    script2: new pc.Asset('script2', 'script', { url: rootPath + '/static/scripts/physics/render-physics.js' }),
    script3: new pc.Asset('script3', 'script', { url: rootPath + '/static/scripts/physics/action-physics-reset.js' }),
    script4: new pc.Asset('script4', 'script', { url: rootPath + '/static/scripts/physics/vehicle.js' })
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.keyboard = new pc.Keyboard(document.body);

createOptions.componentSystems = [
    pc.ModelComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.CollisionComponentSystem,
    pc.RigidBodyComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.JsonHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // setup skydome
    app.scene.skyboxMip = 2;
    app.scene.exposure = 0.3;
    app.scene.envAtlas = assets.helipad.resource;

    const lighting = app.scene.lighting;
    lighting.shadowsEnabled = false;

    // Create a static ground shape for our car to drive on
    const ground = new pc.Entity('Ground');
    ground.addComponent('rigidbody', {
        type: 'static'
    });
    ground.addComponent('collision', {
        type: 'box',
        halfExtents: new pc.Vec3(50, 0.5, 50)
    });
    ground.setLocalPosition(0, -0.5, 0);
    app.root.addChild(ground);

    // Create 4 wheels for our vehicle
    /**
     * @todo use .map ...
     * @type {pc.Entity[]}
     */
    const wheels = [];
    [
        { name: 'Front Left Wheel', pos: new pc.Vec3(0.8, 0.4, 1.2), front: true },
        { name: 'Front Right Wheel', pos: new pc.Vec3(-0.8, 0.4, 1.2), front: true },
        { name: 'Back Left Wheel', pos: new pc.Vec3(0.8, 0.4, -1.2), front: false },
        { name: 'Back Right Wheel', pos: new pc.Vec3(-0.8, 0.4, -1.2), front: false }
    ].forEach(function (wheelDef) {
        // Create a wheel
        const wheel = new pc.Entity(wheelDef.name);
        wheel.addComponent('script');
        wheel.script.create('vehicleWheel', {
            attributes: {
                debugRender: true,
                isFront: wheelDef.front
            }
        });
        wheel.setLocalPosition(wheelDef.pos);
        wheels.push(wheel);
    });

    // Create a physical vehicle
    const vehicle = new pc.Entity('Vehicle');
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
    const chassis = new pc.Entity('Chassis');
    chassis.addComponent('collision', {
        type: 'box',
        halfExtents: [0.6, 0.35, 1.65]
    });
    chassis.setLocalPosition(0, 0.65, 0);

    // Create the car chassis, offset upwards in Y from the compound body
    const cab = new pc.Entity('Cab');
    cab.addComponent('collision', {
        type: 'box',
        halfExtents: [0.5, 0.2, 1]
    });
    cab.setLocalPosition(0, 1.2, -0.25);

    // Add the vehicle to the hierarchy
    wheels.forEach(function (wheel) {
        vehicle.addChild(wheel);
    });
    vehicle.addChild(chassis);
    vehicle.addChild(cab);
    app.root.addChild(vehicle);

    // Build a wall of blocks for the car to smash through
    for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 5; j++) {
            const block = new pc.Entity('Block');
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
    const light = new pc.Entity('Directional Light');
    light.addComponent('light', {
        type: 'directional',
        color: new pc.Color(1, 1, 1),
        castShadows: true,
        shadowBias: 0.2,
        shadowDistance: 40,
        normalOffsetBias: 0.05,
        shadowResolution: 2048
    });
    light.setLocalEulerAngles(45, 30, 0);
    app.root.addChild(light);

    // Create a camera to render the scene
    const camera = new pc.Entity('Camera');
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

    app.keyboard.on(pc.EVENT_KEYDOWN, function (e) {
        if (e.key === pc.KEY_R) {
            app.fire('reset');
        }
    });
});

export { app };

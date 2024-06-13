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
    model: new pc.Asset('model', 'container', { url: rootPath + '/static/assets/models/bitmoji.glb' }),
    idleAnim: new pc.Asset('idleAnim', 'container', { url: rootPath + '/static/assets/animations/bitmoji/idle.glb' }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
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
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.CollisionComponentSystem,
    pc.RigidBodyComponentSystem,
    pc.AnimComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.ScriptHandler,
    pc.AnimClipHandler,
    pc.AnimStateGraphHandler
];

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
    app.scene.exposure = 2;
    app.scene.skyboxMip = 2;
    app.scene.envAtlas = assets.helipad.resource;

    // Create an entity with a light component
    const lightEntity = new pc.Entity();
    lightEntity.addComponent('light', {
        castShadows: true,
        intensity: 1.5,
        normalOffsetBias: 0.2,
        shadowType: pc.SHADOW_PCF5,
        shadowDistance: 12,
        shadowResolution: 4096,
        shadowBias: 0.2
    });
    app.root.addChild(lightEntity);
    lightEntity.setLocalEulerAngles(45, 30, 0);

    // Set the gravity for our rigid bodies
    app.systems.rigidbody.gravity.set(0, -9.81, 0);

    /**
     * @param {pc.Color} color - The color.
     * @returns {pc.StandardMaterial} The material.
     */
    function createMaterial(color) {
        const material = new pc.StandardMaterial();
        material.diffuse = color;
        // we need to call material.update when we change its properties
        material.update();
        return material;
    }

    // create a few materials for our objects
    const red = createMaterial(new pc.Color(1, 0.3, 0.3));
    const gray = createMaterial(new pc.Color(0.7, 0.7, 0.7));

    const floor = new pc.Entity();
    floor.addComponent('render', {
        type: 'box',
        material: gray
    });

    // Scale it and move it so that the top is at 0 on the y axis
    floor.setLocalScale(10, 1, 10);
    floor.translateLocal(0, -0.5, 0);

    // Add a rigidbody component so that other objects collide with it
    floor.addComponent('rigidbody', {
        type: 'static',
        restitution: 0.5
    });

    // Add a collision component
    floor.addComponent('collision', {
        type: 'box',
        halfExtents: new pc.Vec3(5, 0.5, 5)
    });

    // Add the floor to the hierarchy
    app.root.addChild(floor);

    // Create an entity from the loaded model using the render component
    const modelEntity = assets.model.resource.instantiateRenderEntity({
        castShadows: true
    });

    // Add an anim component to the entity
    modelEntity.addComponent('anim', {
        activate: true
    });

    // create an anim state graph
    const animStateGraphData = {
        layers: [
            {
                name: 'characterState',
                states: [
                    {
                        name: 'START'
                    },
                    {
                        name: 'Idle',
                        speed: 1.0,
                        loop: true
                    }
                ],
                transitions: [
                    {
                        from: 'START',
                        to: 'Idle'
                    }
                ]
            }
        ],
        parameters: {}
    };

    // load the state graph into the anim component
    modelEntity.anim.loadStateGraph(animStateGraphData);

    // Add a rigid body and collision for the head with offset as the model's origin is
    // at the feet on the floor
    modelEntity.addComponent('rigidbody', {
        type: 'static',
        restitution: 0.5
    });

    modelEntity.addComponent('collision', {
        type: 'sphere',
        radius: 0.3,
        linearOffset: [0, 1.25, 0]
    });

    // load the state graph asset resource into the anim component
    const characterStateLayer = modelEntity.anim.baseLayer;
    characterStateLayer.assignAnimation('Idle', assets.idleAnim.resource.animations[0].resource);

    app.root.addChild(modelEntity);

    // Create an Entity with a camera component
    const cameraEntity = new pc.Entity();
    cameraEntity.addComponent('camera');
    cameraEntity.translate(0, 2, 5);
    const lookAtPosition = modelEntity.getPosition();
    cameraEntity.lookAt(lookAtPosition.x, lookAtPosition.y + 0.75, lookAtPosition.z);

    app.root.addChild(cameraEntity);

    // create a ball template that we can clone in the update loop
    const ball = new pc.Entity();
    ball.tags.add('shape');
    ball.setLocalScale(0.4, 0.4, 0.4);
    ball.translate(0, -1, 0);
    ball.addComponent('render', {
        type: 'sphere'
    });

    ball.addComponent('rigidbody', {
        type: 'dynamic',
        mass: 50,
        restitution: 0.5
    });

    ball.addComponent('collision', {
        type: 'sphere',
        radius: 0.2
    });

    ball.enabled = false;

    // initialize variables for our update function
    let timer = 0;
    let count = 40;

    // Set an update function on the application's update event
    app.on('update', function (dt) {
        // create a falling box every 0.2 seconds
        if (count > 0) {
            timer -= dt;
            if (timer <= 0) {
                count--;
                timer = 0.5;

                // Create a new ball to drop
                const clone = ball.clone();
                clone.rigidbody.teleport(pc.math.random(-0.25, 0.25), 5, pc.math.random(-0.25, 0.25));

                app.root.addChild(clone);
                clone.enabled = true;
            }
        }

        // Show active bodies in red and frozen bodies in gray
        app.root.findByTag('shape').forEach(function (/** @type {pc.Entity} */ entity) {
            entity.render.meshInstances[0].material = entity.rigidbody.isActive() ? red : gray;
        });

        // Render the offset collision
        app.scene.immediate.drawWireSphere(
            modelEntity.collision.getShapePosition(),
            0.3,
            pc.Color.GREEN,
            16,
            true,
            app.scene.layers.getLayerByName('World')
        );
    });
});

export { app };

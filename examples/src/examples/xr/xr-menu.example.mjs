// @config WEBGPU_DISABLED
import files from 'examples/files';
import { deviceType, fileImport, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

// Import the XR scripts
const { XrSession } = await fileImport(`${rootPath}/static/scripts/esm/xr-session.mjs`);
const { XrControllers } = await fileImport(`${rootPath}/static/scripts/esm/xr-controllers.mjs`);
const { XrMenu } = await fileImport(`${rootPath}/static/scripts/esm/xr-menu.mjs`);

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// Load Ammo.js physics engine
pc.WasmModule.setConfig('Ammo', {
    glueUrl: `${rootPath}/static/lib/ammo/ammo.wasm.js`,
    wasmUrl: `${rootPath}/static/lib/ammo/ammo.wasm.wasm`,
    fallbackUrl: `${rootPath}/static/lib/ammo/ammo.js`
});
await new Promise((resolve) => {
    pc.WasmModule.getInstance('Ammo', () => resolve());
});

// create UI
// html
const div = document.createElement('div');
div.innerHTML = files['ui.html'];
document.body.appendChild(div);
// css
const css = document.createElement('style');
css.innerHTML = files['ui.css'];
document.head.appendChild(css);

/**
 * @param {string} msg - The message.
 */
const message = (msg) => {
    /** @type {HTMLElement | null} */
    const el = document.querySelector('.message');
    if (el) {
        el.textContent = msg;
    }
};

// Assets
const assets = {
    font: new pc.Asset('font', 'font', { url: `${rootPath}/static/assets/fonts/roboto-extralight.json` }),
    buttonTexture: new pc.Asset('buttonTexture', 'texture', { url: `${rootPath}/static/assets/textures/blue-button.png` }),
    gallery: new pc.Asset('gallery', 'container', { url: `${rootPath}/static/assets/models/vr-gallery.glb` })
};

// Create graphics device
const gfxOptions = {
    deviceTypes: [deviceType],
    alpha: true
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

// Create application with required component systems for UI and physics
const createOptions = new pc.AppOptions();
createOptions.xr = pc.XrManager;
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.keyboard = new pc.Keyboard(window);
createOptions.elementInput = new pc.ElementInput(canvas);

createOptions.componentSystems = [
    pc.ButtonComponentSystem,
    pc.CameraComponentSystem,
    pc.CollisionComponentSystem,
    pc.ElementComponentSystem,
    pc.LightComponentSystem,
    pc.RenderComponentSystem,
    pc.RigidBodyComponentSystem,
    pc.ScreenComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.ContainerHandler, pc.FontHandler, pc.TextureHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    div.remove();
    css.remove();
});

// use device pixel ratio
app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;

// Load assets
const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // create camera parent for locomotion (XrSession attaches to this)
    const cameraParent = new pc.Entity('CameraParent');
    app.root.addChild(cameraParent);

    // create camera
    const cameraEntity = new pc.Entity('Camera');
    cameraEntity.addComponent('camera');
    cameraParent.addChild(cameraEntity);

    // Add XrSession script to camera parent - handles XR lifecycle
    cameraParent.addComponent('script');
    cameraParent.script.create(XrSession, {
        properties: {
            startVrEvent: 'vr:start',
            startArEvent: 'ar:start',
            endEvent: 'xr:end'
        }
    });

    // Add XrControllers script - handles skinned hand/controller models
    cameraParent.script.create(XrControllers);

    // add directional light
    const light = new pc.Entity('Light');
    light.addComponent('light', {
        type: 'directional',
        castShadows: true,
        shadowBias: 0.05,
        normalOffsetBias: 0.05,
        shadowDistance: 10
    });
    light.setEulerAngles(45, 135, 0);
    app.root.addChild(light);

    // Add VR gallery environment with physics
    const galleryEntity = /** @type {pc.ContainerResource} */ (assets.gallery.resource).instantiateRenderEntity();
    galleryEntity.findComponents('render').forEach((/** @type {pc.RenderComponent} */ render) => {
        const entity = render.entity;
        entity.addComponent('rigidbody', {
            type: 'static',
            restitution: 0.5
        });
        entity.addComponent('collision', {
            type: 'mesh',
            renderAsset: render.asset
        });
    });
    app.root.addChild(galleryEntity);

    // Array to track spawned objects for reset
    /** @type {pc.Entity[]} */
    const spawnedObjects = [];

    // Materials for spawned objects (metallic look)
    const createMetallicMaterial = (color) => {
        const m = new pc.StandardMaterial();
        m.diffuse = color;
        m.metalness = 0.8;
        m.gloss = 0.7;
        m.useMetalness = true;
        m.update();
        return m;
    };
    const materials = {
        box: createMetallicMaterial(new pc.Color(0.9, 0.4, 0.3)),
        sphere: createMetallicMaterial(new pc.Color(0.3, 0.5, 0.9))
    };

    /**
     * Spawns a physics shape at position (0, 5, 0).
     *
     * @param {'box'|'sphere'} type - The shape type.
     */
    const spawnShape = (type) => {
        const entity = new pc.Entity(`Spawned${type}`);
        entity.addComponent('render', {
            type,
            material: materials[type]
        });
        entity.addComponent('rigidbody', {
            type: 'dynamic',
            restitution: 0.5
        });
        entity.addComponent('collision', {
            type,
            halfExtents: new pc.Vec3(0.25, 0.25, 0.25),
            radius: 0.25
        });
        entity.setLocalScale(0.5, 0.5, 0.5);
        app.root.addChild(entity);

        entity.rigidbody.teleport(0, 5, 0);

        spawnedObjects.push(entity);
    };

    /**
     * Resets the scene by destroying all spawned objects.
     */
    const resetScene = () => {
        for (const obj of spawnedObjects) {
            obj.destroy();
        }
        spawnedObjects.length = 0;
        message('Scene reset');
    };

    // XR Menu Script Entity
    const menuEntity = new pc.Entity('XrMenu');
    menuEntity.addComponent('script');
    menuEntity.script.create(XrMenu, {
        properties: {
            menuItems: [
                { label: 'Spawn Cube', eventName: 'menu:spawnCube' },
                { label: 'Spawn Sphere', eventName: 'menu:spawnSphere' },
                { label: 'Reset', eventName: 'menu:reset' },
                { label: 'Exit XR', eventName: 'xr:end' }
            ],
            fontAsset: assets.font,
            buttonTexture: assets.buttonTexture
        }
    });
    app.root.addChild(menuEntity);

    // Handle menu events
    app.on('menu:spawnCube', () => spawnShape('box'));
    app.on('menu:spawnSphere', () => spawnShape('sphere'));
    app.on('menu:reset', resetScene);

    if (app.xr.supported) {
        // XR availability
        document
        .querySelector('.container > .button[data-xr="immersive-ar"]')
        ?.classList.toggle('active', app.xr.isAvailable(pc.XRTYPE_AR));
        document
        .querySelector('.container > .button[data-xr="immersive-vr"]')
        ?.classList.toggle('active', app.xr.isAvailable(pc.XRTYPE_VR));

        // XR availability events
        app.xr.on('available', (type, available) => {
            const element = document.querySelector(`.container > .button[data-xr="${type}"]`);
            element?.classList.toggle('active', available);
        });

        // Button handler - fires events that XrSession listens to
        const onXrButtonClick = (e) => {
            const button = /** @type {HTMLElement} */ (e.currentTarget);
            if (!button.classList.contains('active')) return;

            const type = button.getAttribute('data-xr');
            if (type === pc.XRTYPE_AR) {
                app.fire('ar:start');
            } else {
                app.fire('vr:start');
            }
        };

        // Button clicks
        document.querySelectorAll('.container > .button').forEach((button) => {
            button.addEventListener('click', onXrButtonClick);
        });

        if (window.XRHand) {
            message('Click to enter VR, use hand tracking or controllers');
        } else {
            message('Click to enter VR (hand tracking not available)');
        }
    } else {
        message('WebXR is not supported');
    }
});

export { app };

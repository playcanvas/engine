// @config WEBGPU_DISABLED
import files from 'examples/files';
import { deviceType, fileImport, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

// Import scripts
const { CameraControls } = await fileImport(`${rootPath}/static/scripts/esm/camera-controls.mjs`);
const { XrSession } = await fileImport(`${rootPath}/static/scripts/esm/xr-session.mjs`);
const { XrControllers } = await fileImport(`${rootPath}/static/scripts/esm/xr-controllers.mjs`);
const { XrNavigation } = await fileImport(`${rootPath}/static/scripts/esm/xr-navigation.mjs`);
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
    buttonTexture: new pc.Asset('buttonTexture', 'texture', { url: `${rootPath}/static/assets/textures/blue-button.png` }),
    click: new pc.Asset('click', 'audio', { url: `${rootPath}/static/assets/sounds/click.mp3` }),
    cube: new pc.Asset('cube', 'container', { url: `${rootPath}/static/assets/models/playcanvas-cube.glb` }),
    envAtlas: new pc.Asset(
        'env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/morning-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    font: new pc.Asset('font', 'font', { url: `${rootPath}/static/assets/fonts/roboto-extralight.json` }),
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
createOptions.soundManager = new pc.SoundManager();

createOptions.componentSystems = [
    pc.AudioListenerComponentSystem,
    pc.ButtonComponentSystem,
    pc.CameraComponentSystem,
    pc.CollisionComponentSystem,
    pc.ElementComponentSystem,
    pc.LightComponentSystem,
    pc.RenderComponentSystem,
    pc.RigidBodyComponentSystem,
    pc.ScreenComponentSystem,
    pc.ScriptComponentSystem,
    pc.SoundComponentSystem
];
createOptions.resourceHandlers = [pc.AudioHandler, pc.ContainerHandler, pc.FontHandler, pc.TextureHandler];

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

// Load assets
await new Promise((resolve) => {
    new pc.AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Skybox
app.scene.envAtlas = assets.envAtlas.resource;
app.scene.skyboxMip = 0;

// create camera parent for locomotion (XrSession attaches to this)
const cameraParent = new pc.Entity('CameraParent');
app.root.addChild(cameraParent);

// create camera
const cameraEntity = new pc.Entity('Camera');
cameraEntity.addComponent('camera', {
    toneMapping: pc.TONEMAP_NEUTRAL
});
cameraEntity.addComponent('audiolistener');
cameraEntity.setLocalPosition(0, 1.7, -2);
cameraEntity.addComponent('script');
cameraEntity.script.create(CameraControls, {
    properties: {
        focusPoint: new pc.Vec3(0, 1.75, 0)
    }
});
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

// Add XrNavigation script - handles teleportation and smooth locomotion
cameraParent.script.create(XrNavigation);

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

/**
 * Spawns a PlayCanvas cube at position (0, 5, 0).
 */
const spawnCube = () => {
    const entity = /** @type {pc.ContainerResource} */ (assets.cube.resource).instantiateRenderEntity();
    entity.setLocalScale(0.5, 0.5, 0.5);
    entity.addComponent('rigidbody', {
        type: 'dynamic',
        restitution: 0.5
    });
    entity.addComponent('collision', {
        type: 'box',
        halfExtents: new pc.Vec3(0.25, 0.25, 0.25)
    });
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
};

// XR Menu Script Entity
const menuEntity = new pc.Entity('XrMenu');
menuEntity.addComponent('script');
menuEntity.script.create(XrMenu, {
    properties: {
        menuItems: [
            { label: 'Spawn Cube', eventName: 'menu:spawnCube' },
            { label: 'Reset', eventName: 'menu:reset' },
            { label: 'Exit XR', eventName: 'xr:end' }
        ],
        clickSound: assets.click,
        fontAsset: assets.font,
        buttonTexture: assets.buttonTexture
    }
});
app.root.addChild(menuEntity);

// Handle menu events
app.on('menu:spawnCube', spawnCube);
app.on('menu:reset', resetScene);

// Keyboard shortcuts
app.keyboard.on('keydown', (e) => {
    if (e.key === pc.KEY_B) {
        spawnCube();
    } else if (e.key === pc.KEY_R) {
        resetScene();
    }
});

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

    message('In XR, open your left palm toward your face to show the menu');
} else {
    message('WebXR is not supported');
}

export { app };

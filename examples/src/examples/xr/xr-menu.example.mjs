// @config
//
// @credit
// title: VR Gallery
// author: Sketchfab
// source: https://sketchfab.com/3d-models/vr-gallery-1e087aa25dc742e680accb15249bd6be
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    AudioHandler,
    AudioListenerComponentSystem,
    ButtonComponentSystem,
    CameraComponentSystem,
    CollisionComponentSystem,
    ContainerHandler,
    ElementComponentSystem,
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    KEY_B,
    KEY_R,
    Keyboard,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RigidBodyComponentSystem,
    ScreenComponentSystem,
    ScriptComponentSystem,
    SoundComponentSystem,
    SoundManager,
    TEXTURETYPE_RGBP,
    TONEMAP_NEUTRAL,
    TextureHandler,
    TouchDevice,
    Vec3,
    WasmModule,
    XRTYPE_AR,
    XRTYPE_VR,
    XrManager,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { XrControllers } from 'playcanvas/scripts/esm/xr-controllers.mjs';
import { XrMenu } from 'playcanvas/scripts/esm/xr-menu.mjs';
import { XrNavigation } from 'playcanvas/scripts/esm/xr-navigation.mjs';
import { XrSession } from 'playcanvas/scripts/esm/xr-session.mjs';

import { deviceType } from 'examples/context';

import uiCss from './ui.css';
import uiHtml from './ui.html';

/**
 * @import { ContainerResource, RenderComponent } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// Load Ammo.js physics engine
WasmModule.setConfig('Ammo', {
    glueUrl: './assets/wasm/ammo/ammo.wasm.js',
    wasmUrl: './assets/wasm/ammo/ammo.wasm.wasm',
    fallbackUrl: './assets/wasm/ammo/ammo.js'
});
await new Promise((resolve) => {
    WasmModule.getInstance('Ammo', () => resolve());
});

// Create UI
// html
const div = document.createElement('div');
div.innerHTML = uiHtml;
document.body.appendChild(div);
// css
const css = document.createElement('style');
css.innerHTML = uiCss;
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
    buttonTexture: new Asset('buttonTexture', 'texture', { url: './assets/textures/blue-button.png' }),
    click: new Asset('click', 'audio', { url: './assets/sounds/click.mp3' }),
    cube: new Asset('cube', 'container', { url: './assets/models/playcanvas-cube.glb' }),
    envAtlas: new Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/morning-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    font: new Asset('font', 'font', { url: './assets/fonts/roboto-extralight.json' }),
    gallery: new Asset('gallery', 'container', { url: './assets/models/vr-gallery.glb' })
};

// Create graphics device
const gfxOptions = {
    deviceTypes: [deviceType],
    alpha: true
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

// AppBase with minimal component systems for UI, scripts, audio, and physics
const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(canvas);
createOptions.touch = new TouchDevice(canvas);
createOptions.keyboard = new Keyboard(window);
createOptions.xr = XrManager;
createOptions.elementInput = new ElementInput(canvas);
createOptions.soundManager = new SoundManager();

createOptions.componentSystems = [
    AudioListenerComponentSystem,
    ButtonComponentSystem,
    CameraComponentSystem,
    CollisionComponentSystem,
    ElementComponentSystem,
    LightComponentSystem,
    RenderComponentSystem,
    RigidBodyComponentSystem,
    ScreenComponentSystem,
    ScriptComponentSystem,
    SoundComponentSystem
];
createOptions.resourceHandlers = [AudioHandler, ContainerHandler, FontHandler, TextureHandler];

const app = new AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

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
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Skybox
app.scene.envAtlas = assets.envAtlas.resource;
app.scene.skyboxMip = 0;

// Create camera parent for locomotion (XrSession attaches to this)
const cameraParent = new Entity('CameraParent');
app.root.addChild(cameraParent);

// Create camera
const cameraEntity = new Entity('Camera');
cameraEntity.addComponent('camera', {
    toneMapping: TONEMAP_NEUTRAL
});
cameraEntity.addComponent('audiolistener');
cameraEntity.setLocalPosition(0, 1.7, -2);
cameraEntity.addComponent('script');
cameraEntity.script.create(CameraControls, {
    properties: {
        focusPoint: new Vec3(0, 1.75, 0)
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

// Add directional light
const light = new Entity('Light');
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
const galleryEntity = /** @type {ContainerResource} */ (assets.gallery.resource).instantiateRenderEntity();
galleryEntity.findComponents('render').forEach((/** @type {RenderComponent} */ render) => {
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
/** @type {Entity[]} */
const spawnedObjects = [];

/**
 * Spawns a PlayCanvas cube at position (0, 5, 0).
 */
const spawnCube = () => {
    const entity = /** @type {ContainerResource} */ (assets.cube.resource).instantiateRenderEntity();
    entity.setLocalScale(0.5, 0.5, 0.5);
    entity.addComponent('rigidbody', {
        type: 'dynamic',
        restitution: 0.5
    });
    entity.addComponent('collision', {
        type: 'box',
        halfExtents: new Vec3(0.25, 0.25, 0.25)
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
const menuEntity = new Entity('XrMenu');
menuEntity.addComponent('script');
menuEntity.script.create(XrMenu, {
    properties: {
        menuItems: [
            { label: 'SPAWN CUBE', eventName: 'menu:spawnCube' },
            { label: 'RESET', eventName: 'menu:reset' },
            { label: 'EXIT XR', eventName: 'xr:end' }
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
    if (e.key === KEY_B) {
        spawnCube();
    } else if (e.key === KEY_R) {
        resetScene();
    }
});

if (app.xr.supported) {
    // XR availability
    document
        .querySelector('.container > .button[data-xr="immersive-ar"]')
        ?.classList.toggle('active', app.xr.isAvailable(XRTYPE_AR));
    document
        .querySelector('.container > .button[data-xr="immersive-vr"]')
        ?.classList.toggle('active', app.xr.isAvailable(XRTYPE_VR));

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
        if (type === XRTYPE_AR) {
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

// @config
//
// @credit
// title: VR Gallery
// author: Sketchfab
// source: https://sketchfab.com/3d-models/vr-gallery-1e087aa25dc742e680accb15249bd6be
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import * as pc from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { XrControllers } from 'playcanvas/scripts/esm/xr-controllers.mjs';
import { XrMenu } from 'playcanvas/scripts/esm/xr-menu.mjs';
import { XrNavigation } from 'playcanvas/scripts/esm/xr-navigation.mjs';
import { XrSession } from 'playcanvas/scripts/esm/xr-session.mjs';

import { deviceType } from 'examples/context';

import uiCss from './ui.css';
import uiHtml from './ui.html';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// load ammo.js physics engine
pc.WasmModule.setConfig('Ammo', {
    glueUrl: './assets/wasm/ammo/ammo.wasm.js',
    wasmUrl: './assets/wasm/ammo/ammo.wasm.wasm',
    fallbackUrl: './assets/wasm/ammo/ammo.js'
});
await new Promise((resolve) => {
    pc.WasmModule.getInstance('Ammo', () => resolve());
});

// create ui
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

// assets
const assets = {
    buttonTexture: new pc.Asset('buttonTexture', 'texture', { url: './assets/textures/blue-button.png' }),
    click: new pc.Asset('click', 'audio', { url: './assets/sounds/click.mp3' }),
    cube: new pc.Asset('cube', 'container', { url: './assets/models/playcanvas-cube.glb' }),
    envAtlas: new pc.Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/morning-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    font: new pc.Asset('font', 'font', { url: './assets/fonts/roboto-extralight.json' }),
    gallery: new pc.Asset('gallery', 'container', { url: './assets/models/vr-gallery.glb' })
};

// create graphics device
const gfxOptions = {
    deviceTypes: [deviceType],
    alpha: true
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

// appbase with minimal component systems for ui, scripts, audio, and physics
const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(canvas);
createOptions.touch = new pc.TouchDevice(canvas);
createOptions.keyboard = new pc.Keyboard(window);
createOptions.xr = pc.XrManager;
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

// ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    div.remove();
    css.remove();
});

// load assets
await new Promise((resolve) => {
    new pc.AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// skybox
app.scene.envAtlas = assets.envAtlas.resource;
app.scene.skyboxMip = 0;

// create camera parent for locomotion (xrsession attaches to this)
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

// add xrsession script to camera parent - handles xr lifecycle
cameraParent.addComponent('script');
cameraParent.script.create(XrSession, {
    properties: {
        startVrEvent: 'vr:start',
        startArEvent: 'ar:start',
        endEvent: 'xr:end'
    }
});

// add xrcontrollers script - handles skinned hand/controller models
cameraParent.script.create(XrControllers);

// add xrnavigation script - handles teleportation and smooth locomotion
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

// add vr gallery environment with physics
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

// array to track spawned objects for reset
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

// xr menu script entity
const menuEntity = new pc.Entity('XrMenu');
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

// handle menu events
app.on('menu:spawnCube', spawnCube);
app.on('menu:reset', resetScene);

// keyboard shortcuts
app.keyboard.on('keydown', (e) => {
    if (e.key === pc.KEY_B) {
        spawnCube();
    } else if (e.key === pc.KEY_R) {
        resetScene();
    }
});

if (app.xr.supported) {
    // xr availability
    document
        .querySelector('.container > .button[data-xr="immersive-ar"]')
        ?.classList.toggle('active', app.xr.isAvailable(pc.XRTYPE_AR));
    document
        .querySelector('.container > .button[data-xr="immersive-vr"]')
        ?.classList.toggle('active', app.xr.isAvailable(pc.XRTYPE_VR));

    // xr availability events
    app.xr.on('available', (type, available) => {
        const element = document.querySelector(`.container > .button[data-xr="${type}"]`);
        element?.classList.toggle('active', available);
    });

    // button handler - fires events that xrsession listens to
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

    // button clicks
    document.querySelectorAll('.container > .button').forEach((button) => {
        button.addEventListener('click', onXrButtonClick);
    });

    message('In XR, open your left palm toward your face to show the menu');
} else {
    message('WebXR is not supported');
}

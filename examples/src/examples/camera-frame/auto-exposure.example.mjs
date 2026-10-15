// @config
//
// `WASD` Move · `Space` Jump · `Mouse` Look
//
// @credit
// title: De Dust 2 with Real Light
// author: Sketchfab
// source: https://sketchfab.com/3d-models/de-dust-2-with-real-light-4ce74cd95c584ce9b12b5ed9dc418db5
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    AutoExposureEffect,
    CameraComponentSystem,
    CameraFrame,
    CollisionComponentSystem,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    GamePads,
    Keyboard,
    LightComponentSystem,
    Mouse,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RigidBodyComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES2,
    TextureHandler,
    TouchDevice,
    Vec3,
    WasmModule,
    createGraphicsDevice
} from 'playcanvas';
import { FirstPersonController } from 'playcanvas/scripts/esm/first-person-controller.mjs';

import { data, deviceType } from 'examples/context';

/**
 * @import { RenderComponent } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

WasmModule.setConfig('Ammo', {
    glueUrl: './assets/wasm/ammo/ammo.wasm.js',
    wasmUrl: './assets/wasm/ammo/ammo.wasm.wasm',
    fallbackUrl: './assets/wasm/ammo/ammo.js'
});

await new Promise((resolve) => {
    WasmModule.getInstance('Ammo', () => resolve(true));
});

const assets = {
    map: new Asset('map', 'container', { url: './assets/models/fps-map.glb' }),
    morning: new Asset(
        'morning-env-atlas',
        'texture',
        { url: './assets/cubemaps/morning-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType],

    // the scene is rendered to an antialiased texture, so the canvas needs none
    antialias: false
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.gamepads = new GamePads();
createOptions.keyboard = new Keyboard(window);
createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    CollisionComponentSystem,
    RigidBodyComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler];

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

// a sunny sky, with the clipped sun boosted so that it is far brighter than the rest of it
app.scene.skyboxMip = 0;
app.scene.exposure = 0.4;
app.scene.skyboxHighlightMultiplier = 50;
app.scene.envAtlas = assets.morning.resource;
app.scene.skyboxRotation = new Quat().setFromEulerAngles(0, 10, 0);

// Gravity (increase for more realistic jumping)
app.systems.rigidbody?.gravity.set(0, -18, 0);

// Camera
const camera = new Entity();
camera.addComponent('camera', {
    farClip: 100,
    fov: 90
});
camera.setLocalPosition(0, 0.5, 0);

// the camera frame, rendering in HDR with a bloom on the bright sky
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.samples = 4;
cameraFrame.bloom.intensity = 0.01;
cameraFrame.vignette.intensity = 0.4;
cameraFrame.vignette.inner = 0.6;
cameraFrame.vignette.outer = 1.2;

// the auto exposure, which is not part of the camera frame by default - walk from the sunlit
// courtyards into the dark tunnels between them, and the exposure adapts, faster to the light than
// to the dark
const autoExposure = new AutoExposureEffect(app.graphicsDevice);
cameraFrame.addEffect(autoExposure);
cameraFrame.update();

// the level, with its lighting baked in, and a mesh collision to walk on
const map = assets.map.resource.instantiateRenderEntity();
map.setLocalScale(2, 2, 2);
map.setLocalEulerAngles(-90, 0, 0);
map.findComponents('render').forEach((/** @type {RenderComponent} */ render) => {
    const entity = render.entity;
    entity.addComponent('rigidbody', {
        type: 'static'
    });
    entity.addComponent('collision', {
        type: 'mesh',
        renderAsset: render.asset
    });
});
const level = new Entity();
level.addChild(map);
app.root.addChild(level);

// Character controller
const characterController = new Entity('cc');
characterController.setPosition(5, 2, 10);
characterController.addChild(camera);
characterController.addComponent('collision', {
    type: 'capsule',
    radius: 0.5,
    height: 2
});
characterController.addComponent('rigidbody', {
    type: 'dynamic',
    mass: 100,
    linearDamping: 0,
    angularDamping: 0,
    linearFactor: Vec3.ONE,
    angularFactor: Vec3.ZERO,
    friction: 0.5,
    restitution: 0
});
characterController.addComponent('script');
const fpc = /** @type {FirstPersonController} */ (
    characterController.script.create(FirstPersonController, {
        properties: {
            camera,
            jumpForce: 850
        }
    })
);
app.root.addChild(characterController);

/**
 * @param {string} side - The name.
 * @param {number} baseSize - The base size.
 * @param {number} stickSize - The stick size.
 */
const createJoystickUI = (side, baseSize = 100, stickSize = 60) => {
    const base = document.createElement('div');
    Object.assign(base.style, {
        display: 'none',
        position: 'absolute',
        width: `${baseSize}px`,
        height: `${baseSize}px`,
        borderRadius: '50%',
        backgroundColor: 'rgba(50, 50, 50, 0.5)',
        boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.5)'
    });

    const stick = document.createElement('div');
    Object.assign(stick.style, {
        display: 'none',
        position: 'absolute',
        width: `${stickSize}px`,
        height: `${stickSize}px`,
        borderRadius: '50%',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        boxShadow: 'inset 0 0 10px rgba(0, 0, 0, 0.5)'
    });

    /**
     * @param {HTMLElement} el - The element to set position for.
     * @param {number} size - The size of the element.
     * @param {number} x - The x position.
     * @param {number} y - The y position.
     */
    const show = (el, size, x, y) => {
        el.style.display = 'block';
        el.style.left = `${x - size * 0.5}px`;
        el.style.top = `${y - size * 0.5}px`;
    };

    /**
     * @param {HTMLElement} el - The element to hide.
     */
    const hide = (el) => {
        el.style.display = 'none';
    };

    app.on(`${fpc.joystickEventName}:${side}`, (bx, by, sx, sy) => {
        if (bx < 0 || by < 0 || sx < 0 || sy < 0) {
            hide(base);
            hide(stick);
            return;
        }

        show(base, baseSize, bx, by);
        show(stick, stickSize, sx, sy);
    });

    document.body.append(base, stick);
};

// Create joystick UI
createJoystickUI('left');
createJoystickUI('right');

// the exposure the camera renders with, relative to the exposure of the scene, shown in the controls
let readoutTime = 0;
app.on('update', (/** @type {number} */ dt) => {
    readoutTime += dt;
    if (readoutTime > 0.1) {
        readoutTime = 0;
        const ev = Math.log2(autoExposure.exposure / app.scene.exposure);
        data.set('data.readout', autoExposure.active ? `${ev >= 0 ? '+' : ''}${ev.toFixed(2)} EV` : 'off');
    }
});

// apply the settings from the controls
const apply = () => {
    cameraFrame.rendering.toneMapping = data.get('data.toneMapping');
    autoExposure.enabled = data.get('data.enabled');
    autoExposure.compensation = data.get('data.compensation');
    autoExposure.minEv = data.get('data.minEv');
    autoExposure.maxEv = data.get('data.maxEv');
    autoExposure.speedDarkToLight = data.get('data.speedDarkToLight');
    autoExposure.speedLightToDark = data.get('data.speedLightToDark');
    autoExposure.lowPercent = data.get('data.lowPercent');
    autoExposure.highPercent = data.get('data.highPercent');
    autoExposure.centerWeight = data.get('data.centerWeight');
    cameraFrame.debug = data.get('data.histogram') ? 'autoexposure' : null;
    cameraFrame.update();
};

data.on('*:set', (/** @type {string} */ path) => {
    if (path.startsWith('data.') && path !== 'data.readout') {
        apply();
    }
});

data.set('data', {
    toneMapping: TONEMAP_ACES2,
    enabled: true,
    compensation: 0.2,
    minEv: -6.9,
    maxEv: 4,
    speedDarkToLight: 3,
    speedLightToDark: 1,
    lowPercent: 0.5,
    highPercent: 0.95,
    centerWeight: 0.45,
    histogram: false,
    readout: ''
});

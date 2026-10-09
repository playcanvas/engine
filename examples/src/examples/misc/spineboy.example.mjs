// @config
//
// A skeletal animation made with the {accent:Spine} 4.3 editor, played by the
// [playcanvas-spine](https://github.com/playcanvas/playcanvas-spine) plugin. Spineboy aims at the
// pointer using an IK constraint, and smoothly mixes between animations. Click to shoot.
//
// @credit
// title: Spineboy
// author: Esoteric Software
// source: https://esotericsoftware.com/
// license: (c) 2013 Esoteric Software, non-commercial use only

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    JsonHandler,
    PROJECTION_ORTHOGRAPHIC,
    RESOLUTION_AUTO,
    ScriptComponentSystem,
    ScriptHandler,
    TextHandler,
    TextureHandler,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    skeleton: new Asset('skeleton', 'json', { url: './assets/spine/spineboy-pro.json' }),
    atlas: new Asset('atlas', 'text', { url: './assets/spine/spineboy-pma.atlas' }),
    // the texture asset name has to match the page name in the atlas, and as Spine 4.3 renders in
    // gamma space, the texture is loaded without sRGB
    texture: new Asset('spineboy-pma.png', 'texture', { url: './assets/spine/spineboy-pma.png' }, { srgb: false }),
    spinescript: new Asset('spinescript', 'script', {
        url: './scripts/spine/playcanvas-spine.4.3.js'
    })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [CameraComponentSystem, ScriptComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ScriptHandler, JsonHandler, TextHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);

// the plugin adds the spine component system to the application when it loads
await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// an orthographic camera, framing Spineboy at any aspect ratio
const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(0.17, 0.19, 0.25),
    projection: PROJECTION_ORTHOGRAPHIC
});
camera.setLocalPosition(0.6, 3.4, 10);
app.root.addChild(camera);

const fitCamera = () => {
    const aspect = app.graphicsDevice.width / app.graphicsDevice.height;
    camera.camera.orthoHeight = Math.max(4.6, 4.4 / aspect);
};
fitCamera();
app.graphicsDevice.on('resizecanvas', fitCamera);

// Spineboy, at the origin and unscaled, so the skeleton coordinates match the world coordinates
const spineboy = new Entity('spineboy');
spineboy.addComponent('spine', {
    atlasAsset: assets.atlas.id,
    skeletonAsset: assets.skeleton.id,
    textureAssets: [assets.texture.id]
});
app.root.addChild(spineboy);

// the spine component comes from the plugin, which has no type information
const { skeleton, state } = /** @type {any} */ (spineboy).spine;

// mix between animations when they change
state.data.defaultMix = 0.2;

// track 0 plays the selected animation, track 1 aims at the crosshair bone and track 2 shoots
const setAim = (/** @type {boolean} */ aim) => {
    if (aim) {
        state.setAnimation(1, 'aim', true);
    } else {
        state.setEmptyAnimation(1, 0.2);
    }
};

data.set('spine', {
    animation: 'run',
    aim: true,
    speed: 1
});
state.setAnimation(0, data.get('spine.animation'), true);
setAim(data.get('spine.aim'));

const dataEvent = data.on('*:set', (/** @type {string} */ path, /** @type {any} */ value) => {
    if (path === 'spine.animation') {
        state.setAnimation(0, value, true);
    } else if (path === 'spine.aim') {
        setAim(value);
    } else if (path === 'spine.speed') {
        state.timeScale = value;
    }
});

// move the crosshair bone, which the aim animation points the gun at, to the pointer
const crosshair = skeleton.findBone('crosshair');
const pointer = new Vec3();
const onPointerMove = (/** @type {PointerEvent} */ event) => {
    const rect = canvas.getBoundingClientRect();
    camera.camera.screenToWorld(event.clientX - rect.left, event.clientY - rect.top, 10, pointer);
    const position = crosshair.getAppliedPose().worldToParent({ x: pointer.x, y: pointer.y });
    const pose = crosshair.getPose();
    pose.x = position.x;
    pose.y = position.y;
};

const onPointerDown = (/** @type {PointerEvent} */ event) => {
    onPointerMove(event);
    state.setAnimation(2, 'shoot', false);
    state.addEmptyAnimation(2, 0.2, 0);
};

canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerdown', onPointerDown);

app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerdown', onPointerDown);
    dataEvent.unbind();
});

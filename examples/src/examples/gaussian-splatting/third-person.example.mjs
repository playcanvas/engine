// @config
//
// `WASD` Move · `Shift` Sprint · `Space` Jump · `Q` Dance · `Mouse` Orbit camera · `Wheel` Zoom
//
// @credit
// title: Sunnyvale Heritage Park Museum
// author: zeitgeistarchivescans
// source: https://superspl.at/scene/d5d397aa
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import * as pc from 'playcanvas';
import { ShadowCatcher } from 'playcanvas/scripts/esm/shadow-catcher.mjs';
import { ThirdPersonController } from 'playcanvas/scripts/esm/third-person-controller.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

pc.WasmModule.setConfig('Ammo', {
    glueUrl: './assets/wasm/ammo/ammo.wasm.js',
    wasmUrl: './assets/wasm/ammo/ammo.wasm.wasm',
    fallbackUrl: './assets/wasm/ammo/ammo.js'
});

// the collision GLB uses Draco-compressed meshes, so the Draco decoder is required
pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

await Promise.all([
    new Promise((resolve) => {
        pc.WasmModule.getInstance('Ammo', () => resolve(true));
    }),
    new Promise((resolve) => {
        pc.WasmModule.getInstance('DracoDecoderModule', () => resolve(true));
    })
]);

const gfxOptions = {
    deviceTypes: [deviceType],

    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.gamepads = new pc.GamePads();
createOptions.keyboard = new pc.Keyboard(window);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.AnimComponentSystem,
    pc.CollisionComponentSystem,
    pc.RigidBodyComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.ScriptHandler,
    pc.AnimClipHandler,
    pc.AnimStateGraphHandler,
    pc.GSplatHandler
];

const app = new pc.AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assets = {
    splat: new pc.Asset('sunnyvale-splat', 'gsplat', { url: 'https://s3.eu-west-1.amazonaws.com/code.playcanvas.com/examples_data/example_sunnyvale/sunnyvale.sog' }),
    collision: new pc.Asset('sunnyvale-collision', 'container', { url: 'https://s3.eu-west-1.amazonaws.com/code.playcanvas.com/examples_data/example_sunnyvale/sunnyvale.glb' }),
    character: new pc.Asset('character', 'container', { url: './assets/models/bitmoji.glb' }),
    idleAnim: new pc.Asset('idleAnim', 'container', { url: './assets/animations/bitmoji/idle.glb' }),
    walkAnim: new pc.Asset('walkAnim', 'container', { url: './assets/animations/bitmoji/walk.glb' }),
    jogAnim: new pc.Asset('jogAnim', 'container', { url: './assets/animations/bitmoji/run.glb' }),
    jumpAnim: new pc.Asset('jumpAnim', 'container', { url: './assets/animations/bitmoji/jump-flip.glb' }),
    danceAnim: new pc.Asset('danceAnim', 'container', { url: './assets/animations/bitmoji/win-dance.glb' }),
    envAtlas: new pc.Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/morning-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

await new Promise((resolve) => {
    new pc.AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Use the env atlas for image-based lighting only (the character will be lit
// by it as a soft ambient). Disable the visible Skybox layer so the actual
// skydome geometry is never drawn - the camera's clear color remains the
// visible background.
app.scene.envAtlas = assets.envAtlas.resource;
app.scene.skyboxIntensity = 0.5;
app.scene.layers.getLayerById(pc.LAYERID_SKYBOX).enabled = false;

// Initial control values
data.set('renderer', pc.GSPLAT_RENDERER_AUTO);
data.set('splatBudget', 4);
data.set('cameraDistance', 5);
data.set('cameraHeight', 1.2);
data.set('cameraSmoothing', 0.0005);
data.set('lookSens', 0.15);
data.set('data.stats.gsplats', '—');
data.set('data.stats.resolution', '—');

data.on('renderer:set', () => {
    app.scene.gsplat.renderer = data.get('renderer');
    const current = app.scene.gsplat.currentRenderer;
    if (current !== data.get('renderer')) {
        setTimeout(() => data.set('renderer', current), 0);
    }
});

const applySplatBudget = () => {
    const millions = data.get('splatBudget');
    app.scene.gsplat.splatBudget = Math.round(millions * 1000000);
};
applySplatBudget();
data.on('splatBudget:set', applySplatBudget);

// Gravity
app.systems.rigidbody?.gravity.set(0, -10, 0);

// Directional light - both lights the character and feeds the shadow catcher
const light = new pc.Entity('light');
light.addComponent('light', {
    type: 'directional',
    color: new pc.Color(1, 1, 1),
    castShadows: true,
    intensity: 2,
    shadowBias: 0.2,
    shadowDistance: 50,
    normalOffsetBias: 0.05,
    shadowResolution: 2048,
    shadowIntensity: 0.65
});
light.setLocalEulerAngles(60, -20, 0);
app.root.addChild(light);

// Shadow catcher: a transparent plane that receives the character's shadow
// from the directional light, multiplied onto the gsplat ground behind it.
// It lives at the world root and is repositioned each frame to follow the
// character on the ground (raycast down to find ground Y).
const shadowCatcher = new pc.Entity('shadow-catcher');
shadowCatcher.addComponent('script').create(ShadowCatcher, {
    properties: {
        scale: new pc.Vec3(12, 12, 12),
        // drawBucket 0 makes the catcher render AFTER the gsplat ground so
        // its shadow can darken the gsplat
        drawBucket: 0
    }
});

// Camera (standalone - not parented to the character; positioned by the controller)
const camera = new pc.Entity('camera');
camera.addComponent('camera', {
    clearColor: new pc.Color(0.1, 0.1, 0.1),
    farClip: 1000,
    fov: 60,
    toneMapping: pc.TONEMAP_LINEAR
});
app.root.addChild(camera);

// Parent that holds both the splat and the collision mesh, keeping them aligned.
// The splat data is authored upside-down relative to PlayCanvas's Y-up convention,
// so a 180° rotation around Z flips both the visual and the collision together.
const sceneRoot = new pc.Entity('sunnyvale');
sceneRoot.setLocalEulerAngles(0, 0, 180);
app.root.addChild(sceneRoot);

const splat = new pc.Entity('sunnyvale-gsplat');
splat.addComponent('gsplat', {
    asset: assets.splat
});
sceneRoot.addChild(splat);

const collisionRoot = assets.collision.resource.instantiateRenderEntity();
collisionRoot.findComponents('render').forEach((/** @type {pc.RenderComponent} */ render) => {
    const entity = render.entity;
    entity.addComponent('rigidbody', {
        type: 'static',
        friction: 0.5,
        restitution: 0
    });
    entity.addComponent('collision', {
        type: 'mesh',
        renderAsset: render.asset
    });
    render.enabled = false;
});
sceneRoot.addChild(collisionRoot);

// ---- Character ----
// The third-person controller acts on `characterController` (capsule + dynamic
// rigidbody). The visible bitmoji mesh is a child entity (`characterModel`) so
// the controller can rotate it independently from the capsule.
const characterController = new pc.Entity('character-controller');
characterController.setPosition(0, 1.2, 0);
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
    linearFactor: pc.Vec3.ONE,
    angularFactor: pc.Vec3.ZERO,
    friction: 0.5,
    restitution: 0
});
app.root.addChild(characterController);

// Shadow catcher lives at the world root and is repositioned each frame to
// follow the character horizontally while staying glued to the ground (raycast
// down from above the character to find ground Y). This keeps the shadow on
// the ground when the character jumps rather than rising with them.
app.root.addChild(shadowCatcher);

const _scRayStart = new pc.Vec3();
const _scRayEnd = new pc.Vec3();
const _scPos = new pc.Vec3();
let _scLastY = 0;
// Exclude the character's own collision so the raycast always hits actual
// ground geometry, never the character's capsule.
const _scRayOpts = {
    filterCallback: (/** @type {pc.Entity} */ entity) => entity !== characterController
};
const updateShadowCatcher = () => {
    const cp = characterController.getPosition();
    // Start the ray AT the character (not above) so we never hit roofs,
    // overhangs or any geometry that lives between the character and the sky.
    // The filterCallback below skips the character's own capsule, so starting
    // inside it is safe and always finds the ground below.
    _scRayStart.set(cp.x, cp.y, cp.z);
    _scRayEnd.set(cp.x, cp.y - 100, cp.z);
    const hit = app.systems.rigidbody?.raycastFirst(_scRayStart, _scRayEnd, _scRayOpts);
    const groundY = hit ? hit.point.y : _scLastY;
    _scLastY = groundY;
    _scPos.set(cp.x, groundY + 0.01, cp.z);
    shadowCatcher.setPosition(_scPos);
};

// Visible character (rotated by the controller). The bitmoji model's pivot is
// at the feet, so offset down by half capsule height (1.0) to align feet with
// the bottom of the capsule.
const characterModel = new pc.Entity('character-model');
characterModel.setLocalPosition(0, -1, 0);
characterModel.setLocalScale(1.5, 1.5, 1.5);
characterController.addChild(characterModel);

const characterRender = assets.character.resource.instantiateRenderEntity({
    castShadows: true
});
characterModel.addChild(characterRender);

// Anim state graph (same shape as the locomotion example: idle/walk/jog/jump
// driven by an integer `speed` parameter and a `jump` trigger).
characterModel.addComponent('anim', { activate: true });
characterModel.anim.loadStateGraph({
    layers: [
        {
            name: 'locomotion',
            states: [
                { name: 'START' },
                { name: 'Idle', speed: 1 },
                { name: 'Walk', speed: 1 },
                { name: 'Jog', speed: 1 },
                { name: 'Jump', speed: 1 },
                { name: 'Dance', speed: 1 },
                { name: 'END' }
            ],
            transitions: [
                { from: 'START', to: 'Idle', time: 0, priority: 0 },
                {
                    from: 'Idle',
                    to: 'Walk',
                    time: 0.1,
                    priority: 0,
                    conditions: [{ parameterName: 'speed', predicate: pc.ANIM_GREATER_THAN, value: 0 }]
                },
                {
                    from: 'Walk',
                    to: 'Idle',
                    time: 0.1,
                    priority: 0,
                    conditions: [{ parameterName: 'speed', predicate: pc.ANIM_LESS_THAN_EQUAL_TO, value: 0 }]
                },
                {
                    from: 'Walk',
                    to: 'Jog',
                    time: 0.1,
                    priority: 0,
                    conditions: [{ parameterName: 'speed', predicate: pc.ANIM_GREATER_THAN, value: 1 }]
                },
                {
                    from: 'Jog',
                    to: 'Walk',
                    time: 0.1,
                    priority: 0,
                    conditions: [{ parameterName: 'speed', predicate: pc.ANIM_LESS_THAN, value: 2 }]
                },
                {
                    from: 'ANY',
                    to: 'Jump',
                    time: 0.1,
                    priority: 0,
                    conditions: [{ parameterName: 'jump', predicate: pc.ANIM_EQUAL_TO, value: true }]
                },
                { from: 'Jump', to: 'Idle', time: 0.2, priority: 0, exitTime: 0.8 },
                { from: 'Jump', to: 'Walk', time: 0.2, priority: 0, exitTime: 0.8 },
                {
                    from: 'ANY',
                    to: 'Dance',
                    time: 0.2,
                    priority: 0,
                    conditions: [{ parameterName: 'dance', predicate: pc.ANIM_EQUAL_TO, value: true }]
                },
                // exit dance as soon as the player starts moving again
                {
                    from: 'Dance',
                    to: 'Walk',
                    time: 0.2,
                    priority: 0,
                    conditions: [{ parameterName: 'speed', predicate: pc.ANIM_GREATER_THAN, value: 0 }]
                }
            ]
        }
    ],
    parameters: {
        speed: { name: 'speed', type: pc.ANIM_PARAMETER_INTEGER, value: 0 },
        jump: { name: 'jump', type: pc.ANIM_PARAMETER_TRIGGER, value: false },
        dance: { name: 'dance', type: pc.ANIM_PARAMETER_TRIGGER, value: false }
    }
});

const layer = characterModel.anim.baseLayer;
layer.assignAnimation('Idle', assets.idleAnim.resource.animations[0].resource);
layer.assignAnimation('Walk', assets.walkAnim.resource.animations[0].resource);
layer.assignAnimation('Jog', assets.jogAnim.resource.animations[0].resource);
layer.assignAnimation('Jump', assets.jumpAnim.resource.animations[0].resource);
layer.assignAnimation('Dance', assets.danceAnim.resource.animations[0].resource);

// Wire the third-person controller
characterController.addComponent('script');
const tpc = /** @type {ThirdPersonController} */ (characterController.script.create(ThirdPersonController, {
    properties: {
        camera,
        characterModel,
        jumpForce: 420,
        speedGround: 65,
        sprintMult: 1.73,
        cameraDistance: data.get('cameraDistance'),
        cameraHeight: data.get('cameraHeight'),
        cameraPositionDamping: data.get('cameraSmoothing'),
        lookSens: data.get('lookSens'),
        invertLookY: true,
        initialPitch: 17,
        walkSpeedThreshold: 0.5,
        jogSpeedThreshold: 4
    }
}));

// Drive animation parameters from controller events
tpc.on('speed', (/** @type {number} */ bucket) => {
    characterModel.anim.setInteger('speed', bucket);
});
tpc.on('jump', () => {
    if (characterModel.anim.baseLayer.activeState !== 'Jump') {
        characterModel.anim.setTrigger('jump');
    }
});

// Q triggers the dance animation. It exits as soon as the player moves again
// (via the `speed > 0` transition in the state graph).
app.keyboard.on(pc.EVENT_KEYDOWN, (/** @type {pc.KeyboardEvent} */ evt) => {
    if (evt.key === pc.KEY_Q) {
        characterModel.anim.setTrigger('dance');
    }
});

// Hook controls
data.on('cameraDistance:set', () => {
    tpc.cameraDistance = data.get('cameraDistance');
});
data.on('cameraHeight:set', () => {
    tpc.cameraHeight = data.get('cameraHeight');
});
data.on('cameraSmoothing:set', () => {
    tpc.cameraPositionDamping = data.get('cameraSmoothing');
});
data.on('lookSens:set', () => {
    tpc.lookSens = data.get('lookSens');
});

// Stats + shadow catcher follow
app.on('update', () => {
    updateShadowCatcher();

    data.set('data.stats.gsplats', app.stats.frame.gsplats.toLocaleString());
    const bb = app.graphicsDevice.backBufferSize;
    data.set('data.stats.resolution', `${bb.x} x ${bb.y}`);
});

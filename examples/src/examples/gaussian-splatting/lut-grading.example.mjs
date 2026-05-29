// @config
//
// Pick two LUTs and use Blend to crossfade between them, or enable Animate.
//
// `WASD` Move · `Space` Jump · `Mouse` Look
//
// @credit
// title: Sunnyvale Heritage Park Museum
// author: zeitgeistarchivescans
// source: https://superspl.at/scene/d5d397aa
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import * as pc from 'playcanvas';
import { FirstPersonController } from 'playcanvas/scripts/esm/first-person-controller.mjs';

import { data, deviceType } from 'examples/context';

// Color LUTs in examples/assets/cube-luts/ (256×16 Unreal-style horizontal strip).
// Rows: [key, label]. Textures are lut-{key}.png except key 'none'.
/** @type {[string, string][]} */
const LUT_TABLE = [
    ['none', 'None'],
    ['neutral', 'Neutral'],
    ['cherry', 'Cherry'],
    ['blue', 'Blue'],
    ['negative', 'Negative'],
    ['bw', 'BW'],
    ['burgas', 'Burgas'],
    ['fall-colors', 'Fall Colors'],
    ['late-sunset', 'Late Sunset'],
    ['moonlight', 'Moonlight'],
    ['sofia', 'Sofia'],
    ['teal-orange', 'Teal Orange']
];

/** @type {Array<{ key: string, label: string, file: string | null }>} */
const LUT_CATALOG = LUT_TABLE.map(([key, label]) => ({
    key,
    label,
    file: key === 'none' ? null : `lut-${key}.png`
}));

data.set('lutSelectOptions', LUT_CATALOG.map(({ key, label }) => ({
    v: key,
    t: label
})));

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
    pc.CollisionComponentSystem,
    pc.RigidBodyComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.ScriptHandler,
    pc.GSplatHandler
];

const app = new pc.AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// 3D LUTs are 2D "horizontal strip" textures in Unreal-format (an unwrapped 3D LUT).
// They must be loaded with srgb:true (they are sRGB-encoded), mipmaps:false (sampled at
// LOD 0 only) and linear filtering (avoids banding between LUT entries).
const lutAssetOptions = {
    srgb: true,
    mipmaps: false,
    minfilter: 'linear'
};

const lutBaseUrl = './assets/cube-luts';

/** @type {Record<string, pc.Asset>} */
const lutAssets = {};
for (const { key, file } of LUT_CATALOG) {
    if (!file) {
        continue;
    }
    lutAssets[key] = new pc.Asset(`lut-${key}`, 'texture',
        { url: `${lutBaseUrl}/${file}` }, lutAssetOptions);
}

const assets = {
    splat: new pc.Asset('sunnyvale-splat', 'gsplat', { url: 'https://s3.eu-west-1.amazonaws.com/code.playcanvas.com/examples_data/example_sunnyvale/sunnyvale.sog' }),
    collision: new pc.Asset('sunnyvale-collision', 'container', { url: 'https://s3.eu-west-1.amazonaws.com/code.playcanvas.com/examples_data/example_sunnyvale/sunnyvale.glb' }),
    ...lutAssets
};

await new Promise((resolve) => {
    new pc.AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Initial control values
data.set('renderer', pc.GSPLAT_RENDERER_AUTO);
data.set('splatBudget', 4);
data.set('lut', 'bw');
data.set('lut2', 'blue');
data.set('lutIntensity', 1.0);
data.set('lutIntensity2', 1.0);
data.set('lutBlend', 0.0);
data.set('lutAnimate', true);
data.set('data.stats.gsplats', '—');
data.set('data.stats.resolution', '—');

// Renderer selection
data.on('renderer:set', () => {
    app.scene.gsplat.renderer = data.get('renderer');
    const current = app.scene.gsplat.currentRenderer;
    if (current !== data.get('renderer')) {
        setTimeout(() => data.set('renderer', current), 0);
    }
});

// Splat budget (in millions)
const applySplatBudget = () => {
    const millions = data.get('splatBudget');
    app.scene.gsplat.splatBudget = Math.round(millions * 1000000);
};
applySplatBudget();
data.on('splatBudget:set', applySplatBudget);

// Gravity
app.systems.rigidbody?.gravity.set(0, -10, 0);

// Camera (attached to the character controller below)
const camera = new pc.Entity('camera');
camera.addComponent('camera', {
    clearColor: new pc.Color(0.1, 0.1, 0.1),
    farClip: 1000,
    fov: 75,
    toneMapping: pc.TONEMAP_LINEAR
});
camera.setLocalPosition(0, 0.9, 0);

// CameraFrame post-processing pipeline. Linear tonemap is the identity on values in [0,1]
// which lets gaussian splat colors (already display-ready) pass through unchanged so the
// LUT is the only thing modifying the final look.
const cameraFrame = new pc.CameraFrame(app, camera.camera);
cameraFrame.rendering.toneMapping = pc.TONEMAP_LINEAR;
cameraFrame.update();

/** @type {Record<string, pc.Texture | null>} */
const lutTextures = { none: null };
for (const { key, file } of LUT_CATALOG) {
    if (file) {
        lutTextures[key] = lutAssets[key].resource;
    }
}

const applyLut = () => {
    const lut = cameraFrame.colorLUT;
    lut.texture = lutTextures[data.get('lut')];
    lut.texture2 = lutTextures[data.get('lut2')];
    lut.intensity = data.get('lutIntensity');
    lut.intensity2 = data.get('lutIntensity2');
    lut.blend = data.get('lutBlend');
    cameraFrame.update();
};
applyLut();
data.on('lut:set', applyLut);
data.on('lut2:set', applyLut);
data.on('lutIntensity:set', applyLut);
data.on('lutIntensity2:set', applyLut);
data.on('lutBlend:set', applyLut);

// Animate mode cycles between random LUTs in slot 2 every 3 s
// (1.5 s hold on the current look, 1.5 s crossfade to the next). When a crossfade
// completes, slot 2 becomes the new slot 1 and a fresh random LUT is picked for slot 2.
const animatableKeys = LUT_CATALOG.filter(({ file }) => file !== null).map(({ key }) => key);
const HOLD_SECONDS = 1.5;
const CROSSFADE_SECONDS = 1.5;
const CYCLE_SECONDS = HOLD_SECONDS + CROSSFADE_SECONDS;
const randomKey = (excludeKey) => {
    const choices = animatableKeys.filter(k => k !== excludeKey);
    return choices[Math.floor(Math.random() * choices.length)];
};
let animClock = 0;
const startLutAnimate = () => {
    animClock = 0;
    const startKey = data.get('lut');
    data.set('lut2', randomKey(startKey));
    data.set('lutIntensity', 1);
    data.set('lutIntensity2', 1);
    data.set('lutBlend', 0);
};
data.on('lutAnimate:set', (value) => {
    if (value) {
        startLutAnimate();
    }
});
startLutAnimate();

// Parent that holds both the splat and the collision mesh, keeping them aligned.
// The splat data is authored upside-down relative to PlayCanvas's Y-up convention,
// so a 180° rotation around Z flips both the visual and the collision together.
const sceneRoot = new pc.Entity('sunnyvale');
sceneRoot.setLocalEulerAngles(0, 0, 180);
app.root.addChild(sceneRoot);

// Gaussian splat (visual)
const splat = new pc.Entity('sunnyvale-gsplat');
splat.addComponent('gsplat', {
    asset: assets.splat
});
sceneRoot.addChild(splat);

// Collision mesh instantiated from the GLB; attached to each render component as
// a static rigidbody using the actual triangle mesh. The mesh itself is hidden -
// it is only used for collision.
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

// First-person character controller
const characterController = new pc.Entity('character-controller');
characterController.setPosition(0, 2, 0);
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
    linearFactor: pc.Vec3.ONE,
    angularFactor: pc.Vec3.ZERO,
    friction: 0.5,
    restitution: 0
});
characterController.addComponent('script');
characterController.script.create(FirstPersonController, {
    properties: {
        camera,
        jumpForce: 420,
        speedGround: 65,
        sprintMult: 1.73
    }
});
app.root.addChild(characterController);

// Stats
app.on('update', (/** @type {number} */ dt) => {
    if (data.get('lutAnimate')) {
        animClock += dt;
        if (animClock >= CYCLE_SECONDS) {
            // crossfade complete: slot 2 becomes slot 1, pick a new slot 2
            animClock -= CYCLE_SECONDS;
            const newSlot1 = data.get('lut2');
            data.set('lut', newSlot1);
            data.set('lut2', randomKey(newSlot1));
            data.set('lutBlend', 0);
        } else if (animClock <= HOLD_SECONDS) {
            data.set('lutBlend', 0);
        } else {
            const t = (animClock - HOLD_SECONDS) / CROSSFADE_SECONDS;
            data.set('lutBlend', Math.min(1, t));
        }
    }

    data.set('data.stats.gsplats', app.stats.frame.gsplats.toLocaleString());
    const bb = app.graphicsDevice.backBufferSize;
    data.set('data.stats.resolution', `${bb.x} x ${bb.y}`);
});

export { app };

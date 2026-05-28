// @config
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

const assets = {
    splat: new pc.Asset('sunnyvale-splat', 'gsplat', { url: 'https://s3.eu-west-1.amazonaws.com/code.playcanvas.com/examples_data/example_sunnyvale/sunnyvale.sog' }),
    collision: new pc.Asset('sunnyvale-collision', 'container', { url: 'https://s3.eu-west-1.amazonaws.com/code.playcanvas.com/examples_data/example_sunnyvale/sunnyvale.glb' })
};

await new Promise((resolve) => {
    new pc.AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Initial control values
data.set('renderer', pc.GSPLAT_RENDERER_AUTO);
data.set('splatBudget', 4);
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
app.on('update', () => {
    data.set('data.stats.gsplats', app.stats.frame.gsplats.toLocaleString());
    const bb = app.graphicsDevice.backBufferSize;
    data.set('data.stats.resolution', `${bb.x} x ${bb.y}`);
});

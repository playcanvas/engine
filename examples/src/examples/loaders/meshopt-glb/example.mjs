// @config
//
// Loads a glb compressed with **meshopt** by `gltfpack -cc`. `meshoptInitialize` gives the engine
// the decoder, which unpacks the knight's mesh, skin and both animations when the glb loads.

import {
    AnimComponentSystem,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    TextureHandler,
    createGraphicsDevice,
    meshoptInitialize
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// The knight's meshes and animations use EXT_meshopt_compression, so give the engine the decoder
meshoptInitialize({ url: './assets/wasm/meshopt/meshopt_decoder.mjs' });

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    AnimComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

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

// Compressed with gltfpack -cc, which also quantizes the vertex data with KHR_mesh_quantization
const assets = {
    knight: new Asset('knight', 'container', { url: './assets/models/knight-meshopt.glb' })
};

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

app.scene.ambientLight = new Color(0.45, 0.47, 0.55);

// The decoded model loads like any other, with its skin and animations
const knight = assets.knight.resource.instantiateRenderEntity();
const [idleClip, attackClip] = ['Idle_FightingStance', 'Attack_SwordThrust'].map(
    (name) => assets.knight.resource.animations.find((asset) => asset.resource.name === name).resource
);
knight.addComponent('anim', { activate: true });
knight.anim.assignAnimation('Idle', idleClip);
knight.anim.assignAnimation('Attack', attackClip, undefined, 1, false);
app.root.addChild(knight);

const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(0.2, 0.2, 0.2)
});
camera.setPosition(0, 1.1, 4);
camera.lookAt(0, 0.9, 0);
app.root.addChild(camera);

const light = new Entity('light');
light.addComponent('light', {
    type: 'directional',
    intensity: 1.2
});
light.setLocalEulerAngles(40, 30, 0);
app.root.addChild(light);

// Turn the knight slowly, and thrust the sword every few seconds
let attackIn = 2;
let idleIn = 0;
app.on('update', (dt) => {
    knight.rotateLocal(0, dt * 20, 0);
    attackIn -= dt;
    if (attackIn <= 0) {
        attackIn = 4;
        idleIn = attackClip.duration;
        knight.anim.baseLayer.transition('Attack', 0.2);
    }
    if (idleIn > 0) {
        idleIn -= dt;
        if (idleIn <= 0) {
            knight.anim.baseLayer.transition('Idle', 0.3);
        }
    }
});

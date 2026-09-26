// @config
// @flag NO_INSPECTOR
//
// An inspector for the running app, implemented entirely as a script. Browse the entity hierarchy,
// the frame graph of the last frame, the render targets on the device and the physics bodies, with
// the Ammo world drawn over the scene. Toggle entities on and off, watch the properties of the
// selected item update live, pause and single-step the app, and pop the panel out into its own
// window. Toggle the panel with the backquote key, pause with F9 and step with F10.

import {
    AnimClipHandler,
    AnimComponentSystem,
    AnimStateGraphHandler,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    CameraFrame,
    CollisionComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    Inspector,
    Keyboard,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RigidBodyComponentSystem,
    ScriptComponentSystem,
    StandardMaterial,
    TONEMAP_NEUTRAL,
    TextureHandler,
    Vec3,
    WasmModule,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { Rotator } from 'examples/assets/scripts/misc/rotator.mjs';
import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// load Ammo first: the physics tab of the inspector draws its world and lists its bodies
WasmModule.setConfig('Ammo', {
    glueUrl: './assets/wasm/ammo/ammo.wasm.js',
    wasmUrl: './assets/wasm/ammo/ammo.wasm.wasm',
    fallbackUrl: './assets/wasm/ammo/ammo.js'
});
await new Promise((resolve) => {
    WasmModule.getInstance('Ammo', () => resolve());
});

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.keyboard = new Keyboard(window);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    AnimComponentSystem,
    RigidBodyComponentSystem,
    CollisionComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, AnimClipHandler, AnimStateGraphHandler];

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

const assets = {
    character: new Asset('character', 'container', { url: './assets/models/bitmoji.glb' }),
    idle: new Asset('idle', 'container', { url: './assets/animations/bitmoji/idle.glb' })
};

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

/**
 * @param {string} name - The entity name.
 * @param {string} type - The primitive type.
 * @param {Color} color - The diffuse color.
 * @returns {Entity} The entity.
 */
const createPrimitive = (name, type, color) => {
    const material = new StandardMaterial();
    material.name = `${name} material`;
    material.diffuse = color;
    material.update();

    const entity = new Entity(name);
    entity.addComponent('render', { type, material, castShadows: true, receiveShadows: true });
    return entity;
};

// camera with orbit controls
const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(0.18, 0.2, 0.25),
    farClip: 100
});
camera.addComponent('script');
camera.setPosition(5, 3.5, 7);
app.root.addChild(camera);
const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
Object.assign(cameraControls, {
    focusPoint: new Vec3(0, 1, 0),
    sceneSize: 6,
    enableFly: false
});

// render through a camera frame: adds the scene pass, the bloom pyramid and the compose pass to the
// frame graph
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;
cameraFrame.bloom.intensity = 0.05;
cameraFrame.bloom.blurLevel = 5;
cameraFrame.update();

// lighting
const lights = new Entity('lights');
app.root.addChild(lights);

const sun = new Entity('sun');
sun.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.95, 0.85),
    intensity: 1.5,
    castShadows: true,
    shadowBias: 0.2,
    normalOffsetBias: 0.05,
    shadowDistance: 25,
    shadowResolution: 2048
});
sun.setEulerAngles(50, 30, 0);
lights.addChild(sun);

const pointLight = new Entity('point light');
pointLight.addComponent('light', {
    type: 'omni',
    color: new Color(1, 0.4, 0.2),
    intensity: 2,
    range: 6
});
pointLight.setPosition(-2.5, 2, 1.5);
lights.addChild(pointLight);

const spotLight = new Entity('spot light');
spotLight.addComponent('light', {
    type: 'spot',
    color: new Color(0.3, 0.6, 1),
    intensity: 4,
    range: 12,
    innerConeAngle: 20,
    outerConeAngle: 35,
    castShadows: true
});
spotLight.setPosition(3, 5, 2);
spotLight.setEulerAngles(-70, 30, 0);
lights.addChild(spotLight);

// scenery
const scenery = new Entity('scenery');
scenery.tags.add('static');
app.root.addChild(scenery);

const ground = createPrimitive('ground', 'plane', new Color(0.45, 0.47, 0.5));
ground.setLocalScale(14, 1, 14);
scenery.addChild(ground);
ground.addComponent('rigidbody', { type: 'static', restitution: 0.4 });
ground.addComponent('collision', { type: 'box', halfExtents: new Vec3(7, 0.5, 7), linearOffset: new Vec3(0, -0.5, 0) });

const crate = createPrimitive('crate', 'box', new Color(0.75, 0.55, 0.3));
crate.setPosition(-2, 0.5, -1);
crate.tags.add('prop');
scenery.addChild(crate);
crate.addComponent('rigidbody', { type: 'dynamic', mass: 10 });
crate.addComponent('collision', { type: 'box', halfExtents: new Vec3(0.5, 0.5, 0.5) });

const ball = createPrimitive('ball', 'sphere', new Color(0.3, 0.7, 0.4));
ball.setPosition(2.2, 0.5, 0.5);
ball.tags.add('prop');
scenery.addChild(ball);
ball.addComponent('rigidbody', { type: 'dynamic', mass: 5, restitution: 0.7 });
ball.addComponent('collision', { type: 'sphere', radius: 0.5 });

const pillar = createPrimitive('pillar', 'cylinder', new Color(0.6, 0.6, 0.7));
pillar.setPosition(0, 1, -3);
pillar.setLocalScale(0.6, 2, 0.6);
scenery.addChild(pillar);
pillar.addComponent('rigidbody', { type: 'dynamic', mass: 20 });
pillar.addComponent('collision', { type: 'cylinder', radius: 0.3, height: 2 });

// a small rotating hierarchy driven by a script, so transforms change every frame
const spinner = createPrimitive('spinner', 'box', new Color(0.9, 0.3, 0.3));
spinner.setPosition(2.5, 2.5, -2);
spinner.setLocalScale(0.6, 0.6, 0.6);
spinner.addComponent('script');
spinner.script.create(Rotator);
scenery.addChild(spinner);
spinner.addComponent('rigidbody', { type: 'kinematic' });
spinner.addComponent('collision', { type: 'box', halfExtents: new Vec3(0.3, 0.3, 0.3) });

const satellite = createPrimitive('satellite', 'sphere', new Color(0.95, 0.85, 0.3));
satellite.setLocalPosition(0, 1.5, 0);
satellite.setLocalScale(0.5, 0.5, 0.5);
spinner.addChild(satellite);

// a bright emissive core, so the bloom pass has something to glow
const satelliteMaterial = /** @type {StandardMaterial} */ (satellite.render.material);
satelliteMaterial.emissive = new Color(1, 0.85, 0.3);
satelliteMaterial.emissiveIntensity = 6;
satelliteMaterial.update();

// a steady rain of small crates for the physics tab: each one falls, tumbles about for a while and
// is then destroyed, so bodies keep appearing in and disappearing from the lists
const debris = new Entity('debris');
scenery.addChild(debris);

const DEBRIS_LIFETIME = 8;
const DEBRIS_INTERVAL = 0.4;
const DEBRIS_MAX = 24;
let debrisCount = 0;
let debrisTimer = 0;

const spawnDebris = () => {
    const shade = () => 0.5 + Math.random() * 0.4;
    const box = createPrimitive(`debris ${debrisCount++}`, 'box', new Color(shade(), shade(), shade()));
    box.setLocalScale(0.4, 0.4, 0.4);
    box.setPosition((Math.random() - 0.5) * 5, 7, (Math.random() - 0.5) * 5);
    box.setEulerAngles(Math.random() * 360, Math.random() * 360, Math.random() * 360);
    box.addComponent('rigidbody', { type: 'dynamic', mass: 2, restitution: 0.3 });
    box.addComponent('collision', { type: 'box', halfExtents: new Vec3(0.2, 0.2, 0.2) });
    box.tags.add('debris');
    debris.addChild(box);
    return box;
};

/** @type {{ entity: Entity, age: number }[]} */
const falling = [];
app.on('update', (dt) => {
    debrisTimer += dt;
    if (debrisTimer >= DEBRIS_INTERVAL) {
        debrisTimer = 0;
        falling.push({ entity: spawnDebris(), age: 0 });
    }
    for (const item of falling) item.age += dt;
    while (falling.length && (falling[0].age > DEBRIS_LIFETIME || falling.length > DEBRIS_MAX)) {
        falling.shift().entity.destroy();
    }
});

// an animated character: a deep, skinned hierarchy with an anim component
const character = assets.character.resource.instantiateRenderEntity({ castShadows: true });
character.name = 'bitmoji';
character.addComponent('anim', { activate: true });
character.anim.assignAnimation('Idle', assets.idle.resource.animations[0].resource);
character.setLocalScale(1.5, 1.5, 1.5);
app.root.addChild(character);

// the inspector, docked left under the toolbar so it leaves the example controls alone. The example
// owns this instance, so the toolbar button is switched off with NO_INSPECTOR above.
const inspector = new Inspector(app, { dock: 'left', top: 52, width: 440 });

export { app, inspector };

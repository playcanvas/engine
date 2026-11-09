// @config
// @flag NO_INSPECTOR
//
// An inspector for the running app, from the @playcanvas/inspector package. Browse the entity
// hierarchy, the frame graph of the last frame, the render targets on the device and the physics
// bodies, with the Ammo world drawn over the scene. Toggle entities on and off, watch the properties
// of the selected item update live, pause and single-step the app, and pop the panel out into its
// own window. Record frames on the Performance tab: with Script timing on, the swarm script and
// twenty more script types, there to demonstrate profiling, show updates and post-updates whose
// costs differ, some rising and falling over time. Turn on Profile from start to record from the
// start of the next load of the example, the assets loading included. Toggle the panel with the
// backquote key, pause with F9 and step with F10.

import { Inspector } from '@playcanvas/inspector';

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
    Keyboard,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RigidBodyComponentSystem,
    Script,
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
import { Swarm } from 'examples/assets/scripts/misc/swarm.mjs';
import { data, deviceType } from 'examples/context';

/**
 * @import { RenderComponent } from 'playcanvas'
 */

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

// Profile from start is kept between loads of the example, and takes effect on the next one: the
// inspector records from the start of the app, before its assets load, when it is on
const PROFILE_FROM_START = 'pc-examples-inspector-profile-from-start';
data.set('settings', { profileFromStart: localStorage.getItem(PROFILE_FROM_START) === 'true' });
data.on('settings.profileFromStart:set', (/** @type {boolean} */ value) => {
    localStorage.setItem(PROFILE_FROM_START, `${value}`);
});

// the inspector, docked left under the toolbar so it leaves the example controls alone, made before
// anything loads so it can record the start of the app. The example owns this instance, so the
// toolbar button is switched off with NO_INSPECTOR above.
const inspector = new Inspector(app, {
    dock: 'left',
    top: 52,
    width: 440,
    record: data.get('settings.profileFromStart')
});

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
 * @param {RenderComponent['type']} type - The primitive type.
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
        // destroying an entity leaves the materials it renders with alive, and each crate has its own
        const { entity } = falling.shift();
        const material = entity.render.material;
        entity.destroy();
        material.destroy();
    }
    // a counter of the app, which the Counters section of the inspector's Performance tab charts
    app.stats.user.set('crates', falling.length);
});

// a swarm of orbs circling the scene, whose script's update and post-update take a time that rises
// and falls, each at its own pace: something for the script timing of the Performance tab to show
const swarm = new Entity('swarm');
swarm.addComponent('script');
swarm.script.create(Swarm);
app.root.addChild(swarm);

// twenty more script types, there to demonstrate profiling: each runs a plain loop standing in for
// the work of a game script, of a size of its own, a few on several entities and some rising and
// falling over time, so the Performance tab's script timing has many types of different cost to
// show, more than its Scripts chart gives a band of their own at first. Each is its name, its loop
// size, the seconds its cost takes to rise and fall (0 for steady), how many entities run it and
// whether it post-updates too
const workloads = new Entity('workloads');
app.root.addChild(workloads);

/** @type {[string, number, number, number, boolean][]} */
const WORKLOADS = [
    ['enemyAi', 9000, 0, 4, false],
    ['pathfinder', 42000, 5, 1, false],
    ['inventory', 4500, 0, 1, false],
    ['weather', 12000, 11, 1, false],
    ['spawner', 7500, 0, 1, false],
    ['scoreBoard', 3000, 0, 1, false],
    ['minimap', 18000, 0, 1, true],
    ['dialogue', 2400, 0, 1, false],
    ['audioMixer', 10500, 4, 1, false],
    ['questLog', 3600, 0, 1, false],
    ['damageNumbers', 7500, 2, 2, false],
    ['cameraShake', 5400, 0, 1, true],
    ['lootTable', 6600, 0, 1, false],
    ['footsteps', 3000, 0, 3, false],
    ['tutorial', 1800, 0, 1, false],
    ['networkSync', 36000, 9, 1, true],
    ['achievements', 2700, 0, 1, false],
    ['particleLod', 13500, 6, 1, false],
    ['saveGame', 2100, 0, 1, false],
    ['crowd', 60000, 13, 1, false]
];

/**
 * @param {number} time - Mixed into the loop, so it is not optimized away.
 * @param {number} size - How many steps it takes.
 * @returns {number} What it added up.
 */
const busyLoop = (time, size) => {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Math.sin(i * 0.01 + time);
    return sum;
};

// a counter of the steps the workloads took this frame, counted afresh as each frame begins
app.stats.user.set('workloadSteps', 0);
app.on('frameupdate', () => app.stats.user.set('workloadSteps', 0));
const countSteps = (/** @type {number} */ steps) =>
    app.stats.user.set('workloadSteps', app.stats.user.get('workloadSteps') + steps);

for (const [name, size, period, instances, post] of WORKLOADS) {
    class Workload extends Script {
        static scriptName = name;

        time = 0;

        sink = 0;

        update(dt) {
            this.time += dt;
            const scale = period ? 1 + 0.8 * Math.sin((2 * Math.PI * this.time) / period) : 1;
            this.sink = busyLoop(this.time, size * scale);
            countSteps(Math.ceil(size * scale));
        }
    }
    // a type that post-updates too, declaring its own name as a script type has to
    class PostUpdatingWorkload extends Workload {
        static scriptName = name;

        postUpdate() {
            this.sink += busyLoop(this.time, size / 2);
            countSteps(Math.ceil(size / 2));
        }
    }
    for (let i = 0; i < instances; i++) {
        const entity = new Entity(`${name} ${i + 1}`);
        entity.addComponent('script');
        entity.script.create(post ? PostUpdatingWorkload : Workload);
        workloads.addChild(entity);
    }
}

// an animated character: a deep, skinned hierarchy with an anim component
const character = assets.character.resource.instantiateRenderEntity({ castShadows: true });
character.name = 'bitmoji';
character.addComponent('anim', { activate: true });
character.anim.assignAnimation('Idle', assets.idle.resource.animations[0].resource);
character.setLocalScale(1.5, 1.5, 1.5);
app.root.addChild(character);

export { app, inspector };

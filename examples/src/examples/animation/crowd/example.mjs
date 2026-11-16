// @config
//
// A crowd of animated characters, which skip evaluating their animation while off-screen, and
// evaluate it less often when far away.
//
// @credit
// title: Sparse Grass
// author: Amal Kumar
// source: https://polyhaven.com/a/sparse_grass
// license: CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/)
//
// @credit
// title: Low-poly Tree with Twisting Branches
// author: Sketchfab
// source: https://sketchfab.com/3d-models/low-poly-tree-with-twisting-branches-4e2589134f2442bcbdab51c1f306cd58
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    ADDRESS_REPEAT,
    ANIM_EQUAL_TO,
    ANIM_GREATER_THAN,
    ANIM_LESS_THAN,
    ANIM_LESS_THAN_EQUAL_TO,
    ANIM_PARAMETER_INTEGER,
    ANIM_PARAMETER_TRIGGER,
    AnimClipHandler,
    AnimComponentSystem,
    AnimStateGraphHandler,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BoundingBox,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    FOG_LINEAR,
    Keyboard,
    LightComponentSystem,
    MiniStats,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF5_32F,
    ScriptComponentSystem,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    createGraphicsDevice,
    math
} from 'playcanvas';
import { AnimUpdateOptimizer } from 'playcanvas/scripts/esm/anim/anim-update-optimizer.mjs';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// the radius of the round area the characters wander around in
const AREA_RADIUS = 40;

// the largest number of characters the slider allows
const MAX_CHARACTERS = 500;

const assets = {
    model: new Asset('model', 'container', { url: './assets/models/bitmoji.glb' }),
    idleAnim: new Asset('idleAnim', 'container', { url: './assets/animations/bitmoji/idle.glb' }),
    walkAnim: new Asset('walkAnim', 'container', { url: './assets/animations/bitmoji/walk.glb' }),
    jogAnim: new Asset('jogAnim', 'container', { url: './assets/animations/bitmoji/run.glb' }),
    jumpAnim: new Asset('jumpAnim', 'container', { url: './assets/animations/bitmoji/jump-flip.glb' }),
    grass: new Asset('grass', 'texture', { url: './assets/textures/terrain/sparse_grass_diff_1k.jpg' }, { srgb: true }),
    grassNormal: new Asset('grassNormal', 'texture', {
        url: './assets/textures/terrain/sparse_grass_nor_1k.jpg'
    }),
    tree: new Asset('tree', 'container', { url: './assets/models/low-poly-tree.glb' }),
    envAtlas: new Asset(
        'morning-env-atlas',
        'texture',
        { url: './assets/cubemaps/morning-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.keyboard = new Keyboard(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    AnimComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, AnimClipHandler, AnimStateGraphHandler];

const app = new AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

/**
 * A small seeded random number generator (mulberry32), so every run spawns the same crowd and
 * makes the same choices, which keeps profiling runs comparable.
 *
 * @param {number} seed - The seed.
 * @returns {() => number} A function returning numbers in the [0, 1) range.
 */
const createRandom = (seed) => {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};
app.scene.envAtlas = assets.envAtlas.resource;
app.scene.skyboxMip = 1;
app.scene.skyboxIntensity = 1.2;
app.scene.exposure = 1.1;

// a soft haze which fades the far ground into the sky
app.scene.fog.type = FOG_LINEAR;
app.scene.fog.color.set(0.72, 0.83, 0.9);
app.scene.fog.start = 30;
app.scene.fog.end = 250;

// the grassy ground, reaching far beyond the area the characters wander in
const GROUND_SIZE = 2000;
const GRASS_TILE_SIZE = 6;
const groundMaterial = new StandardMaterial();
for (const map of [assets.grass.resource, assets.grassNormal.resource]) {
    map.addressU = ADDRESS_REPEAT;
    map.addressV = ADDRESS_REPEAT;
    map.anisotropy = 8;
}
groundMaterial.diffuseMap = assets.grass.resource;
groundMaterial.normalMap = assets.grassNormal.resource;
groundMaterial.diffuse.set(0.62, 0.95, 0.42);
// no specular, as the reflection of the bright sky at grazing angles washes out the grass
groundMaterial.specular.set(0, 0, 0);
const tiling = GROUND_SIZE / GRASS_TILE_SIZE;
groundMaterial.diffuseMapTiling.set(tiling, tiling);
groundMaterial.normalMapTiling.set(tiling, tiling);
groundMaterial.update();

const ground = new Entity('Ground');
ground.addComponent('render', {
    type: 'plane',
    material: groundMaterial,
    castShadows: false
});
ground.setLocalScale(GROUND_SIZE, 1, GROUND_SIZE);
app.root.addChild(ground);

// a warm, low morning sun
const light = new Entity('Sun');
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.9, 0.75),
    intensity: 2.2,
    castShadows: true,
    shadowType: SHADOW_PCF5_32F,
    shadowBias: 0.2,
    normalOffsetBias: 0.05,
    shadowDistance: 45,
    numCascades: 2,
    cascadeDistribution: 0.6,
    shadowResolution: 2048
});
light.setLocalEulerAngles(40, 35, 0);
app.root.addChild(light);

// trees around the park, thinning out with distance. They are static, so they add little
// to the per-frame CPU cost being profiled
const treeTemplate = assets.tree.resource.instantiateRenderEntity();
const treeMeshInstances = treeTemplate.findComponents('render').flatMap((render) => render.meshInstances);
const treeAabb = treeMeshInstances[0].aabb.clone();
for (let i = 1; i < treeMeshInstances.length; i++) {
    treeAabb.add(treeMeshInstances[i].aabb);
}
const treeUnitScale = 1 / (treeAabb.halfExtents.y * 2);
const treeUnitBase = treeAabb.getMin().y;
treeTemplate.destroy();

const treeRandom = createRandom(42);
const TREE_COUNT = 70;
for (let i = 0; i < TREE_COUNT; i++) {
    // the trees grow outside the area the characters wander in, so nobody walks through them
    const angle = treeRandom() * Math.PI * 2;
    const radius = AREA_RADIUS + 4 + treeRandom() * treeRandom() * 45;
    const scale = treeUnitScale * (4 + treeRandom() * 3);

    const tree = new Entity(`Tree${i}`);
    tree.setLocalScale(scale, scale, scale);
    tree.setLocalEulerAngles(0, treeRandom() * 360, 0);
    tree.setLocalPosition(Math.sin(angle) * radius, -treeUnitBase * scale, Math.cos(angle) * radius);
    tree.addChild(assets.tree.resource.instantiateRenderEntity({ castShadows: true }));
    app.root.addChild(tree);
}

// the camera supports orbiting (mouse / touch) and flying (WASD + right mouse button)
const camera = new Entity('Camera');
camera.addComponent('camera', {
    toneMapping: TONEMAP_ACES,
    fov: 50,
    farClip: 1500
});
camera.addComponent('script');
app.root.addChild(camera);

const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.pitchRange = new Vec2(-90, -2);
cameraControls.zoomRange = new Vec2(1, 150);
cameraControls.reset(new Vec3(0, 1, 0), new Vec3(-5, 4.5, 15));

const miniStats = new MiniStats(app);
app.on('destroy', () => miniStats.destroy());

// the state graph shared by all characters
const animStateGraphData = {
    layers: [
        {
            name: 'locomotion',
            states: [
                { name: 'START' },
                { name: 'Idle', speed: 1.0 },
                { name: 'Walk', speed: 1.0 },
                { name: 'Jump', speed: 1.0 },
                { name: 'Jog', speed: 1.0 },
                { name: 'END' }
            ],
            transitions: [
                { from: 'START', to: 'Idle', time: 0, priority: 0 },
                {
                    from: 'Idle',
                    to: 'Walk',
                    time: 0.1,
                    priority: 0,
                    conditions: [{ parameterName: 'speed', predicate: ANIM_GREATER_THAN, value: 0 }]
                },
                {
                    from: 'ANY',
                    to: 'Jump',
                    time: 0.1,
                    priority: 0,
                    conditions: [{ parameterName: 'jump', predicate: ANIM_EQUAL_TO, value: true }]
                },
                { from: 'Jump', to: 'Idle', time: 0.2, priority: 0, exitTime: 0.8 },
                {
                    from: 'Walk',
                    to: 'Idle',
                    time: 0.1,
                    priority: 0,
                    conditions: [{ parameterName: 'speed', predicate: ANIM_LESS_THAN_EQUAL_TO, value: 0 }]
                },
                {
                    from: 'Walk',
                    to: 'Jog',
                    time: 0.1,
                    priority: 0,
                    conditions: [{ parameterName: 'speed', predicate: ANIM_GREATER_THAN, value: 1 }]
                },
                {
                    from: 'Jog',
                    to: 'Walk',
                    time: 0.1,
                    priority: 0,
                    conditions: [{ parameterName: 'speed', predicate: ANIM_LESS_THAN, value: 2 }]
                }
            ]
        }
    ],
    parameters: {
        speed: { name: 'speed', type: ANIM_PARAMETER_INTEGER, value: 0 },
        jump: { name: 'jump', type: ANIM_PARAMETER_TRIGGER, value: false }
    }
};

const clips = {
    Idle: assets.idleAnim.resource.animations[0].resource,
    Walk: assets.walkAnim.resource.animations[0].resource,
    Jog: assets.jogAnim.resource.animations[0].resource,
    Jump: assets.jumpAnim.resource.animations[0].resource
};

const random = createRandom(1234);

/**
 * The units per second a character moves at, given its current animation state.
 *
 * @param {string} state - The animation state.
 * @returns {number} The movement speed.
 */
const speedForState = (state) => {
    switch (state) {
        case 'Walk':
            return 1.0;
        case 'Jog':
            return 4.0;
        default:
            return 0.0;
    }
};

/**
 * @typedef {object} Character
 * @property {Entity} entity - The character entity, which the anim component is on.
 * @property {AnimUpdateOptimizer} optimizer - The script lowering the cost of its animation.
 * @property {Vec3} position - The position on the ground.
 * @property {Vec3} target - The position the character walks to.
 * @property {number} heading - The current facing angle in degrees.
 * @property {number} idleTime - Seconds left to stand still before picking a new target.
 * @property {number} jumpTime - Seconds until the next jump while moving.
 */

/** @type {Character[]} */
const characters = [];

const randomPoint = (/** @type {Vec3} */ out) => {
    // uniformly distributed over the round area
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * AREA_RADIUS;
    return out.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
};

// A conservative bounding box around a character in all its poses, jumps included. Without it,
// the bounds of a skinned mesh are computed from its animated bones every frame, which needs the
// skinning matrices of every character before culling, even of those which end up off-screen.
const characterAabb = new BoundingBox(new Vec3(0, 0.85, 0), new Vec3(1.05, 1.05, 1.05));

const applyCustomAabb = (/** @type {Entity} */ entity, /** @type {boolean} */ enabled) => {
    entity.findComponents('render').forEach((/** @type {any} */ render) => {
        render.customAabb = enabled ? characterAabb : null;
    });
};

// the animation of characters further than this from the camera is evaluated less often, a step per distance
const LOD_DISTANCE = 12;

const createCharacter = () => {
    const entity = new Entity(`Character${characters.length}`);

    // the anim component drives the transforms of the render entity and its children, while the
    // character entity itself is moved around by the wandering logic below
    const renderEntity = assets.model.resource.instantiateRenderEntity({
        castShadows: data.get('data.shadows')
    });
    entity.addChild(renderEntity);
    applyCustomAabb(entity, data.get('data.customAabb'));

    entity.addComponent('anim', { activate: true });
    entity.anim.loadStateGraph(animStateGraphData);
    const layer = entity.anim.baseLayer;
    for (const [state, clip] of Object.entries(clips)) {
        layer.assignAnimation(state, clip);
    }

    // lowers the cost of the animation when the character is off-screen or far away. The camera is
    // created before the characters, so its controls move it before this script predicts visibility
    entity.addComponent('script');
    const optimizer = /** @type {AnimUpdateOptimizer} */ (
        entity.script.create(AnimUpdateOptimizer, {
            properties: {
                camera,
                margin: 1,
                predict: data.get('data.prediction'),
                offscreenUpdate: data.get('data.offscreenUpdate'),
                lodDistance: data.get('data.lod') ? LOD_DISTANCE : 0
            }
        })
    );

    const character = {
        entity,
        optimizer,
        position: randomPoint(new Vec3()),
        target: new Vec3(),
        heading: random() * 360,
        idleTime: random() * 3,
        jumpTime: 2 + random() * 6
    };
    character.target.copy(character.position);
    entity.setLocalPosition(character.position);
    entity.setLocalEulerAngles(0, character.heading, 0);

    app.root.addChild(entity);
    characters.push(character);
};

const setCount = (/** @type {number} */ count) => {
    while (characters.length < count) {
        createCharacter();
    }
    while (characters.length > count) {
        characters.pop().entity.destroy();
    }
};

const setShadows = (/** @type {boolean} */ castShadows) => {
    for (const character of characters) {
        character.entity.findComponents('render').forEach((/** @type {any} */ render) => {
            render.castShadows = castShadows;
        });
    }
};

const delta = new Vec3();

/**
 * Moves a character towards its target, picking a new target once it arrives and an idle pause
 * runs out, and triggers the occasional jump.
 *
 * @param {Character} character - The character.
 * @param {number} dt - The frame time in seconds.
 */
const updateCharacter = (character, dt) => {
    const anim = character.entity.anim;
    const layer = anim.baseLayer;

    if (anim.getInteger('speed') === 0) {
        character.idleTime -= dt;
        if (character.idleTime <= 0) {
            randomPoint(character.target);
            anim.setInteger('speed', random() < 0.3 ? 2 : 1);
        }
        return;
    }

    // occasionally jump while on the move
    character.jumpTime -= dt;
    if (character.jumpTime <= 0) {
        character.jumpTime = 3 + random() * 8;
        if (layer.activeState !== 'Jump') {
            anim.setTrigger('jump');
        }
    }

    // blend the movement speed during transitions to limit foot sliding
    let moveSpeed = speedForState(layer.activeState);
    if (layer.transitioning) {
        const progress = layer.transitionProgress;
        moveSpeed = math.lerp(speedForState(layer.previousState), moveSpeed, progress);
    }

    delta.sub2(character.target, character.position);
    delta.y = 0;
    const distance = delta.length();
    const step = moveSpeed * dt;

    if (step >= distance) {
        character.position.copy(character.target);
        anim.setInteger('speed', 0);
        character.idleTime = 1 + random() * 3;
    } else if (distance > 0) {
        character.position.x += (delta.x / distance) * step;
        character.position.z += (delta.z / distance) * step;

        // turn smoothly towards the target
        const targetHeading = Math.atan2(delta.x, delta.z) * math.RAD_TO_DEG;
        const diff = ((targetHeading - character.heading + 540) % 360) - 180;
        character.heading += Math.min(1, dt * 6) * diff;
    }

    character.entity.setLocalPosition(character.position);
    character.entity.setLocalEulerAngles(0, character.heading, 0);
};

data.on('data.prediction:set', (/** @type {boolean} */ value) => {
    characters.forEach((character) => {
        character.optimizer.predict = value;
    });
});
data.on('data.lod:set', (/** @type {boolean} */ value) => {
    characters.forEach((character) => {
        character.optimizer.lodDistance = value ? LOD_DISTANCE : 0;
    });
});
data.on('data.offscreenUpdate:set', (/** @type {string} */ value) => {
    characters.forEach((character) => {
        character.optimizer.offscreenUpdate = value;
    });
});

// the counters shown in the stats panel, averaged over a short period
const stats = { frames: 0, evaluated: 0, offscreen: 0, skipped: 0, animTime: 0, time: 0 };
app.on('frameend', () => {
    const frame = app.stats.frame;
    stats.frames++;
    stats.evaluated += frame.animEvaluated;
    stats.offscreen += frame.animOffscreen;
    stats.skipped += frame.animIntervalSkipped;
    stats.animTime += frame.animUpdate;
    stats.time += frame.dt;
    if (stats.time > 0.25) {
        data.set('data.stats.evaluated', String(Math.round(stats.evaluated / stats.frames)));
        data.set('data.stats.offscreen', String(Math.round(stats.offscreen / stats.frames)));
        data.set('data.stats.skipped', String(Math.round(stats.skipped / stats.frames)));
        data.set('data.stats.animTime', `${(stats.animTime / stats.frames).toFixed(2)} ms`);
        stats.frames = stats.evaluated = stats.offscreen = stats.skipped = stats.animTime = stats.time = 0;
    }
});

app.on('update', (/** @type {number} */ dt) => {
    for (let i = 0; i < characters.length; i++) {
        updateCharacter(characters[i], dt);
    }
});

data.on('data.count:set', (/** @type {number} */ count) => {
    setCount(Math.max(0, Math.min(MAX_CHARACTERS, Math.round(count))));
});
data.on('data.customAabb:set', (/** @type {boolean} */ value) => {
    for (const character of characters) {
        applyCustomAabb(character.entity, value);
    }
});
data.on('data.shadows:set', (/** @type {boolean} */ value) => {
    setShadows(value);
});

data.set('data', {
    count: 20,
    shadows: true,
    customAabb: true,
    offscreenUpdate: 'state',
    prediction: true,
    lod: true,
    stats: {
        evaluated: '0',
        offscreen: '0',
        skipped: '0',
        animTime: '0 ms'
    }
});
setCount(data.get('data.count'));

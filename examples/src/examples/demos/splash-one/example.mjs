// @config
//
// @flag CREDITS_HIDDEN
//
// @credit
// title: Aerial Grass Rock
// author: Rob Tuytel
// source: https://polyhaven.com/a/aerial_grass_rock
// license: CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/)
//
// @credit
// title: Sparse Grass
// author: Amal Kumar
// source: https://polyhaven.com/a/sparse_grass
// license: CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/)
//
// @credit
// title: Dirt Aerial 02
// author: Rob Tuytel
// source: https://polyhaven.com/a/dirt_aerial_02
// license: CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/)
//
// @credit
// title: Aerial Rocks 02
// author: Rob Tuytel
// source: https://polyhaven.com/a/aerial_rocks_02
// license: CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/)
//
// @credit
// title: Aerial Beach 01
// author: Rob Tuytel
// source: https://polyhaven.com/a/aerial_beach_01
// license: CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/)
//
// @credit
// title: Rock Face 03
// author: Dario Barresi and Rico Cilliers
// source: https://polyhaven.com/a/rock_face_03
// license: CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/)
//
// @credit
// title: Afterburner sound.wav
// author: StoneyJ
// source: https://freesound.org/people/StoneyJ/sounds/104883/
// license: CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/)
//
// @credit
// title: Afterburner
// author: TiesWijnen
// source: https://freesound.org/people/TiesWijnen/sounds/413312/
// license: CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/)
//
// @credit
// title: missile lock on sound
// author: Alxy
// source: https://freesound.org/people/Alxy/sounds/189327/
// license: CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/)

// An arcade jet fighter. The mission briefing, with the controls, is shown in the game itself.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    AudioHandler,
    ContainerHandler,
    ButtonComponentSystem,
    CameraComponentSystem,
    CameraFrame,
    CLOUDTYPE_FLAT,
    CLOUDTYPE_NONE,
    CLOUDTYPE_VOLUMETRIC,
    Color,
    DynamicSkyEffect,
    ElementComponentSystem,
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    GamePads,
    KEY_A,
    KEY_C,
    KEY_D,
    KEY_DOWN,
    KEY_E,
    KEY_ENTER,
    KEY_F,
    KEY_LEFT,
    KEY_Q,
    KEY_R,
    KEY_RIGHT,
    KEY_S,
    KEY_SHIFT,
    KEY_SPACE,
    KEY_TAB,
    KEY_UP,
    KEY_W,
    KEY_X,
    Keyboard,
    LAYERID_DEPTH,
    LAYERID_IMMEDIATE,
    LAYERID_SKYBOX,
    LAYERID_UI,
    LAYERID_WORLD,
    Layer,
    LensFlare,
    LensFlareEffect,
    LightComponentSystem,
    MOUSEBUTTON_LEFT,
    MOUSEBUTTON_RIGHT,
    Mat4,
    MeshInstance,
    Mouse,
    PAD_FACE_1,
    PAD_FACE_2,
    PAD_FACE_3,
    PAD_FACE_4,
    PAD_L_SHOULDER_1,
    PAD_L_SHOULDER_2,
    PAD_L_STICK_X,
    PAD_L_STICK_Y,
    PAD_R_SHOULDER_1,
    PAD_R_SHOULDER_2,
    PAD_R_STICK_X,
    PAD_START,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF3_32F,
    SORTMODE_MANUAL,
    ScreenComponentSystem,
    ScriptComponentSystem,
    SoundManager,
    TONEMAP_ACES,
    TextureHandler,
    Vec3,
    createGraphicsDevice,
    math,
    platform
} from 'playcanvas';

import { deviceType } from 'examples/context';

import { Sounds } from './audio.mjs';
import { Effects, PRESETS, TrailState, randomDirection } from './effects.mjs';
import { HUD_AMBER, HUD_GREEN, HUD_MISSILE, HUD_RED, HUD_WHITE, Hud, project } from './hud.mjs';
import {
    LIVERIES,
    createFrigate,
    createFuelTanks,
    createJet,
    createPlayerJet,
    createMaterials,
    createMissileMesh,
    createRadar,
    createSamLauncher,
    createTank
} from './models.mjs';
import { COMBAT_RADIUS, TERRAIN_LAYERS, Terrain, createTerrainMaps } from './terrain.mjs';

/**
 * @import { GroundModel, JetModel, ShipModel } from './models.mjs'
 * @import { Ribbon } from './effects.mjs'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// --------------------------------------------------------------------------------------------
// tuning

// The world. Every mission is a new landscape, with the player starting near its edge from a random
// direction, flying in towards the combat area where the enemy bases are.
const START_DISTANCE = 6200;
const START_ALTITUDE = 900;
const BASE_SITES = 4;

// The player's jet. Speeds are in meters per second and rates in degrees per second - far more agile
// than a real fighter, so turning to chase a target, or turning hard to shake off a missile, is quick
// and easy. Releasing the roll keys levels the wings, and a banked jet turns on its own, so the jet can
// be flown with the roll keys alone.
const CRUISE_SPEED = 175;
const BOOST_SPEED = 275;
const BRAKE_SPEED = 105;
const MIN_SPEED = 80;
const MAX_SPEED = 340;
const SPEED_RESPONSE = 0.8;
const PITCH_RATE = 82;
const ROLL_RATE = 220;
const YAW_RATE = 24;
const TURN_ASSIST = 36;
const AUTO_LEVEL = 1.8;
const RATE_RESPONSE = 7;
const PLAYER_HEALTH = 100;

// Weapons. A missile can be fired every quarter of a second, so several are in the air at once, and
// the lock moves on to the next target after each one. Each mission carries this many missiles per
// target, which leaves room for misses.
const FIRE_INTERVAL = 0.24;
const LOCK_RANGE = 5000;
const LOCK_CONE = 20;
const MISSILES_PER_TARGET = 5;
const FLARE_COUNT = 60;
const FLARE_INTERVAL = 0.8;

// after picking a target by hand, the automatic selection leaves it alone for a while
const MANUAL_SELECTION_HOLD = 5;

/**
 * How a kind of missile flies.
 *
 * @typedef {object} MissileSpec
 * @property {number} accel - The acceleration of the motor.
 * @property {number} maxSpeed - The top speed.
 * @property {number} turnRate - How fast it turns, in degrees per second.
 * @property {number} life - How long until it self destructs, in seconds.
 * @property {number} burn - How long the motor burns, and the trail is laid, in seconds.
 * @property {number} fuse - How close it has to pass to its target to go off, in meters.
 * @property {number} damage - The damage it does.
 * @property {number} arming - How long after release it starts to guide, in seconds.
 * @property {number} smoke - The size of its trail.
 * @property {number} kick - How far off to one side it swings as the motor lights, in degrees.
 * @property {number} curve - How wide an arc it swings in on its target along, as a fraction of the
 * distance to it.
 * @property {number} weave - How much it corkscrews about its path, as a fraction of the distance.
 * @property {number} loft - How much its arc is biased upwards, so it climbs and dives on its target.
 * @property {number} terminal - How much tighter it turns in the last few hundred meters.
 * @property {number} drop - How long it falls clear of its pylon before the motor lights, in seconds.
 * @property {number} [scale] - The size of the missile, relative to the others. Defaults to 1.
 * @property {number} [pitchOver] - How fast it turns onto its target out of a vertical launch, in
 * degrees per second, before it settles down to its turn rate. Defaults to none.
 * @property {number} [pitchOverTime] - How long after arming it turns at the pitch over rate.
 * @property {number} [spreadTime] - How long after arming its arc takes to open out, in seconds, so
 * missiles fired together fly together for a while before they fan out. Defaults to none.
 */

// The player's missiles are fast and agile. Enemy missiles are slower and turn far less tightly than
// the player's jet, which is what makes a hard break turn shake them off.
/** @type {MissileSpec} */
const PLAYER_MISSILE = {
    accel: 300,
    maxSpeed: 560,
    turnRate: 55,
    life: 9,
    burn: 9,
    fuse: 16,
    damage: 100,
    arming: 0.7,
    smoke: 1,
    kick: 6,
    curve: 0.4,
    weave: 0.08,
    loft: 0,
    terminal: 1.2,
    drop: 0.35,
    spreadTime: 1.6
};
/** @type {MissileSpec} */
const ENEMY_MISSILE = {
    accel: 180,
    maxSpeed: 340,
    turnRate: 21,
    life: 10,
    burn: 10,
    fuse: 9,
    damage: 20,
    arming: 0.55,
    smoke: 0.85,
    kick: 10,
    curve: 0.2,
    weave: 0.04,
    loft: 0,
    terminal: 0,
    drop: 0.25
};
/** @type {MissileSpec} */
const SAM_MISSILE = {
    accel: 220,
    maxSpeed: 380,
    turnRate: 23,
    life: 12,
    burn: 12,
    fuse: 10,
    damage: 20,
    arming: 0.8,
    smoke: 1.35,
    kick: 0,
    curve: 0.25,
    weave: 0.03,
    loft: 1.5,
    terminal: 0,
    drop: 0
};

// The frigates' missiles are heavier - they reach further and fly faster, and come three or four at a
// time, but they turn far less tightly once they are on their way, so a hard turn at the right moment
// takes a whole salvo out of the sky. They climb out of their cells, each leaning out to its own side
// so a salvo stands as separate columns of smoke, and pitch over onto the target before they settle
// down.
/** @type {MissileSpec} */
const SHIP_MISSILE = {
    accel: 240,
    maxSpeed: 520,
    turnRate: 10,
    life: 18,
    burn: 16,
    fuse: 12,
    damage: 30,
    arming: 1.3,
    smoke: 2.4,
    kick: 18,
    curve: 0.12,
    weave: 0.01,
    loft: 0.5,
    terminal: 0,
    drop: 0,
    scale: 1.8,
    pitchOver: 60,
    pitchOverTime: 2.4
};

// how hard a missile released from a pylon falls clear of the jet, in meters per second squared, and
// how fast it then swings out onto its kick, in degrees per second
const MISSILE_DROP_ACCEL = 30;
const MISSILE_KICK_RATE = 70;

// A missile's smoke is laid as puffs, which soon break up, over a line which lasts well after them and
// drifts off with the wind - so a fight leaves the sky full of its arcs.
const MISSILE_TRAIL_LIFE = 12;
const MISSILE_TRAIL_SPACING = 25;
const MISSILE_TRAIL_GROWTH = 5;

// Contrails - the vapor every jet's engines condense into once the air is cold enough, which here is
// from a few hundred meters up. They start a little way behind the nozzle, and hang in the sky for a
// while, spreading out and drifting with the wind.
const CONTRAIL_ALTITUDE_START = 450;
const CONTRAIL_ALTITUDE_FULL = 1000;
const CONTRAIL_LIFE = 20;
const CONTRAIL_SPACING = 35;
const CONTRAIL_GROWTH = 10;
const CONTRAIL_GAP = 30;
const CONTRAIL_WIDTH = 0.7;
const CONTRAIL_INTENSITY = 0.5;

// the enemy fighters
const ENEMY_SPEED = 165;
const ENEMY_TURN_RATE = 42;
const ENEMY_FIRE_RANGE = 3200;
const ENEMY_FIRE_CONE = 12;
const ENEMY_MIN_ALTITUDE = 220;
const MAX_ENEMY_MISSILES = 4;
const MAX_ENEMIES = 20;

// the size of a mission, picked at random between these
const MISSION_FIGHTERS_MIN = 8;
const MISSION_FIGHTERS_MAX = 12;
const MISSION_GROUND_MIN = 6;
const MISSION_GROUND_MAX = 10;

// the missile launchers on the ground
const SAM_RANGE = 3800;
const SAM_COOLDOWN = 6;

// The enemy frigates, in the missions that have them. They sail round the open water at a steady pace,
// steering clear of the shore, and fire a salvo from long range now and then. Two hits sink one.
const MISSION_SHIPS_CHANCE = 0.7;
const MISSION_SHIPS_MIN = 2;
const MISSION_SHIPS_MAX = 3;
const SHIP_SPEED = 11;
const SHIP_TURN_RATE = 2.5;
const SHIP_HITS = 2;
const SHIP_RANGE = 7500;
const SHIP_COOLDOWN = 10;
// the water a ship needs under it, in meters
const SHIP_DEPTH = 9;

// The jet's own missile defense - a gun under the nose that shoots down an enemy missile homing on the
// jet just before it would hit, once it is in range or about to arrive, whichever comes first. It has
// a few shots, fired one after another at the missiles of a salvo as they come in, which recharge one
// at a time - so a salvo is taken care of, while another soon after needs a hard turn or flares. The
// hull also repairs itself after a while without being hit.
const DEFENSE_SHOTS = 6;
const DEFENSE_RECHARGE = 1.6;
const DEFENSE_RANGE = 900;
const DEFENSE_REACTION = 2.2;
const DEFENSE_BURST = 0.25;
const DEFENSE_RETARGET = 0.1;
const REPAIR_DELAY = 6;
const REPAIR_RATE = 4;

// The chase camera trails the jet rather than being bolted to it: it turns after the jet with a lag,
// so the jet swings round in the frame as it turns, and only partly follows the jet's roll, so the
// horizon tilts less than the wings do.
const CAMERA_DISTANCE = 23;
const CAMERA_HEIGHT = 5.2;
const CAMERA_FOLLOW = 4;
const CAMERA_ROLL_FOLLOW = 3;
const CAMERA_FOV = 60;

// --------------------------------------------------------------------------------------------
// the application

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.keyboard = new Keyboard(window);
createOptions.gamepads = new GamePads();
createOptions.elementInput = new ElementInput(canvas);
createOptions.soundManager = new SoundManager();
createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    ScreenComponentSystem,
    ElementComponentSystem,
    ButtonComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, FontHandler, AudioHandler, ContainerHandler];

const app = new AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);

// Tab cycles the targets, which the browser would otherwise take to move the focus off the canvas
const preventTab = (/** @type {KeyboardEvent} */ event) => {
    if (event.key === 'Tab') {
        event.preventDefault();
    }
};
window.addEventListener('keydown', preventTab);

app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    window.removeEventListener('keydown', preventTab);
});

app.mouse.disableContextMenu();

const assets = {
    font: new Asset('font', 'font', { url: './assets/fonts/roboto-bold.json' }),
    engineSound: new Asset('engine', 'audio', { url: './assets/sounds/splash-one-engine.mp3' }),
    launchSound: new Asset('launch', 'audio', { url: './assets/sounds/splash-one-launch.mp3' }),
    alarmSound: new Asset('alarm', 'audio', { url: './assets/sounds/splash-one-alarm.mp3' }),
    playerJet: new Asset('experimental-fighter', 'container', { url: './assets/models/experimental-fighter.glb' }),
    stealthFrigate: new Asset('stealth-frigate', 'container', { url: './assets/models/stealth-frigate.glb' })
};

// the scanned materials of the ground, an albedo and a normal map for each of its layers
const terrainAlbedo = TERRAIN_LAYERS.map(
    ({ name }) => new Asset(name, 'texture', { url: `./assets/textures/terrain/${name}_diff_1k.jpg` }, { srgb: true })
);
const terrainNormal = TERRAIN_LAYERS.map(
    ({ name }) => new Asset(`${name}-normal`, 'texture', { url: `./assets/textures/terrain/${name}_nor_1k.jpg` })
);

// the shapes of the sun's lens flare
const flareShapes = [
    'glow_soft',
    'burst_wide',
    'iris_hexagon',
    'iris_round',
    'iris_smear',
    'glow_rim',
    'spectrum_arc'
].map((name) => new Asset(name, 'texture', { url: `./assets/textures/lens-flare/${name}.png` }, { srgb: true }));

await new Promise((resolve) => {
    new AssetListLoader(
        [...Object.values(assets), ...terrainAlbedo, ...terrainNormal, ...flareShapes],
        app.assets
    ).load(resolve);
});

app.start();

// --------------------------------------------------------------------------------------------
// the world

const startPosition = new Vec3();
const startForward = new Vec3();

// The water has a layer of its own, drawn after the depth of the scene is rendered - so it can tell how
// deep it is - and before the smoke and the trails, which are drawn over it. The wakes of the ships are
// drawn in it too, in order after the water.
const worldLayer = /** @type {Layer} */ (app.scene.layers.getLayerById(LAYERID_WORLD));
const waterLayer = new Layer({ name: 'Water', transparentSortMode: SORTMODE_MANUAL });
app.scene.layers.insert(waterLayer, app.scene.layers.getTransparentIndex(worldLayer));

// the texture arrays of the ground's materials, shared by every landscape
const terrainMaps = createTerrainMaps(device, terrainAlbedo, terrainNormal);

/**
 * Generates a new landscape, and a place to start from on its edge.
 *
 * @returns {Terrain} The terrain.
 */
const createWorld = () => {
    const bearing = Math.random() * Math.PI * 2;
    startPosition.set(Math.sin(bearing) * START_DISTANCE, 0, Math.cos(bearing) * START_DISTANCE);
    startForward.set(-startPosition.x, 0, -startPosition.z).normalize();
    const world = new Terrain(app, {
        seed: Math.floor(Math.random() * 100000),
        siteCount: BASE_SITES,
        start: startPosition,
        forward: startForward,
        waterLayer,
        maps: terrainMaps
    });
    startPosition.y = Math.max(START_ALTITUDE, world.heightAt(startPosition.x, startPosition.z) + 500);
    return world;
};

let terrain = createWorld();

// the first mission uses the landscape generated while loading, every one after it a new one
let worldUsed = false;

const groundHeight = (/** @type {number} */ x, /** @type {number} */ z) => terrain.surfaceAt(x, z);

// The sun. The sky effect turns it to match the time of day, dims it near the horizon and under the
// clouds, and turns it into the moonlight at night. The player's jet is the only thing that casts a
// shadow - seen on the ground below, it is what tells how low the jet is flying.
const sun = new Entity('Sun');
sun.addComponent('light', {
    type: 'directional',
    castShadows: true,
    shadowType: SHADOW_PCF3_32F,
    shadowBias: 0.4,
    normalOffsetBias: 0.6,
    shadowDistance: 2400,
    numCascades: 3,
    cascadeDistribution: 0.75,
    shadowResolution: platform.mobile ? 1024 : 2048
});
app.root.addChild(sun);

// the haze - its density at sea level, how quickly it thins with height, how much it can hide at most,
// and a brightness multiplier, read by the atmosphere shader chunks
const atmosphere = [1e-4, 1 / 1400, 1, 1];

// the time of day of the current mission, picked at random
let sunElevation = 30;
let sunAzimuth = 0;

// the light the smoke picks up from the sky and the ground, for the current time of day
const skyLight = new Color();
const groundLight = new Color();
const sunLight = new Color();
const _skySample = new Color();
const _nightLight = new Color();

// the directions the smoke is lit by the sky from, averaged - above it, and all round it
const SKY_LIGHT_DIRECTIONS = [
    new Vec3(0, 1, 0),
    new Vec3(1, 0.5, 0),
    new Vec3(-1, 0.5, 0),
    new Vec3(0, 0.5, 1),
    new Vec3(0, 0.5, -1)
];

const camera = new Entity('Camera');
camera.addComponent('camera', {
    fov: CAMERA_FOV,
    // as tight a depth range as the view allows - the far terrain is lost in the haze well before this,
    // and the sky is drawn at infinity regardless
    nearClip: 3,
    farClip: 60000,
    layers: [LAYERID_WORLD, LAYERID_DEPTH, LAYERID_SKYBOX, waterLayer.id, LAYERID_IMMEDIATE, LAYERID_UI]
});
app.root.addChild(camera);

const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.toneMapping = TONEMAP_ACES;

// the scene depth is what softens the smoke where it meets the ground
cameraFrame.rendering.sceneDepthMap = true;
cameraFrame.rendering.samples = platform.mobile ? 1 : 4;
cameraFrame.rendering.sharpness = 0.25;
cameraFrame.bloom.intensity = 0.025;
cameraFrame.bloom.blurLevel = 7;
cameraFrame.vignette.intensity = 0.25;
cameraFrame.vignette.inner = 0.55;
cameraFrame.vignette.outer = 1.3;

// The sky, with the sun, the moon and the stars, and clouds drifting on the wind of the mission. It
// lights the scene with an environment it generates from itself, and keeps the sun in step with it.
const sky = new DynamicSkyEffect(device);
sky.light = sun.light;
sky.sunIntensity = 3.2;
sky.moonIntensity = 0.5;
sky.starBrightness = 0.15;
sky.lightingInterpolation = true;
cameraFrame.addEffect(sky);

// the clouds of a cloudy mission - ray marched, or on mobile a flat layer of them, which costs a lot
// less
const CLOUD_TYPE = platform.mobile ? CLOUDTYPE_FLAT : CLOUDTYPE_VOLUMETRIC;

// A faint lens flare on the sun - a soft glow with fine rays, a rainbow arc past the middle of the
// frame, and a few dim ghosts across it.
// It fades as the terrain or a jet covers the sun, which it measures against the scene depth.
const lensFlare = new LensFlareEffect(device);
lensFlare.shapes = {
    resolution: 512,
    shapes: Object.fromEntries(flareShapes.map((asset) => [asset.name, asset.resource]))
};
lensFlare.intensity = 1.56;
const sunFlare = new LensFlare(
    {
        elements: [
            { shape: 'glow_soft', size: 0.22, color: [1, 0.9, 0.75], intensity: 1 },
            { shape: 'burst_wide', size: 0.5, color: [1, 0.95, 0.85], intensity: 0.6 },
            {
                shape: 'iris_hexagon',
                offset: 0.55,
                size: 0.035,
                color: [0.55, 0.75, 1],
                intensity: 0.4,
                count: 3,
                spread: 0.3
            },
            { shape: 'spectrum_arc', offset: 1.1, size: 0.6, rotation: 180, autoRotate: true, intensity: 0.15 },
            { shape: 'iris_round', offset: 1.3, size: 0.09, color: [1, 0.75, 0.5], intensity: 0.15 },
            { shape: 'glow_rim', offset: 1.9, size: 0.18, color: [0.8, 0.6, 1], intensity: 0.07 },
            { shape: 'iris_smear', offset: 2.4, size: 0.06, color: [0.6, 1, 0.7], intensity: 0.15 }
        ]
    },
    { light: sun.light }
);
lensFlare.add(sunFlare);
cameraFrame.addEffect(lensFlare);
cameraFrame.update();

const effects = new Effects(app, groundHeight, waterLayer);
const materials = createMaterials();
const missileMesh = createMissileMesh(device);
const hud = new Hud(app, assets.font);

/** @type {Sounds|null} */
let audio = null;
try {
    audio = new Sounds(app.soundManager, {
        engine: assets.engineSound.resource.buffer,
        launch: assets.launchSound.resource.buffer,
        alarm: assets.alarmSound.resource.buffer
    });
} catch {
    // no audio on this device - the game plays on silently
    audio = null;
}

// Right around sunset and sunrise, the light of the sun has gone or is going, and the night's has not
// come in yet - the eye opens up to the dusk, so the exposure is raised through it, by these factors
// at these heights of the sun, and the land brightens steadily from the night to the day.
const DUSK_EXPOSURE = [
    [-4, 1],
    [-3, 1.9],
    [-2, 2.8],
    [-1, 3.3],
    [0, 3],
    [1, 2.4],
    [2.5, 1.3],
    [4, 1]
];

/**
 * How much the exposure is raised at a height of the sun, see DUSK_EXPOSURE.
 *
 * @param {number} elevation - The height of the sun above the horizon, in degrees.
 * @returns {number} The factor.
 */
const duskExposure = (elevation) => {
    for (let i = 1; i < DUSK_EXPOSURE.length; i++) {
        const [e1, v1] = DUSK_EXPOSURE[i];
        if (elevation < e1) {
            const [e0, v0] = DUSK_EXPOSURE[i - 1];
            return elevation < e0 ? v0 : math.lerp(v0, v1, (elevation - e0) / (e1 - e0));
        }
    }
    return 1;
};

/**
 * Sets the time of day, and everything that goes with it - the sky, the haze and the light the smoke
 * is lit by.
 *
 * @param {number} elevation - The height of the sun above the horizon, in degrees.
 * @param {number} azimuth - The compass direction of the sun, in degrees.
 */
const setTimeOfDay = (elevation, azimuth) => {
    // the air is hazier and the sky redder when the sun is low
    const low = 1 - math.smoothstep(3, 18, elevation);
    sky.elevation = elevation;
    sky.azimuth = azimuth;
    sky.turbidity = math.lerp(2.1, 4.5, low);
    sky.rayleigh = math.lerp(1.4, 2.4, low);

    // the afterglow over the sunset dies away as the night deepens
    sky.twilightGlow = math.lerp(0.25, 0.8, math.smoothstep(-12, -2, elevation));

    const el = elevation * math.DEG_TO_RAD;

    // The sky effect balances the brightness of its sky against its sun. The landscape here wants a
    // little less sky with the sun low, where the haze would otherwise swallow the ground, so the
    // brightness follows the strength of the sun in the sky's daylight model instead - which fades
    // out a couple of degrees below the horizon - and the balance the effect applies is divided back
    // out.
    const sunStrength = 1000 * Math.max(0, 1 - Math.exp(-(el + 0.0402768) / 1.5));
    const balance = (sky.sunIntensity * 0.05) / Math.max(Math.sin(el), 0.1);
    sky.luminance = (0.26 * Math.pow(246 / Math.max(sunStrength, 20), 0.6)) / balance;

    // how far into the night it is - the same crossfade the sky makes to its night model, a little
    // after the sun has set
    const night = math.clamp((2 - elevation) / 10, 0, 1);

    atmosphere[0] = math.lerp(math.lerp(3e-5, 7e-5, low), 4.5e-5, night);

    // The ground gets far brighter as the sun climbs - the sunlight on it grows with the sine of the
    // sun's height, over a little light from the sky - so the exposure comes down with it, a little
    // less than the light goes up, a fixed stand in for the eye adapting. With the sun low, it stays
    // put. At night it opens right up, enough to make out the moonlit landscape, which also lets
    // every flame, flare and explosion light it up.
    const dayExposure = Math.min(1.05, 0.435 * Math.pow(Math.max(Math.sin(el), 0) + 0.1, -0.65));
    app.scene.exposure = math.lerp(dayExposure, 2.2, math.smoothstep(0, 1, night)) * duskExposure(elevation);

    // Fire and flames would get all of that extra exposure too, and turn into huge blooming blobs in
    // the dark. They are held back by most of it, and the bloom eases off at night.
    effects.setEmissiveScale(Math.pow(dayExposure / app.scene.exposure, 0.8));
    cameraFrame.bloom.intensity = math.lerp(0.025, 0.014, night);
    cameraFrame.update();

    // Below the horizon the sky turns the light towards the moon, which has no flare - it fades out
    // as the sun sets. Clouds dim it along with the sunlight, as the sun is often behind them.
    const clouded = sky.cloudType !== CLOUDTYPE_NONE ? 1 - sky.cloudCoverage * sky.cloudSunDimming : 1;
    sunFlare.intensity = math.smoothstep(0, 1.5, elevation) * clouded;

    // smoke is lit by the sky above it, averaged over a few directions, and by the ground below
    skyLight.set(0, 0, 0);
    for (const direction of SKY_LIGHT_DIRECTIONS) {
        sky.getSkyColor(direction, _skySample);
        skyLight.r += _skySample.r;
        skyLight.g += _skySample.g;
        skyLight.b += _skySample.b;
    }
    skyLight.mulScalar(0.9 / SKY_LIGHT_DIRECTIONS.length);

    // and at night a little more than by the faint glow of the night sky alone, so it shows
    const nightSky = sky.nightColor;
    const nightLevel = sky.nightBrightness * 1.3;
    skyLight.lerp(
        skyLight,
        _nightLight.set(nightSky.r * nightLevel, nightSky.g * nightLevel, nightSky.b * nightLevel),
        night
    );

    const bounce = 0.12 * Math.max(Math.sin(el), 0.05) * sky.sunIntensity * (1 - night);
    groundLight.set(
        0.1 * bounce + skyLight.r * 0.2,
        0.12 * bounce + skyLight.g * 0.2,
        0.07 * bounce + skyLight.b * 0.15
    );
};

// The times of day the missions are flown at, and how often each comes up - the sun low in the sky
// looks the most interesting, so sunrise and sunset, the twilight around them and the golden hours
// after and before them come up more often than the long middle of the day does, and nights too.
const TIMES_OF_DAY = [
    { chance: 0.22, elevation: [-18, -6] }, // night, by the moon and the stars
    { chance: 0.3, elevation: [-3.5, 4] }, // sunrise and sunset, and the twilight either side
    { chance: 0.28, elevation: [4, 15] }, // the golden hours
    { chance: 0.2, elevation: [15, 60] } // the day
];

/**
 * Picks a random time of day for the next mission, see TIMES_OF_DAY.
 */
const randomTimeOfDay = () => {
    let pick = Math.random();
    const time = TIMES_OF_DAY.find(({ chance }) => (pick -= chance) < 0) ?? TIMES_OF_DAY[TIMES_OF_DAY.length - 1];
    sunElevation = math.lerp(time.elevation[0], time.elevation[1], Math.random());
    sunAzimuth = Math.random() * 360;
};

// --------------------------------------------------------------------------------------------
// shared scratch objects

const _v0 = new Vec3();
const _v1 = new Vec3();
const _v2 = new Vec3();
const _v3 = new Vec3();
const _q0 = new Quat();
const _q1 = new Quat();
const _m0 = new Mat4();
const _screen = new Vec3();

/**
 * Builds an orientation from a forward and an up direction.
 *
 * @param {Vec3} forward - The direction the nose points in.
 * @param {Vec3} up - The direction the top of the jet points in, roughly.
 * @param {Quat} out - Receives the orientation.
 * @returns {Quat} The orientation.
 */
const orientation = (forward, up, out) => {
    _m0.setLookAt(Vec3.ZERO, forward, up);
    return out.setFromMat4(_m0);
};

/**
 * Turns a direction towards another, by at most a given angle.
 *
 * @param {Vec3} direction - The direction to turn, normalized. Modified in place.
 * @param {Vec3} desired - The direction to turn towards, normalized.
 * @param {number} maxAngle - The most it can turn, in radians.
 * @returns {number} The angle it turned by, in radians.
 */
const turnTowards = (direction, desired, maxAngle) => {
    const angle = Math.acos(math.clamp(direction.dot(desired), -1, 1));
    if (angle < 1e-5) {
        return 0;
    }
    const step = Math.min(angle, maxAngle);
    _v3.cross(direction, desired);
    if (_v3.lengthSq() < 1e-10) {
        // pointing directly away - any perpendicular axis will do
        _v3.cross(direction, Math.abs(direction.y) < 0.9 ? Vec3.UP : Vec3.RIGHT);
    }
    _v3.normalize();
    _q0.setFromAxisAngle(_v3, step * math.RAD_TO_DEG);
    _q0.transformVector(direction, direction).normalize();
    return step;
};

// --------------------------------------------------------------------------------------------
// the camera, the sound and the aftermath of a blast - shared by everything below

const cameraForward = new Vec3(0, 0, -1);
const cameraUp = new Vec3(0, 1, 0);
const cameraOffset = new Vec3();
const deathCameraPosition = new Vec3();
const _cameraPosition = new Vec3();
const _lookAt = new Vec3();
let cameraFov = CAMERA_FOV;
let cameraShake = 0;

// the camera distance, set with the mouse wheel
let cameraZoom = 1;
let cameraTime = 0;

/**
 * How much to exaggerate an effect seen from far away. Most kills happen a few kilometers out, where a
 * fireball of a realistic size would be a few pixels - growing it with the distance is an arcade
 * liberty that keeps every kill readable.
 *
 * @param {Vec3} position - Where the effect is.
 * @returns {number} The size multiplier.
 */
const distanceBoost = (position) => Math.pow(math.clamp(camera.getPosition().distance(position) / 600, 1, 5), 0.8);

/**
 * Recent enemy missile launches, called out on the radar for a moment.
 *
 * @type {{ position: Vec3, time: number }[]}
 */
const radarPings = [];

/**
 * Calls out an enemy missile launch - a ping on the radar where it was fired from, and its sound.
 *
 * @param {Vec3} position - Where it was fired from.
 */
const pingLaunch = (position) => {
    radarPings.push({ position: position.clone(), time: 0 });
    if (radarPings.length > 6) {
        radarPings.shift();
    }
    audio?.ping();
};

/**
 * The places where something was just destroyed, marked on the display for a moment.
 *
 * @type {{ position: Vec3, time: number }[]}
 */
const killMarks = [];

/**
 * Marks a kill on the display.
 *
 * @param {Vec3} position - What to mark. A falling jet passes its own position, so the mark follows it.
 */
const markKill = (position) => {
    killMarks.push({ position, time: 0 });
    if (killMarks.length > 6) {
        killMarks.shift();
    }
};

/**
 * Shakes the gamepad, for a hit or a blast nearby.
 *
 * @param {number} strength - How hard, from zero to one.
 * @param {number} duration - How long, in milliseconds.
 */
const rumble = (strength, duration) => {
    app.gamepads?.pulse(0, Math.min(strength, 1), duration);
};

/**
 * Shakes the camera, harder for a bigger blast and softer the further away it is.
 *
 * @param {Vec3} position - Where the blast is.
 * @param {number} size - How big it is.
 */
const shakeFrom = (position, size) => {
    const distance = camera.getPosition().distance(position);
    const strength = size * (1 - math.smoothstep(0, 900, distance));
    cameraShake = Math.max(cameraShake, strength);
    if (strength > 0.1) {
        rumble(strength * 0.5, 250);
    }
};

/**
 * Plays a missile launch, quieter, later and duller the further from the camera it is.
 *
 * @param {Vec3} position - Where it launched.
 */
const playLaunch = (position) => {
    audio?.launch(camera.getPosition().distance(position));
};

/**
 * Plays an explosion.
 *
 * @param {Vec3} position - Where it went off.
 * @param {number} size - How big it is.
 */
const playExplosion = (position, size) => {
    audio?.explosion(camera.getPosition().distance(position), size);
};

/** @type {{ time: number, callback: Function }[]} */
const timers = [];

/**
 * Calls a function after a delay.
 *
 * @param {number} time - The delay, in seconds.
 * @param {Function} callback - The function.
 */
const delayed = (time, callback) => {
    timers.push({ time, callback });
};

// burning wrecks, and things hitting the water

/**
 * @typedef {object} WreckFire
 * @property {Vec3} position - Where it burns.
 * @property {number} time - How long it has left to burn, in seconds.
 * @property {number} timer - The time to the next puff of smoke.
 * @property {number} scale - The size of the column.
 */

/** @type {WreckFire[]} */
const wreckFires = [];

/**
 * Leaves something burning on the ground, with a column of smoke rising off it, sized to be seen from
 * where the camera is when it starts.
 *
 * @param {Vec3} position - Where it burns.
 * @param {number} duration - How long it burns, in seconds.
 * @returns {{ position: Vec3, time: number, timer: number, scale: number }} The fire, whose position
 * can be moved along with something burning as it drifts.
 */
const addWreckFire = (position, duration) => {
    const scale = Math.min(distanceBoost(position), 2.2);
    const fire = { position: position.clone(), time: duration, timer: 0, scale };
    wreckFires.push(fire);
    if (wreckFires.length > 24) {
        wreckFires.shift();
    }
    return fire;
};

/**
 * Feeds the smoke columns of the burning wrecks.
 *
 * @param {number} dt - The time step.
 */
const updateWreckFires = (dt) => {
    for (let i = wreckFires.length - 1; i >= 0; i--) {
        const fire = wreckFires[i];
        fire.time -= dt;
        if (fire.time <= 0) {
            wreckFires.splice(i, 1);
            continue;
        }
        const strength = Math.min(1, fire.time / 6);
        fire.timer -= dt;
        if (fire.timer <= 0) {
            fire.timer = 0.18;
            const { x, y, z } = fire.position;
            const scale = fire.scale * (0.7 + strength * 0.5);
            effects.spawn(
                PRESETS.wreckSmoke,
                x + (Math.random() - 0.5) * 6,
                y + 2,
                z + (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 2,
                (4 + Math.random() * 3) * fire.scale,
                (Math.random() - 0.5) * 2,
                scale,
                strength
            );
        }
        effects.glow(
            fire.position.x,
            fire.position.y + 1.5,
            fire.position.z,
            (3 + Math.random() * 1.5) * fire.scale,
            0.35 * strength
        );
    }
};

/**
 * Something hitting the water.
 *
 * @param {Vec3} position - Where it hit.
 */
const splash = (position) => {
    for (let i = 0; i < 24; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 14;
        effects.spawn(
            PRESETS.flareSmoke,
            position.x,
            1,
            position.z,
            Math.cos(angle) * speed,
            10 + Math.random() * 30,
            Math.sin(angle) * speed,
            3 + Math.random() * 2,
            0.9,
            1.5
        );
    }
};

// --------------------------------------------------------------------------------------------
// what a mission is made of

/**
 * A class of target - how many a mission has and how many are destroyed, and how they show on the
 * display. Every target belongs to one, and a new kind of target only needs a class of its own.
 *
 * @typedef {object} TargetClass
 * @property {string} name - What one is called, on its target box.
 * @property {string} counter - What the counter along the top of the screen calls them.
 * @property {string} objective - What the briefing calls them.
 * @property {string} kill - The message when one is destroyed.
 * @property {Color} color - The color it is marked in.
 * @property {Color} killColor - The color of the message when one is destroyed.
 * @property {string} marker - The shape of its marker on the screen.
 * @property {string} blip - The shape of its blip on the radar.
 * @property {number} blipSize - The size of its blip.
 * @property {boolean} heading - Whether its blip turns to show the way it is heading.
 * @property {number} hits - How many missiles it takes to destroy one.
 * @property {number} total - How many there are in the mission.
 * @property {number} killed - How many have been destroyed.
 */

/** @type {Record<string, TargetClass>} */
const TARGET_CLASSES = {
    fighter: {
        name: 'FIGHTER',
        counter: 'FIGHTERS',
        objective: 'ENEMY FIGHTERS',
        kill: 'SPLASH ONE',
        color: HUD_RED,
        killColor: HUD_GREEN,
        marker: 'diamond',
        blip: 'triangle',
        blipSize: 9,
        heading: true,
        hits: 1,
        total: 0,
        killed: 0
    },
    ground: {
        name: 'GROUND',
        counter: 'GROUND',
        objective: 'GROUND TARGETS',
        kill: 'TARGET DESTROYED',
        color: HUD_AMBER,
        killColor: HUD_AMBER,
        marker: 'square',
        blip: 'bar',
        blipSize: 6,
        heading: false,
        hits: 1,
        total: 0,
        killed: 0
    },
    ship: {
        name: 'SHIP',
        counter: 'SHIPS',
        objective: 'ENEMY SHIPS',
        kill: 'SHIP SUNK',
        color: HUD_AMBER,
        killColor: HUD_AMBER,
        marker: 'hexagon',
        blip: 'ship',
        blipSize: 15,
        heading: true,
        hits: SHIP_HITS,
        total: 0,
        killed: 0
    }
};
const TARGET_CLASS_LIST = Object.values(TARGET_CLASSES);

// --------------------------------------------------------------------------------------------
// the state of the mission

const MISSION_ACTIVE = 0;
const MISSION_COMPLETE = 1;
const MISSION_FAILED = 2;

// before the mission starts, while its briefing is on the screen - the jet circles, and nothing
// shoots at it yet
const MISSION_BRIEFING = 3;

let missionState = MISSION_BRIEFING;
let missionNumber = 1;
let missionTime = 0;
let airSpawned = 0;
let waveTimer = 0;
let score = 0;
let shots = 0;
let hits = 0;
let endTimer = 0;
let endReason = '';
let slowMotion = 0;

// the first few missiles fired at the player come with a reminder of how to get away from them
let missileHints = 0;
let wasTracked = false;

// --------------------------------------------------------------------------------------------
// aircraft

const ALIVE = 0;
const FALLING = 1;
const DEAD = 2;

/**
 * A jet - the player's or an enemy's. The flight state is kept here and pushed to the entity once a
 * frame, so that everything that flies is moved the same way.
 */
class Aircraft {
    kind = 'air';

    radius = 9;

    score = 100;

    // the number of the player's missiles homing on it
    incoming = 0;

    /**
     * @param {boolean} isPlayer - Whether this is the player's jet.
     */
    constructor(isPlayer) {
        this.isPlayer = isPlayer;

        /** @type {TargetClass|null} */
        this.targetClass = isPlayer ? null : TARGET_CLASSES.fighter;

        // the player flies the stealth fighter, whose control surfaces move, the enemy an older jet
        /** @type {JetModel} */
        this.model = isPlayer
            ? createPlayerJet(assets.playerJet, materials, missileMesh, true)
            : createJet(device, materials, LIVERIES.enemy, false, missileMesh, false);
        this.entity = this.model.entity;
        this.entity.enabled = false;
        app.root.addChild(this.entity);

        // a flame out of each nozzle
        this.flames = this.model.points.nozzles.map((nozzle) => {
            const flame = effects.createFlame(this.model.points.nozzleRadius * 0.85, 5.5);
            flame.setLocalPosition(nozzle);
            this.entity.addChild(flame);
            return flame;
        });

        this.position = new Vec3();
        this.rotation = new Quat();
        this.velocity = new Vec3();
        this.forward = new Vec3(0, 0, -1);
        this.up = new Vec3(0, 1, 0);
        this.right = new Vec3(1, 0, 0);
        this.speed = CRUISE_SPEED;

        // zero idle, one full military power, above one the afterburner
        this.throttle = 0.6;

        this.pitchRate = 0;
        this.rollRate = 0;
        this.yawRate = 0;
        this.gLoad = 1;
        this._lastForward = new Vec3(0, 0, -1);

        this.health = 100;
        this.state = DEAD;

        // the vapor off the wingtips in a hard turn, and the faint trail of the engine
        /** @type {Ribbon[]} */
        this.ribbons = [effects.ribbons.create(1.2, 5), effects.ribbons.create(1.2, 5)];
        this.exhaustRibbons = this.model.points.nozzles.map(() => effects.ribbons.create(2.4, 6));

        // the contrails, one out of each engine, taken while the jet flies and let go when it is shot
        // down, to hang in the sky behind it
        /** @type {Ribbon[]} */
        this.contrails = [];

        this.smokeTrail = new TrailState();

        // the smoke out of each engine of a damaged jet
        this.engineSmoke = this.model.points.nozzles.map(() => new TrailState());
        this.pylonTimers = [0, 0, 0, 0];
        this.nextPylon = 0;
        this.spin = new Vec3();
        this.strobe = Math.random() * 1.3;
        this.burnTime = 0;

        // the enemy's mind
        this.ai = {
            mode: 'patrol',
            timer: 0,
            fireCooldown: 0,
            evadeCooldown: 0,
            evade: new Vec3(),
            accel: new Vec3(),
            patrolCenter: new Vec3(),
            patrolSign: 1,
            skill: 0
        };
    }

    get targetable() {
        return this.state === ALIVE;
    }

    /**
     * Puts the jet in the air.
     *
     * @param {Vec3} position - Where it is.
     * @param {Vec3} forward - The direction it flies in.
     * @param {number} speed - How fast it flies.
     */
    launch(position, forward, speed) {
        this.position.copy(position);
        this.forward.copy(forward).normalize();
        orientation(this.forward, Vec3.UP, this.rotation);
        this.refreshAxes();
        this._lastForward.copy(this.forward);
        this.speed = speed;
        this.velocity.copy(this.forward).mulScalar(speed);
        this.pitchRate = 0;
        this.rollRate = 0;
        this.yawRate = 0;
        this.gLoad = 1;
        this.health = this.isPlayer ? PLAYER_HEALTH : 100;
        this.state = ALIVE;
        this.incoming = 0;
        this.burnTime = 0;
        this.entity.enabled = true;
        this.flames.forEach((flame) => {
            flame.enabled = true;
        });
        this.model.pylonMissiles.forEach((missile) => {
            missile.enabled = true;
        });
        this.pylonTimers.fill(0);
        this.ribbons.forEach((ribbon) => ribbon.reset());
        this.exhaustRibbons.forEach((ribbon) => ribbon.reset());
        this.releaseContrails();
        this.contrails = this.model.points.nozzles.map(() =>
            effects.trails.acquire(CONTRAIL_LIFE, CONTRAIL_SPACING, CONTRAIL_GROWTH, 1, CONTRAIL_GAP)
        );
        this.smokeTrail.reset();
        this.engineSmoke.forEach((trail) => trail.reset());
        this.ai.accel.set(0, 0, 0);
        this.sync();
    }

    /**
     * Takes the jet out of the world.
     */
    remove() {
        this.state = DEAD;
        this.entity.enabled = false;
        this.ribbons.forEach((ribbon) => ribbon.reset());
        this.exhaustRibbons.forEach((ribbon) => ribbon.reset());
        this.releaseContrails();
    }

    /**
     * Stops laying the contrails, and leaves them to fade.
     */
    releaseContrails() {
        this.contrails.forEach((ribbon) => effects.trails.release(ribbon));
        this.contrails.length = 0;
    }

    /**
     * Updates the direction vectors from the orientation.
     */
    refreshAxes() {
        this.rotation.transformVector(Vec3.FORWARD, this.forward);
        this.rotation.transformVector(Vec3.UP, this.up);
        this.rotation.transformVector(Vec3.RIGHT, this.right);
    }

    /**
     * Pushes the flight state to the entity.
     */
    sync() {
        this.entity.setPosition(this.position);
        this.entity.setRotation(this.rotation);
    }

    /**
     * Works out the load factor from how the nose moved this frame - the turn rate, the speed, and
     * gravity, along the jet's own up axis. The arcade turn rates would pull far more than any pilot
     * survives, so the turn is scaled down to a believable reading, nine or so in the hardest turn.
     *
     * @param {number} dt - The time step.
     */
    measureLoad(dt) {
        if (dt <= 0) {
            return;
        }
        _v0.sub2(this.forward, this._lastForward).mulScalar((this.speed / dt) * 0.33);
        _v0.y += 9.81;
        const g = _v0.dot(this.up) / 9.81;
        this.gLoad = math.lerp(this.gLoad, g, 1 - Math.exp(-6 * dt));
        this._lastForward.copy(this.forward);
    }

    /**
     * The point of an attachment in the world.
     *
     * @param {Vec3} local - The attachment point, in the jet's space.
     * @param {Vec3} out - Receives the world position.
     * @returns {Vec3} The world position.
     */
    worldPoint(local, out) {
        this.rotation.transformVector(local, out);
        return out.add(this.position);
    }

    /**
     * Takes a missile off the next loaded pylon, alternating sides.
     *
     * @param {Vec3} out - Receives the world position it leaves from.
     */
    takePylon(out) {
        const pylons = this.model.points.pylons;
        let index = this.nextPylon;
        for (let i = 0; i < pylons.length; i++) {
            const candidate = (this.nextPylon + i) % pylons.length;
            if (this.pylonTimers[candidate] <= 0) {
                index = candidate;
                break;
            }
        }
        this.nextPylon = (index + 1) % pylons.length;
        this.pylonTimers[index] = 1.4;
        this.model.pylonMissiles[index].enabled = false;
        this.worldPoint(pylons[index], out);
    }

    /**
     * Updates the flames, vapor trails, lights and pylons.
     *
     * @param {number} dt - The time step.
     * @param {number} missilesLeft - How many missiles it still carries, which limits the pylons that
     * are reloaded.
     */
    updateVisuals(dt, missilesLeft) {
        const alive = this.state === ALIVE;

        const burner = Math.max(0, this.throttle - 1);
        const nozzles = this.model.points.nozzles;
        for (let i = 0; i < nozzles.length; i++) {
            effects.setFlame(
                this.flames[i],
                alive ? 0.2 + this.throttle * 0.35 + burner * 0.45 : 0,
                alive ? 0.2 + burner * 3 : 0
            );

            // the hot glow inside the nozzle, seen from behind
            if (alive) {
                this.worldPoint(nozzles[i], _v0);
                effects.glow(_v0.x, _v0.y, _v0.z, 0.36 + burner * 0.18, (0.05 + burner * 0.35) * effects.emissiveScale);
            }
        }

        // the control surfaces follow the stick, and the air brake comes out as the throttle closes
        const brake = alive ? math.clamp((0.45 - this.throttle) / 0.3, 0, 1) : 0;
        this.model.animate?.(
            alive ? this.pitchRate / PITCH_RATE : 0,
            alive ? this.rollRate / ROLL_RATE : 0,
            alive ? this.yawRate / YAW_RATE : 0,
            brake,
            alive ? this.throttle : 0.65,
            dt
        );

        // Vapor streams off the wingtips once the turn is pulling enough g, and the engine leaves a
        // faint trail at all times, and a contrail up high.
        const time = effects.time;
        const vapor = alive ? math.smoothstep(4, 7.5, this.gLoad) * 0.75 : 0;
        for (let i = 0; i < 2; i++) {
            this.worldPoint(this.model.points.wingtips[i], _v0);
            this.ribbons[i].push(_v0.x, _v0.y, _v0.z, time, 0.22, vapor);
        }
        const exhaust = alive ? 0.05 : 0;
        const contrail =
            math.smoothstep(CONTRAIL_ALTITUDE_START, CONTRAIL_ALTITUDE_FULL, this.position.y) * CONTRAIL_INTENSITY;
        for (let i = 0; i < nozzles.length; i++) {
            this.worldPoint(nozzles[i], _v0);
            this.exhaustRibbons[i].push(_v0.x, _v0.y, _v0.z, time, 0.5, exhaust);
            this.contrails[i]?.push(_v0.x, _v0.y, _v0.z, time, CONTRAIL_WIDTH, contrail);
        }

        // navigation lights glow, and the tail strobe flashes
        const lights = this.model.lights;
        this.strobe = (this.strobe + dt) % 1.3;
        if (alive) {
            for (let i = 0; i < 2; i++) {
                const p = lights[i].getPosition();
                effects.spawn(i === 0 ? PRESETS.navRed : PRESETS.navGreen, p.x, p.y, p.z);
            }
            const flash = this.strobe < 0.06;
            lights[2].enabled = flash;
            if (flash) {
                const p = lights[2].getPosition();
                effects.glow(p.x, p.y, p.z, 0.8, 0.45);
            }
        }

        // reload the pylons, as long as there is anything left to load them with
        for (let i = 0; i < this.pylonTimers.length; i++) {
            if (this.pylonTimers[i] > 0) {
                this.pylonTimers[i] -= dt;
            }
            const loaded = this.pylonTimers[i] <= 0 && missilesLeft > i;
            this.model.pylonMissiles[i].enabled = loaded && this.state !== DEAD;
        }

        // a damaged jet trails smoke, and catches fire when it is badly hit
        if (alive && this.health < 70) {
            const damage = 1 - this.health / 70;
            for (let i = 0; i < nozzles.length; i++) {
                this.worldPoint(nozzles[i], _v1);
                effects.trail(this.engineSmoke[i], _v1, 6 - damage * 3, (x, y, z) => {
                    effects.spawn(
                        PRESETS.burningSmoke,
                        x,
                        y,
                        z,
                        this.velocity.x * 0.2,
                        this.velocity.y * 0.2,
                        this.velocity.z * 0.2,
                        0.35 + damage * 0.5,
                        0.35 + damage * 0.6,
                        0.6
                    );
                });
            }
        }
    }

    /**
     * Shoots the jet down. It blows up and falls out of the sky, spinning and burning.
     */
    kill() {
        this.state = FALLING;
        this.burnTime = 0;
        this.health = 0;
        this.velocity.copy(this.forward).mulScalar(this.speed * 0.85);
        this.spin.set(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 1.5,
            (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 3)
        );
        effects.airExplosion(this.position, this.velocity, 1.1 * distanceBoost(this.position));
        this.smokeTrail.reset();
        this.engineSmoke.forEach((trail) => trail.reset());
        this.releaseContrails();
        this.flames.forEach((flame) => {
            flame.enabled = false;
        });
        playExplosion(this.position, 1.2);
        if (!this.isPlayer) {
            markKill(this.position);
        }
    }

    /**
     * Drops a shot down jet, trailing black smoke and fire, until it hits the ground.
     *
     * @param {number} dt - The time step.
     * @returns {boolean} True when it hit the ground this frame.
     */
    updateFalling(dt) {
        this.burnTime += dt;

        this.velocity.y -= 9.81 * 1.6 * dt;
        this.velocity.mulScalar(Math.exp(-0.25 * dt));
        this.position.add(_v0.copy(this.velocity).mulScalar(dt));

        // spin around its own axes while the nose drops to follow the fall
        _q0.setFromEulerAngles(
            this.spin.x * math.RAD_TO_DEG * dt,
            this.spin.y * math.RAD_TO_DEG * dt,
            this.spin.z * math.RAD_TO_DEG * dt
        );
        this.rotation.mul(_q0);
        this.refreshAxes();
        _v1.copy(this.velocity).normalize();
        _v2.copy(this.forward);
        if (turnTowards(_v2, _v1, 0.9 * dt) > 0) {
            _q1.setFromAxisAngle(_v3, Math.acos(math.clamp(this.forward.dot(_v2), -1, 1)) * math.RAD_TO_DEG);
            this.rotation.mul2(_q1, this.rotation).normalize();
            this.refreshAxes();
        }

        // pouring black smoke, with fire still in it, and the odd piece breaking off
        const boost = Math.sqrt(distanceBoost(this.position));
        effects.trail(this.smokeTrail, this.position, 3.2 * boost, (x, y, z) => {
            randomDirection(_v2);
            effects.spawn(
                PRESETS.burningSmoke,
                x + _v2.x,
                y + _v2.y,
                z + _v2.z,
                this.velocity.x * 0.15 + _v2.x * 3,
                this.velocity.y * 0.15 + _v2.y * 3,
                this.velocity.z * 0.15 + _v2.z * 3,
                (0.8 + Math.random() * 0.4) * boost
            );
        });
        if (Math.random() < dt * 3) {
            randomDirection(_v2);
            effects.spawn(
                PRESETS.debris,
                this.position.x,
                this.position.y,
                this.position.z,
                this.velocity.x + _v2.x * 15,
                this.velocity.y + _v2.y * 15,
                this.velocity.z + _v2.z * 15,
                0.5
            );
        }

        // the flames licking off the airframe
        if (Math.random() < dt * 20) {
            randomDirection(_v2);
            effects.spawn(
                PRESETS.fireball,
                this.position.x + _v2.x * 2,
                this.position.y + _v2.y * 2,
                this.position.z + _v2.z * 2,
                this.velocity.x * 0.6,
                this.velocity.y * 0.6,
                this.velocity.z * 0.6,
                0.3 * boost,
                1,
                0.5
            );
        }
        effects.glow(this.position.x, this.position.y, this.position.z, (4 + Math.random() * 2) * boost, 0.5);

        this.sync();
        return this.position.y <= groundHeight(this.position.x, this.position.z) + 1;
    }

    /**
     * Ends the fall in a fireball where it hit, leaving a burning wreck smoking on the ground.
     */
    crash() {
        const ground = groundHeight(this.position.x, this.position.z);
        _v0.set(this.position.x, ground, this.position.z);
        if (this.isPlayer) {
            deathCameraPosition.copy(_v0);
        }
        if (terrain.heightAt(_v0.x, _v0.z) < 0) {
            splash(_v0);
        } else {
            effects.groundExplosion(_v0, 1.5 * distanceBoost(_v0));
            addWreckFire(_v0, 14);
        }
        playExplosion(_v0, 1.5);
        shakeFrom(_v0, 1.5);
        this.remove();
    }
}

// --------------------------------------------------------------------------------------------
// the player

const player = new Aircraft(true);
let missilesLeft = 0;
let flaresLeft = FLARE_COUNT;
let fireCooldown = 0;
let flareCooldown = 0;

// how long since the player was last hit, which the hull repairs after
let timeSinceHit = 0;

// --------------------------------------------------------------------------------------------
// the enemy fighters

/** @type {Aircraft[]} */
const enemies = [];
for (let i = 0; i < MAX_ENEMIES; i++) {
    enemies.push(new Aircraft(false));
}

// --------------------------------------------------------------------------------------------
// missiles and flares

/**
 * Anything a missile can be guided onto.
 *
 * @typedef {object} Target
 * @property {Vec3} position - Where it is.
 * @property {Vec3} velocity - How it moves.
 * @property {boolean} targetable - Whether it can still be hit.
 * @property {string} kind - 'air', 'ground', 'sea' or 'flare'.
 * @property {number} radius - Its size.
 * @property {number} incoming - The number of the player's missiles homing on it.
 * @property {TargetClass|null} [targetClass] - What the mission counts it as, if anything.
 * @property {number} [score] - The points for destroying it.
 */

/**
 * The weapon of a unit that shoots at the player, for the threat display.
 *
 * @typedef {object} UnitWeapon
 * @property {string} label - What the threat display calls it.
 * @property {number} range - How far it reaches.
 */

class Missile {
    active = false;

    position = new Vec3();

    previous = new Vec3();

    direction = new Vec3();

    speed = 0;

    age = 0;

    owner = 'player';

    /** @type {MissileSpec} */
    spec = PLAYER_MISSILE;

    /** @type {Target|null} */
    target = null;

    trail = new TrailState();

    // The path it flies. Each missile picks a side to swing in on its target from, and a weave, so a
    // salvo fans out and converges rather than flying in a bundle down one straight line.
    curve = new Vec3();

    curveAmount = 0;

    weavePhase = 0;

    weaveRate = 0;

    weaveAmount = 0;

    // the direction it was fired in, which an unguided missile settles back onto after its kick
    heading = new Vec3();

    // the direction it swings out to once the motor lights
    kickDirection = new Vec3();

    // released from a pylon, it falls clear of the jet along this axis before the motor lights
    dropAxis = new Vec3();

    dropSpeed = 0;

    ignited = false;

    constructor() {
        this.entity = new Entity('Missile');
        this.entity.addComponent('render', {
            meshInstances: [new MeshInstance(missileMesh, materials.paint)],
            castShadows: false
        });
        this.entity.enabled = false;
        app.root.addChild(this.entity);

        // A continuous line under the puffs of smoke, which keeps the young trail from breaking up
        // into separate puffs close to the camera, and stays on after them. Taken for each flight.
        /** @type {Ribbon|null} */
        this.ribbon = null;
    }
}

// enough for every missile that can be in the air at once, created up front so firing never stalls
/** @type {Missile[]} */
const missiles = [];
for (let i = 0; i < 40; i++) {
    missiles.push(new Missile());
}

/**
 * A decoy flare. Simulated here so missiles can chase it, and drawn as a glow with a smoke trail.
 *
 * @typedef {object} Flare
 * @property {Vec3} position - Where it is.
 * @property {Vec3} velocity - How it moves.
 * @property {number} life - How long it has left to burn.
 * @property {boolean} targetable - Whether it is still burning.
 * @property {string} kind - Always 'flare'.
 * @property {number} radius - Its size.
 * @property {number} incoming - Unused.
 * @property {TrailState} trail - Its smoke trail.
 */

/** @type {Flare[]} */
const flares = [];

/**
 * Points a missile's model along its flight.
 *
 * @param {Missile} missile - The missile.
 */
const placeMissile = (missile) => {
    missile.entity.setPosition(missile.position);
    orientation(missile.direction, Math.abs(missile.direction.y) > 0.95 ? Vec3.RIGHT : Vec3.UP, _q0);
    missile.entity.setRotation(_q0);
};

/**
 * Lights a missile's motor, with a puff of smoke.
 *
 * @param {Missile} missile - The missile.
 */
const igniteMissile = (missile) => {
    missile.ignited = true;
    const position = missile.position;
    for (let i = 0; i < 6; i++) {
        randomDirection(_v2);
        effects.spawn(
            PRESETS.missileSmoke,
            position.x,
            position.y,
            position.z,
            _v2.x * 4,
            _v2.y * 4,
            _v2.z * 4,
            missile.spec.smoke * 0.9
        );
    }
    playLaunch(position);
};

/**
 * Lets go of a missile's trail, leaving it to fade out in the sky.
 *
 * @param {Missile} missile - The missile.
 */
const releaseMissileTrail = (missile) => {
    if (missile.ribbon) {
        effects.trails.release(missile.ribbon);
        missile.ribbon = null;
    }
};

/**
 * Fires a missile.
 *
 * @param {MissileSpec} spec - What kind of missile.
 * @param {string} owner - 'player' or 'enemy'.
 * @param {Vec3} position - Where it leaves from.
 * @param {Vec3} direction - The direction it leaves in.
 * @param {number} speed - The speed it leaves at.
 * @param {Target|null} target - What it homes on, or null to fly straight.
 * @param {Vec3|null} [dropAxis] - The direction it falls clear of its pylon in, or null when it
 * leaves a launcher under its own power.
 * @param {Vec3|null} [side] - The side it swings out to and arcs in on its target from, or null for
 * a random one.
 * @returns {Missile} The missile.
 */
const fireMissile = (spec, owner, position, direction, speed, target, dropAxis = null, side = null) => {
    let missile = missiles.find((m) => !m.active);
    if (!missile) {
        missile = new Missile();
        missiles.push(missile);
    }
    // copied first, as the scratch vectors below may be the ones passed in
    missile.dropAxis.copy(dropAxis ?? Vec3.ZERO);
    missile.dropSpeed = 0;
    missile.ignited = false;
    missile.active = true;
    missile.spec = spec;
    missile.owner = owner;
    missile.position.copy(position);
    missile.previous.copy(position);
    missile.direction.copy(direction).normalize();
    missile.heading.copy(missile.direction);
    missile.speed = speed;
    missile.age = 0;
    missile.target = target;

    // the side it swings in from - any direction square to the launch, lifted for a lofted shot
    if (side) {
        _v2.copy(side);
    } else {
        randomDirection(_v2);
    }
    _v2.sub(_v3.copy(missile.direction).mulScalar(_v2.dot(missile.direction)));
    _v2.y += spec.loft;
    if (_v2.lengthSq() < 1e-4) {
        _v2.cross(missile.direction, Vec3.UP);
    }
    missile.curve.copy(_v2.normalize());
    missile.curveAmount = spec.curve * (0.5 + Math.random() * 0.8);
    missile.weavePhase = Math.random() * Math.PI * 2;
    missile.weaveRate = 2 + Math.random() * 2.5;
    missile.weaveAmount = spec.weave * (0.4 + Math.random());

    // and once its motor lights it swings out towards that side
    const kick = Math.tan(spec.kick * (0.5 + Math.random() * 0.5) * math.DEG_TO_RAD);
    missile.kickDirection.copy(missile.direction).add(_v3.copy(missile.curve).mulScalar(kick)).normalize();
    missile.trail.reset();
    releaseMissileTrail(missile);
    missile.ribbon = effects.trails.acquire(MISSILE_TRAIL_LIFE, MISSILE_TRAIL_SPACING, MISSILE_TRAIL_GROWTH, 1, 0);
    const scale = spec.scale ?? 1;
    missile.entity.setLocalScale(scale, scale, scale);
    missile.entity.enabled = true;
    placeMissile(missile);

    // the warning comes with the release, not the motor
    if (owner === 'enemy') {
        pingLaunch(position);
    }
    return missile;
};

/**
 * The number of enemy missiles in the air.
 *
 * @returns {number} The count.
 */
const enemyMissileCount = () => {
    let count = 0;
    for (let i = 0; i < missiles.length; i++) {
        if (missiles[i].active && missiles[i].owner === 'enemy') {
            count++;
        }
    }
    return count;
};

/**
 * Releases a salvo of flares.
 *
 * @param {Aircraft} aircraft - The jet releasing them.
 * @param {number} count - How many.
 * @param {string} decoys - The owner of the missiles they may decoy.
 * @param {number} chance - The chance each missile homing on the jet is decoyed.
 */
const releaseFlares = (aircraft, count, decoys, chance) => {
    /** @type {Flare[]} */
    const released = [];
    for (let i = 0; i < count; i++) {
        // fanned out sideways and down, falling back slowly enough to stay in view behind the jet
        const side = (i % 2 === 0 ? 1 : -1) * (0.6 + Math.random() * 0.6);
        _v0.copy(aircraft.velocity).mulScalar(0.88);
        _v0.add(_v1.copy(aircraft.right).mulScalar(side * 30));
        _v0.add(_v1.copy(aircraft.up).mulScalar(-12 - Math.random() * 18));
        aircraft.worldPoint(_v2.set(0, -0.5, 4), _v1);
        const flare = {
            position: _v1.clone(),
            velocity: _v0.clone(),
            life: 2.6 + Math.random() * 0.8,
            targetable: true,
            kind: 'flare',
            radius: 1,
            incoming: 0,
            trail: new TrailState()
        };
        flares.push(flare);
        released.push(flare);
    }

    for (let i = 0; i < missiles.length; i++) {
        const missile = missiles[i];
        if (
            missile.active &&
            missile.owner === decoys &&
            missile.target === aircraft &&
            missile.position.distance(aircraft.position) < 3500 &&
            Math.random() < chance
        ) {
            missile.target = released[Math.floor(Math.random() * released.length)];
        }
    }
    if (aircraft === player) {
        audio?.flare();
    }
};

/**
 * Burns down the flares.
 *
 * @param {number} dt - The time step.
 */
const updateFlares = (dt) => {
    for (let i = flares.length - 1; i >= 0; i--) {
        const flare = flares[i];
        flare.life -= dt;
        if (flare.life <= 0) {
            flare.targetable = false;
            flares.splice(i, 1);
            continue;
        }
        flare.velocity.mulScalar(Math.exp(-0.45 * dt));
        flare.velocity.y -= 9 * dt;
        flare.position.add(_v0.copy(flare.velocity).mulScalar(dt));
        const flicker = 0.8 + Math.random() * 0.4;
        effects.glow(
            flare.position.x,
            flare.position.y,
            flare.position.z,
            2.2 * flicker,
            3.2 * Math.min(1, flare.life)
        );
        effects.trail(flare.trail, flare.position, 1.5, (x, y, z) => {
            effects.spawn(PRESETS.flareSmoke, x, y, z, 0, 0, 0, 0.9);
        });
    }
};

// --------------------------------------------------------------------------------------------
// ground targets

/**
 * A vehicle or building of an enemy base.
 */
class GroundUnit {
    kind = 'ground';

    targetClass = TARGET_CLASSES.ground;

    incoming = 0;

    velocity = new Vec3();

    /**
     * @param {string} type - What it is - 'sam', 'tank', 'radar' or 'fuel'.
     * @param {GroundModel} model - Its model.
     * @param {Vec3} position - Where it stands.
     * @param {number} yaw - Which way it faces.
     */
    constructor(type, model, position, yaw) {
        this.type = type;
        this.model = model;
        this.entity = model.entity;
        this.radius = model.radius;
        this.position = position.clone();
        this.alive = true;
        this.cooldown = 6 + Math.random() * SAM_COOLDOWN;
        this.turretYaw = Math.random() * 360;
        this.yaw = yaw;
        this.score = type === 'sam' ? 150 : 75;

        /** @type {UnitWeapon|null} */
        this.weapon = type === 'sam' ? { label: 'SAM', range: SAM_RANGE } : null;

        this.entity.setPosition(position);
        this.entity.setEulerAngles(0, yaw, 0);
        app.root.addChild(this.entity);

        // the point it is aimed at by the player, raised off the ground to its middle
        this.position.y += 2;
    }

    get targetable() {
        return this.alive;
    }

    /**
     * Takes a missile.
     *
     * @returns {boolean} True if that destroyed it.
     */
    hit() {
        this.destroy();
        return true;
    }

    /**
     * Turns the turret, and fires at the player if it is a launcher and the player is in range.
     *
     * @param {number} dt - The time step.
     */
    update(dt) {
        if (!this.alive) {
            return;
        }

        const turret = this.model.turret;
        if (this.type === 'radar') {
            this.turretYaw += 60 * dt;
        } else if (turret && player.state === ALIVE) {
            // track the player, as fast as the turret turns
            const dx = player.position.x - this.position.x;
            const dz = player.position.z - this.position.z;
            const desired = Math.atan2(-dx, -dz) * math.RAD_TO_DEG - this.yaw;
            const delta = ((desired - this.turretYaw + 540) % 360) - 180;
            this.turretYaw += math.clamp(delta, -45 * dt, 45 * dt);
        }
        turret?.setLocalEulerAngles(0, this.turretYaw, 0);

        if (this.type !== 'sam' || player.state !== ALIVE || missionState !== MISSION_ACTIVE) {
            return;
        }

        this.cooldown -= dt;
        const distance = player.position.distance(this.position);
        if (this.cooldown <= 0 && distance < SAM_RANGE && enemyMissileCount() < MAX_ENEMY_MISSILES + 1) {
            this.cooldown = SAM_COOLDOWN * (0.8 + Math.random() * 0.5);
            const launcher = /** @type {Entity} */ (turret);
            launcher.getWorldTransform().transformPoint(this.model.launchPoint, _v0);

            // leaves the rail angled up, the way the launcher points, and only then turns to guide
            _v1.copy(launcher.forward).mulScalar(Math.cos(35 * math.DEG_TO_RAD));
            _v1.y += Math.sin(35 * math.DEG_TO_RAD);
            _v1.normalize();
            fireMissile(SAM_MISSILE, 'enemy', _v0, _v1, 40, player);
            hud.message('SAM LAUNCH', '', 1.6, HUD_RED);
        }
    }

    /**
     * Blows it up, leaving a burning wreck.
     */
    destroy() {
        this.alive = false;
        const scale = this.type === 'fuel' ? 2.4 : 1.1;
        const at = this.entity.getPosition().clone();
        effects.groundExplosion(at, scale * distanceBoost(at));
        markKill(at);
        if (this.type === 'fuel') {
            // the tanks go up in a second, bigger fireball a moment later
            delayed(0.25, () => {
                at.y += 10;
                effects.airExplosion(at, Vec3.ZERO, 2.2);
                playExplosion(at, 1.5);
            });
        }
        addWreckFire(at, this.type === 'fuel' ? 40 : 25);
        playExplosion(at, scale);
        shakeFrom(at, scale);

        // the wreck - burnt, and knocked askew
        this.entity.findComponents('render').forEach((render) => {
            render.meshInstances.forEach((meshInstance) => {
                meshInstance.material = materials.burnt;
            });
        });
        this.entity.setEulerAngles(
            (Math.random() - 0.5) * 8,
            this.yaw + (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 8
        );
        if (this.model.turret) {
            this.model.turret.setLocalEulerAngles(-12 - Math.random() * 20, this.turretYaw + 30, 10);
        }
    }

    /**
     * Takes it out of the world.
     */
    remove() {
        this.entity.destroy();
    }
}

// every unit of the mission other than the fighters - on the ground and at sea
/** @type {(GroundUnit|Ship)[]} */
const units = [];

// the mix of units for each base - every base is guarded by a missile launcher
const BASE_LAYOUTS = [
    ['sam', 'radar', 'tank', 'fuel'],
    ['sam', 'tank', 'tank', 'fuel'],
    ['sam', 'radar', 'sam', 'tank'],
    ['sam', 'fuel', 'tank', 'radar']
];

const UNIT_FACTORIES = {
    sam: createSamLauncher,
    tank: createTank,
    radar: createRadar,
    fuel: createFuelTanks
};

/**
 * Builds the enemy bases.
 *
 * @param {number} count - How many ground targets to place in total.
 */
const createGroundUnits = (count) => {
    const sites = terrain.sites;
    if (!sites.length) {
        return;
    }

    // every base gets a mix picked at random
    const layouts = sites.map(() => BASE_LAYOUTS[Math.floor(Math.random() * BASE_LAYOUTS.length)]);
    for (let i = 0; i < count; i++) {
        const siteIndex = i % sites.length;
        const site = sites[siteIndex];
        const slot = Math.floor(i / sites.length);
        const layout = layouts[siteIndex];
        const type = layout[slot % layout.length];

        // spread around the pad, clear of each other
        const angle = slot * 2.1 + siteIndex;
        const distance = slot === 0 ? 0 : 32 + slot * 9;
        const x = site.x + Math.cos(angle) * distance;
        const z = site.z + Math.sin(angle) * distance;
        _v0.set(x, terrain.heightAt(x, z), z);
        const model = UNIT_FACTORIES[type](device, materials);
        units.push(new GroundUnit(type, model, _v0, Math.random() * 360));
    }
};

// --------------------------------------------------------------------------------------------
// ships

/**
 * The depth of the water at a point.
 *
 * @param {number} x - The x coordinate.
 * @param {number} z - The z coordinate.
 * @returns {number} The depth, negative on land.
 */
const waterDepth = (x, z) => -terrain.heightAt(x, z);

/**
 * An enemy frigate. It sails round the open water, turning away from the shore and back towards the
 * middle of the combat area, with a wake spreading out behind it and spray thrown up by its bow, and
 * fires salvos of heavy missiles at the player from long range. The first hit sets it on fire, the
 * second sinks it.
 */
class Ship {
    kind = 'sea';

    targetClass = TARGET_CLASSES.ship;

    score = 250;

    incoming = 0;

    velocity = new Vec3();

    // the way the bow points
    forward = new Vec3();

    /** @type {UnitWeapon} */
    weapon = { label: 'SHIP', range: SHIP_RANGE };

    /**
     * @param {ShipModel} model - Its model.
     * @param {number} x - The x coordinate it starts at.
     * @param {number} z - The z coordinate it starts at.
     * @param {number} yaw - The way it heads, in degrees.
     */
    constructor(model, x, z, yaw) {
        this.model = model;
        this.entity = model.entity;
        this.radius = model.radius;
        this.alive = true;
        this.yaw = yaw;
        this.desiredYaw = yaw;
        this.yawRate = 0;
        this.speed = SHIP_SPEED * (0.85 + Math.random() * 0.3);
        this.hits = 0;
        this.steerTimer = 0;
        this.time = Math.random() * 100;

        // where it floats, and the middle of the ship above the deck, which missiles are aimed at
        this.origin = new Vec3(x, 0, z);
        this.position = new Vec3();

        // the salvo being fired, one missile after another from the cells
        this.cooldown = 6 + Math.random() * SHIP_COOLDOWN;
        this.salvo = 0;
        this.salvoTimer = 0;
        // the side the next missile leans out to, in degrees about the vertical, and the turn to the
        // one after it, which spreads a salvo evenly round the ship
        this.salvoSide = 0;
        this.salvoStep = 0;
        this.nextCell = Math.floor(Math.random() * model.cells.length);

        // the gun's aim
        this.turretYaw = 0;
        this.barrelPitch = 0;

        // sinking, once it has been sunk
        this.sinkTime = 0;
        this.list = (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 10);
        /** @type {{ position: Vec3, time: number }|null} */
        this.fire = null;
        this.burnPoint = new Vec3();

        this.wake = effects.wakes.create(model.length, model.beam);
        this.spray = new TrailState();
        app.root.addChild(this.entity);
        this.place();
    }

    get targetable() {
        return this.alive;
    }

    /**
     * Places the model - heeling into its turns, and rolling and pitching a little on the swell, or
     * listing and settling as it sinks.
     */
    place() {
        const t = this.time;
        let roll = Math.sin(t * 0.47) * 1.2 + Math.sin(t * 0.21 + 1.3) * 0.6 - this.yawRate * 3.5;
        let pitch = Math.sin(t * 0.33 + 0.4) * 0.5;
        let heave = Math.sin(t * 0.61) * 0.25;
        if (!this.alive) {
            const sink = math.smoothstep(0, 32, this.sinkTime);
            roll += this.list * sink;
            pitch += 5 * sink * sink;
            heave -= 26 * sink * sink;
        }
        this.entity.setPosition(this.origin.x, this.origin.y + heave, this.origin.z);
        this.entity.setEulerAngles(0, this.yaw, 0);
        this.entity.rotateLocal(pitch, 0, roll);
        this.entity.getWorldTransform().transformPoint(this.model.center, this.position);
    }

    /**
     * Picks a heading - the current one if the water ahead is deep and open, or the nearest turn either
     * way that leads somewhere deeper, and back towards the middle near the edge of the combat area.
     */
    steer() {
        const { x, z } = this.origin;
        let best = this.desiredYaw;
        let bestScore = -Infinity;
        for (const turn of [0, 20, -20, 45, -45, 80, -80, 130, -130, 180]) {
            const yaw = this.yaw + turn;
            const dx = -Math.sin(yaw * math.DEG_TO_RAD);
            const dz = -Math.cos(yaw * math.DEG_TO_RAD);
            let clear = 0;
            for (const distance of [150, 350, 650, 1000]) {
                if (waterDepth(x + dx * distance, z + dz * distance) < SHIP_DEPTH) {
                    break;
                }
                clear++;
            }
            const inward = -(dx * x + dz * z) / Math.max(Math.hypot(x, z), 1);
            const outside = math.smoothstep(COMBAT_RADIUS * 0.6, COMBAT_RADIUS * 0.85, Math.hypot(x, z));
            const score = clear * 10 - Math.abs(turn) * 0.04 + inward * outside * 25;
            if (score > bestScore) {
                bestScore = score;
                best = yaw;
            }
        }
        this.desiredYaw = best;
    }

    /**
     * Sails on, aims the gun, and fires at the player.
     *
     * @param {number} dt - The time step.
     */
    update(dt) {
        this.time += dt;
        if (!this.alive) {
            this.updateSinking(dt);
            return;
        }

        // the helm
        this.steerTimer -= dt;
        if (this.steerTimer <= 0) {
            this.steerTimer = 1;
            this.steer();
        }
        const delta = ((this.desiredYaw - this.yaw + 540) % 360) - 180;
        const rate = math.clamp(delta * 0.3, -SHIP_TURN_RATE, SHIP_TURN_RATE);
        this.yawRate += (rate - this.yawRate) * Math.min(1, dt * 0.6);
        this.yaw += this.yawRate * dt;
        this.forward.set(-Math.sin(this.yaw * math.DEG_TO_RAD), 0, -Math.cos(this.yaw * math.DEG_TO_RAD));
        this.velocity.copy(this.forward).mulScalar(this.speed);
        this.origin.add(_v0.copy(this.velocity).mulScalar(dt));
        this.place();
        this.updateWater();
        this.updateBurning();
        this.updateWeapons(dt);
    }

    /**
     * Lays the wake, and throws spray off the bow.
     */
    updateWater() {
        const transform = this.entity.getWorldTransform();
        transform.transformPoint(this.model.bow, _v1);
        this.wake.update(_v1.x, _v1.z, this.forward.x, this.forward.z, this.speed, effects.time);

        // spray off both sides of the bow, a little way back from the stem where the bow wave breaks
        _v1.add(_v2.copy(this.forward).mulScalar(-9));
        _v1.y = 0.5;
        const side = _v3.set(-this.forward.z, 0, this.forward.x);
        effects.trail(this.spray, _v1, 2.4, (x, y, z) => {
            for (const s of [-1, 1]) {
                const out = 2.5 + Math.random() * 3;
                effects.spawn(
                    PRESETS.spray,
                    x + side.x * s * 3.5,
                    y,
                    z + side.z * s * 3.5,
                    side.x * s * out + this.forward.x * this.speed * 0.6,
                    2.5 + Math.random() * 2.5,
                    side.z * s * out + this.forward.z * this.speed * 0.6,
                    0.9 + Math.random() * 0.4
                );
            }
        });
    }

    /**
     * Keeps the fire of a hit burning where it hit, as the ship sails on.
     */
    updateBurning() {
        if (this.fire) {
            this.entity.getWorldTransform().transformPoint(this.burnPoint, this.fire.position);
        }
    }

    /**
     * Turns the gun onto the player, and fires a salvo now and then once the player is in range.
     *
     * @param {number} dt - The time step.
     */
    updateWeapons(dt) {
        const flying = player.state === ALIVE && missionState === MISSION_ACTIVE;
        _v0.sub2(player.position, this.position);
        const distance = _v0.length();

        // the gun follows the player - its turret about the deck, its barrel up to the player's height
        if (flying && distance < SHIP_RANGE * 1.3) {
            const local = _m0.copy(this.entity.getWorldTransform()).invert().transformVector(_v0, _v1);
            const yaw = Math.atan2(-local.x, -local.z) * math.RAD_TO_DEG;
            const pitch = Math.atan2(local.y, Math.hypot(local.x, local.z)) * math.RAD_TO_DEG;
            const turn = ((yaw - this.turretYaw + 540) % 360) - 180;
            this.turretYaw += math.clamp(turn, -30 * dt, 30 * dt);
            this.barrelPitch += math.clamp(math.clamp(pitch, -5, 65) - this.barrelPitch, -20 * dt, 20 * dt);
        }
        this.model.turret.setLocalEulerAngles(0, this.turretYaw, 0);
        this.model.barrel.setLocalEulerAngles(this.barrelPitch, 0, 0);

        if (!flying) {
            this.salvo = 0;
            return;
        }
        this.cooldown -= dt;
        if (this.salvo > 0) {
            this.salvoTimer -= dt;
            if (this.salvoTimer <= 0) {
                this.launch();
                this.salvo--;
                this.salvoTimer = 0.28 + Math.random() * 0.22;
            }
        } else if (
            this.cooldown <= 0 &&
            distance < SHIP_RANGE &&
            distance > 900 &&
            enemyMissileCount() < MAX_ENEMY_MISSILES
        ) {
            this.salvo = Math.random() < 0.55 ? 3 : 4;
            this.salvoTimer = 0;
            this.salvoSide = Math.random() * 360;
            this.salvoStep = 360 / this.salvo;
            this.cooldown = SHIP_COOLDOWN * (0.8 + Math.random() * 0.5);
            hud.message('SHIP LAUNCH', `SALVO OF ${this.salvo}`, 1.8, HUD_RED);
        }
    }

    /**
     * Fires a missile out of the next cell, straight up, leaning out to its own side of the salvo.
     */
    launch() {
        const cells = this.model.cells;
        this.nextCell = (this.nextCell + 5) % cells.length;
        this.entity.getWorldTransform().transformPoint(cells[this.nextCell], _v0);
        const side = (this.salvoSide + (Math.random() - 0.5) * 30) * math.DEG_TO_RAD;
        _v1.set(Math.sin(side), 0, Math.cos(side));
        this.salvoSide += this.salvoStep;
        fireMissile(SHIP_MISSILE, 'enemy', _v0, this.entity.up, 30, player, null, _v1);
    }

    /**
     * Takes a missile - the first one sets it on fire, the second sinks it.
     *
     * @param {Vec3} at - Where the missile went off.
     * @returns {boolean} True if that sank it.
     */
    hit(at) {
        this.hits++;
        const boost = distanceBoost(at);
        effects.airExplosion(at, this.velocity, 1.3 * boost);
        playExplosion(at, 1.2);
        shakeFrom(at, 1.2);
        if (this.hits < SHIP_HITS) {
            // the fire starts where it hit, and burns there as the ship sails on
            _m0.copy(this.entity.getWorldTransform()).invert().transformPoint(at, this.burnPoint);
            this.burnPoint.y = Math.max(this.burnPoint.y, 7);
            this.fire = addWreckFire(at, 600);
            hud.message('SHIP HIT', 'ONE MORE TO SINK IT', 1.8, HUD_AMBER);
            return false;
        }
        this.destroy();
        return true;
    }

    /**
     * Sinks it - a blast, a few more along the hull as its magazines go up, and it burns as it lists
     * over and settles into the sea.
     */
    destroy() {
        this.alive = false;
        this.sinkTime = 0;
        const at = this.position.clone();
        effects.groundExplosion(at, 2.4 * distanceBoost(at));
        markKill(at);
        playExplosion(at, 2);
        shakeFrom(at, 2);
        for (let i = 0; i < 3; i++) {
            delayed(0.4 + i * 0.45, () => {
                _v0.set(0, 8 + Math.random() * 4, (Math.random() - 0.5) * this.model.length * 0.7);
                this.entity.getWorldTransform().transformPoint(_v0, _v1);
                effects.airExplosion(_v1, Vec3.ZERO, 1.6 * distanceBoost(_v1));
                playExplosion(_v1, 1.2);
            });
        }
        if (!this.fire) {
            this.burnPoint.copy(this.model.center);
            this.fire = addWreckFire(at, 600);
        }
        this.entity.findComponents('render').forEach((render) => {
            /** @type {any} */ (render).meshInstances.forEach((meshInstance) => {
                meshInstance.material = materials.burnt;
            });
        });
    }

    /**
     * Drifts to a stop, lists over and goes down, its fire burning until the sea puts it out.
     *
     * @param {number} dt - The time step.
     */
    updateSinking(dt) {
        this.sinkTime += dt;
        this.speed *= Math.exp(-0.25 * dt);
        this.velocity.copy(this.forward).mulScalar(this.speed);
        this.origin.add(_v0.copy(this.velocity).mulScalar(dt));
        this.place();
        this.updateWater();
        this.updateBurning();
        if (this.fire && this.sinkTime > 28) {
            this.fire.time = Math.min(this.fire.time, 4);
        }
        if (this.sinkTime > 36) {
            this.entity.enabled = false;
        }
    }

    /**
     * Takes it out of the world.
     */
    remove() {
        this.entity.destroy();
        effects.wakes.remove(this.wake);
    }
}

/**
 * Puts the frigates out on the open water, apart from each other and away from where the player comes
 * in from.
 *
 * @param {number} count - How many.
 */
const createShips = (count) => {
    /** @type {Vec3[]} */
    const placed = [];
    for (let attempt = 0; attempt < 600 && placed.length < count; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * COMBAT_RADIUS * 0.75;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        if (Math.hypot(x - startPosition.x, z - startPosition.z) < 3000) {
            continue;
        }
        if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < 1500)) {
            continue;
        }
        // deep water all round, with room to sail
        let open = waterDepth(x, z) > SHIP_DEPTH + 4;
        for (let k = 0; k < 8 && open; k++) {
            const a = (k / 8) * Math.PI * 2;
            open = waterDepth(x + Math.cos(a) * 260, z + Math.sin(a) * 260) > SHIP_DEPTH;
        }
        if (!open) {
            continue;
        }
        placed.push(new Vec3(x, 0, z));
        units.push(new Ship(createFrigate(assets.stealthFrigate), x, z, Math.random() * 360));
    }
};

// --------------------------------------------------------------------------------------------
// winning and losing

/**
 * The number of targets still to destroy, including fighters yet to arrive.
 *
 * @returns {number} The count.
 */
const remainingTargets = () => TARGET_CLASS_LIST.reduce((sum, c) => sum + c.total - c.killed, 0);

/**
 * Ends the mission.
 *
 * @param {boolean} success - Whether it was won.
 * @param {string} reason - Why it was lost.
 */
const endMission = (success, reason) => {
    if (missionState !== MISSION_ACTIVE) {
        return;
    }
    missionState = success ? MISSION_COMPLETE : MISSION_FAILED;
    endReason = reason;
    endTimer = 0;
    if (!success) {
        deathCameraPosition.copy(player.position);
    }
};

/**
 * Counts a kill, and checks whether that was the last one.
 *
 * @param {Target} target - What was destroyed.
 */
const onKill = (target) => {
    const targetClass = /** @type {TargetClass} */ (target.targetClass);
    targetClass.killed++;
    score += target.score;
    hud.message(targetClass.kill, `+${target.score}   ${remainingTargets()} LEFT`, 2, targetClass.killColor);

    if (remainingTargets() === 0 && missionState === MISSION_ACTIVE) {
        // the last kill plays out in slow motion
        slowMotion = 1.4;
        endMission(true, '');
    }
};

/**
 * Damages the player's jet.
 *
 * @param {number} damage - How much damage.
 * @param {Vec3} at - Where the missile went off.
 */
const damagePlayer = (damage, at) => {
    if (player.state !== ALIVE) {
        return;
    }
    player.health = Math.max(0, player.health - damage);
    timeSinceHit = 0;
    effects.airExplosion(at, player.velocity, 0.45);
    hud.hit(1);
    cameraShake = Math.max(cameraShake, 1.6);
    audio?.hit();
    rumble(1, 400);

    if (player.health <= 0) {
        player.kill();
        endMission(false, 'Shot down');
    } else {
        hud.message('HIT', `HULL ${Math.round(player.health)}%`, 1.6, HUD_RED);
    }
};

// --------------------------------------------------------------------------------------------
// missile hits

/**
 * Finds anything an unguided missile flies close enough to to go off.
 *
 * @param {Missile} missile - The missile.
 * @returns {Target|null} What it hit.
 */
const findProximityHit = (missile) => {
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        if (enemy.targetable && enemy.position.distance(missile.position) < missile.spec.fuse) {
            return enemy;
        }
    }
    return null;
};

/**
 * Whether a missile already homing on a target keeps after it. A jet that is shot down does, until it
 * hits the ground, so the missiles still on their way chase the falling wreck instead of flying off.
 *
 * @param {Target} target - The target.
 * @returns {boolean} True if it is still worth homing on.
 */
const isTracked = (target) => target.targetable || (target instanceof Aircraft && target.state === FALLING);

/**
 * A missile hitting the ground, which also destroys any ground target it lands next to.
 *
 * @param {Missile} missile - The missile.
 * @param {Vec3} at - Where it hit.
 */
const detonateOnGround = (missile, at) => {
    missile.active = false;
    missile.entity.enabled = false;
    releaseMissileTrail(missile);

    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (
            unit.kind === 'ground' &&
            unit.alive &&
            missile.owner === 'player' &&
            unit.entity.getPosition().distance(at) < unit.radius + 14
        ) {
            hits++;
            /** @type {GroundUnit} */ (unit).hit();
            onKill(unit);
            return;
        }
    }

    if (terrain.heightAt(at.x, at.z) < 0) {
        splash(at);
    } else {
        effects.groundExplosion(at, 0.45);
    }
    playExplosion(at, 0.5);
};

/**
 * Sets a missile off.
 *
 * @param {Missile} missile - The missile.
 * @param {Vec3} at - Where it went off.
 * @param {Target|null} victim - What it hit, if anything.
 */
const detonate = (missile, at, victim) => {
    missile.active = false;
    missile.entity.enabled = false;
    releaseMissileTrail(missile);

    if (!victim) {
        effects.smallExplosion(at);
        playExplosion(at, 0.4);
        return;
    }

    if (victim.kind === 'flare') {
        effects.smallExplosion(at);
        playExplosion(at, 0.35);
        return;
    }

    // a jet already shot down only takes the blast
    if (victim instanceof Aircraft && victim.state !== ALIVE) {
        effects.airExplosion(at, victim.velocity, 0.6 * distanceBoost(at));
        playExplosion(at, 0.7);
        if (missile.owner === 'player') {
            hits++;
        }
        return;
    }

    if (victim === player) {
        damagePlayer(missile.spec.damage, at);
        return;
    }

    effects.smallExplosion(at);
    hits++;
    if (victim instanceof Aircraft) {
        victim.kill();
        onKill(victim);
    } else if (victim instanceof GroundUnit || victim instanceof Ship) {
        if (victim.hit(at)) {
            onKill(victim);
        }
    }
};

/**
 * Flies the missiles - guidance, motor, smoke, and the fuse.
 *
 * @param {number} dt - The time step.
 */
const updateMissiles = (dt) => {
    for (let i = 0; i < missiles.length; i++) {
        const missile = missiles[i];
        if (!missile.active) {
            continue;
        }
        const spec = missile.spec;
        missile.age += dt;
        missile.previous.copy(missile.position);

        // Released from a pylon, it first falls clear of the jet at the jet's own speed, and the
        // motor lights once it is clear. The fall then eases off as the motor takes over.
        const dropping = missile.age < spec.drop;
        if (dropping) {
            missile.dropSpeed += MISSILE_DROP_ACCEL * dt;
        } else {
            missile.dropSpeed *= Math.exp(-5 * dt);
            if (!missile.ignited) {
                igniteMissile(missile);
            }
        }

        const burning = !dropping && missile.age < spec.burn;
        if (burning) {
            missile.speed = Math.min(missile.speed + spec.accel * dt, spec.maxSpeed);
        } else if (!dropping) {
            missile.speed *= Math.exp(-0.15 * dt);
        }

        // guidance - steer for where the target will be, with a seeker that can lose a target that
        // gets too far off its nose, which is what a hard turn at the last moment exploits
        const target = missile.target;
        if (target && !isTracked(target)) {
            missile.target = null;
        }
        if (missile.target && missile.age > spec.arming) {
            const t = missile.target;
            _v0.sub2(t.position, missile.position);
            const distance = _v0.length();
            _v0.mulScalar(1 / Math.max(distance, 0.001));
            // pitching over out of a vertical launch, the target is still well off the nose
            const pitchingOver = !!spec.pitchOver && missile.age < spec.arming + (spec.pitchOverTime ?? 0);
            if (!pitchingOver && missile.direction.dot(_v0) < Math.cos(80 * math.DEG_TO_RAD)) {
                missile.target = null;
            } else {
                const closing = Math.max(missile.speed - t.velocity.dot(_v0), 80);
                const lead = Math.min(distance / closing, 4);
                _v1.copy(t.velocity)
                    .mulScalar(lead * 0.9)
                    .add(t.position);

                // Aim off to the missile's own side of the target, by an amount that shrinks as it
                // closes, so it sweeps in along an arc and comes round onto the target at the end.
                // The offset is kept square to the line of sight, and a weave turns about it. Both
                // can open out over a while after arming, keeping a salvo together off the rails.
                const fade = math.smoothstep(250, 2200, distance);
                const open = spec.spreadTime ? math.smoothstep(0, spec.spreadTime, missile.age - spec.arming) : 1;
                _v2.copy(missile.curve).sub(_v3.copy(_v0).mulScalar(missile.curve.dot(_v0)));
                _v3.cross(_v0, _v2);
                const weave = Math.sin(missile.age * missile.weaveRate + missile.weavePhase) * missile.weaveAmount;
                const sideways = distance * fade * open;
                _v1.add(_v2.mulScalar(missile.curveAmount * sideways)).add(_v3.mulScalar(weave * sideways));
                _v1.sub(missile.position).normalize();

                // turning harder once the arc is spent, so the curve does not cost the hit
                let turnRate = spec.turnRate * (1 + (1 - fade) * spec.terminal);
                if (pitchingOver) {
                    turnRate = Math.max(turnRate, /** @type {number} */ (spec.pitchOver));
                }
                turnTowards(missile.direction, _v1, turnRate * math.DEG_TO_RAD * dt);
            }
        } else if (!missile.target && missile.age > spec.arming) {
            // an unguided missile swings back from its kick onto the line it was fired along
            turnTowards(missile.direction, missile.heading, 30 * math.DEG_TO_RAD * dt);
        } else if (!dropping) {
            // with the motor lit, it swings out onto its kick before the seeker takes over
            turnTowards(missile.direction, missile.kickDirection, MISSILE_KICK_RATE * math.DEG_TO_RAD * dt);
        }

        missile.position.add(_v0.copy(missile.direction).mulScalar(missile.speed * dt));
        missile.position.add(_v0.copy(missile.dropAxis).mulScalar(missile.dropSpeed * dt));
        placeMissile(missile);

        // the smoke trail and the white hot plume behind the motor, laid along the path flown
        if (burning) {
            const smoke = spec.smoke;
            // Laid densely close to the camera, where single puffs would show, and more sparsely - in
            // bigger puffs - further away, where the trail reads as a line either way. That keeps a
            // salvo of missiles flying a long way from emptying the particle pool.
            const cameraDistance = missile.position.distance(camera.getPosition());
            const spacing = math.clamp(cameraDistance / 400, 1.4, 4);
            const far = 1 + cameraDistance / 2500;
            effects.trail(missile.trail, missile.position, spacing, (x, y, z) => {
                randomDirection(_v2);
                effects.spawn(
                    PRESETS.missileSmoke,
                    x - missile.direction.x * 1.6,
                    y - missile.direction.y * 1.6,
                    z - missile.direction.z * 1.6,
                    _v2.x * 1.5 - missile.direction.x * 6,
                    _v2.y * 1.5 - missile.direction.y * 6,
                    _v2.z * 1.5 - missile.direction.z * 6,
                    smoke * far * (0.85 + Math.random() * 0.3)
                );
                effects.spawn(
                    PRESETS.exhaust,
                    x - missile.direction.x * 1.6,
                    y - missile.direction.y * 1.6,
                    z - missile.direction.z * 1.6,
                    0,
                    0,
                    0,
                    smoke
                );
            });
            _v1.copy(missile.direction).mulScalar(-1.7).add(missile.position);
            effects.glow(_v1.x, _v1.y, _v1.z, 1.3 * smoke, 1.2);
            missile.ribbon?.push(_v1.x, _v1.y, _v1.z, effects.time, 0.7 * smoke, 0.6);
        }

        // The fuse. The closest approach to the target over this frame is what counts, as at these
        // speeds a missile can pass right through its target between two frames.
        const victim = missile.target;
        if (victim) {
            _v0.sub2(missile.previous, victim.position);
            _v1.sub2(missile.position, victim.position);
            _v2.sub2(_v1, _v0);
            const lengthSq = _v2.lengthSq();
            const t = lengthSq > 0 ? math.clamp(-_v0.dot(_v2) / lengthSq, 0, 1) : 0;
            _v2.mulScalar(t).add(_v0);
            const fuse = victim.kind === 'ground' ? victim.radius + 6 : victim.kind === 'sea' ? 14 : spec.fuse;
            if (_v2.length() < fuse) {
                _v2.add(victim.position);
                detonate(missile, _v2, victim);
                continue;
            }
        }

        // an unguided missile can still catch anything it flies close to
        if (!victim && missile.owner === 'player') {
            const hit = findProximityHit(missile);
            if (hit) {
                detonate(missile, missile.position, hit);
                continue;
            }
        }

        const ground = groundHeight(missile.position.x, missile.position.z);
        if (missile.position.y <= ground) {
            _v0.set(missile.position.x, ground, missile.position.z);
            detonateOnGround(missile, _v0);
            continue;
        }

        if (missile.age > spec.life) {
            detonate(missile, missile.position, null);
        }
    }
};

// --------------------------------------------------------------------------------------------
// the missile defense and repairs

/** @type {Missile|null} */
let defenseTarget = null;
let defenseTimer = 0;
let defenseShots = DEFENSE_SHOTS;
let defenseRecharge = 0;
let defenseGap = 0;
const _muzzle = new Vec3();

/**
 * Shoots down the enemy missile homing on the player that would hit first, once it is close - a short
 * burst of tracers, and the missile blows up harmlessly - while the gun has shots left. And repairs
 * the hull.
 *
 * @param {number} dt - The time step.
 */
const updateDefense = (dt) => {
    timeSinceHit += dt;
    defenseGap -= dt;

    // the shots recharge one at a time
    if (defenseShots < DEFENSE_SHOTS) {
        defenseRecharge -= dt;
        if (defenseRecharge <= 0) {
            defenseShots++;
            defenseRecharge = DEFENSE_RECHARGE;
        }
    }
    if (player.state !== ALIVE) {
        defenseTarget = null;
        return;
    }

    if (timeSinceHit > REPAIR_DELAY && player.health < PLAYER_HEALTH) {
        player.health = Math.min(PLAYER_HEALTH, player.health + REPAIR_RATE * dt);
    }

    if (defenseTarget) {
        if (!defenseTarget.active) {
            defenseTarget = null;
            return;
        }

        // tracers streaming from under the nose towards the missile
        player.worldPoint(_v0.set(0, -0.6, -5), _muzzle);
        for (let i = 0; i < 3; i++) {
            _v1.sub2(defenseTarget.position, _muzzle).normalize();
            _v1.x += (Math.random() - 0.5) * 0.03;
            _v1.y += (Math.random() - 0.5) * 0.03;
            _v1.z += (Math.random() - 0.5) * 0.03;
            _v1.normalize().mulScalar(1100);
            _v1.add(player.velocity);
            effects.spawn(PRESETS.tracer, _muzzle.x, _muzzle.y, _muzzle.z, _v1.x, _v1.y, _v1.z);
        }

        defenseTimer -= dt;
        if (defenseTimer <= 0) {
            detonate(defenseTarget, defenseTarget.position, null);
            defenseTarget = null;
            defenseGap = DEFENSE_RETARGET;
            hud.message('MISSILE INTERCEPTED', '', 1.4, HUD_GREEN);
        }
        return;
    }

    if (defenseShots <= 0 || defenseGap > 0) {
        return;
    }

    // the missile that would hit first, once it is in range or about to arrive
    let soonest = Infinity;
    for (let i = 0; i < missiles.length; i++) {
        const missile = missiles[i];
        if (missile.active && missile.owner === 'enemy' && missile.target === player) {
            _v0.sub2(player.position, missile.position);
            const distance = _v0.length();
            _v0.mulScalar(1 / Math.max(distance, 1));
            const closing = Math.max(missile.speed * missile.direction.dot(_v0) - player.velocity.dot(_v0), 50);
            const time = distance / closing;
            if ((distance < DEFENSE_RANGE || time < DEFENSE_REACTION) && time < soonest) {
                soonest = time;
                defenseTarget = missile;
            }
        }
    }
    if (defenseTarget) {
        defenseTimer = DEFENSE_BURST;
        if (defenseShots === DEFENSE_SHOTS) {
            defenseRecharge = DEFENSE_RECHARGE;
        }
        defenseShots--;
        audio?.gun();
    }
};

// --------------------------------------------------------------------------------------------
// the controls - the keyboard and mouse, and a gamepad if one is connected, read into one set of
// inputs once a frame

const controls = {
    pitch: 0,
    roll: 0,
    yaw: 0,
    boost: false,
    brake: false,
    fire: false,
    flares: false,
    look: false,

    // whether a key or a stick is flying the jet directly
    manual: false,

    // pressed since the last frame
    nextTarget: false,
    proceed: false
};

// Mouse flight. With the pointer captured, the mouse swings an aim direction around - kept as a
// heading and an elevation, so it stays put however the jet rolls - the camera looks along it, and the
// jet is flown towards it. Any key or stick input flies the jet directly instead, and the aim follows
// the nose until it is let go.
const MOUSE_SENSITIVITY = 0.1;
let aimYaw = 0;
let aimPitch = 0;
const aimDirection = new Vec3(0, 0, -1);
const AIM_PITCH_LIMIT = 80;

// how hard the jet banks for how far round the aim is - thirty degrees off the heading asks for a
// steep turn - and the steepest bank it is asked for
const AIM_BANK_GAIN = 2.5;
const AIM_MAX_BANK = 80;

// how far ahead, in seconds, the turn is judged
const AIM_LEAD = 0.3;

// how fast the player's heading is turning, in radians per second, positive to the left
let playerHeadingRate = 0;
let playerHeading = 0;

/**
 * Updates the aim direction from its heading and elevation.
 */
const updateAimDirection = () => {
    const yaw = aimYaw * math.DEG_TO_RAD;
    const pitch = aimPitch * math.DEG_TO_RAD;
    aimDirection.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
};

/**
 * Points the aim along a direction.
 *
 * @param {Vec3} direction - The normalized direction.
 */
const setAim = (direction) => {
    aimPitch = math.clamp(
        Math.asin(math.clamp(direction.y, -1, 1)) * math.RAD_TO_DEG,
        -AIM_PITCH_LIMIT,
        AIM_PITCH_LIMIT
    );
    aimYaw = Math.atan2(-direction.x, -direction.z) * math.RAD_TO_DEG;
    updateAimDirection();
};

/**
 * Whether the mouse is flying the jet - the pointer is captured.
 *
 * @returns {boolean} True if it is.
 */
const mouseFlying = () => Mouse.isPointerLocked();

/**
 * Reads the controls for this frame.
 */
const readControls = () => {
    const keyboard = app.keyboard;
    const key = (/** @type {number} */ code) => keyboard.isPressed(code);

    // S pulls the nose up, like pulling back on a stick
    let pitch = (key(KEY_S) || key(KEY_DOWN) ? 1 : 0) - (key(KEY_W) || key(KEY_UP) ? 1 : 0);
    let roll = (key(KEY_D) || key(KEY_RIGHT) ? 1 : 0) - (key(KEY_A) || key(KEY_LEFT) ? 1 : 0);
    let yaw = (key(KEY_E) ? 1 : 0) - (key(KEY_Q) ? 1 : 0);
    controls.boost = key(KEY_SHIFT);
    controls.brake = key(KEY_X);
    // with mouse flight, the click that captures the pointer does not also fire
    controls.fire = key(KEY_SPACE) || (app.mouse.isPressed(MOUSEBUTTON_LEFT) && Mouse.isPointerLocked());
    controls.flares = key(KEY_F);
    controls.look = key(KEY_C);
    controls.nextTarget = false;
    controls.proceed = false;

    // the left stick flies the jet - pulled back it pulls the nose up - the right stick is the rudder
    // and the triggers are the throttle
    const pad = app.gamepads?.current[0];
    if (pad) {
        pitch += pad.getAxis(PAD_L_STICK_Y);
        roll += pad.getAxis(PAD_L_STICK_X);
        yaw += pad.getAxis(PAD_R_STICK_X);
        controls.boost ||= pad.getValue(PAD_R_SHOULDER_2) > 0.4;
        controls.brake ||= pad.getValue(PAD_L_SHOULDER_2) > 0.4;
        controls.fire ||= pad.isPressed(PAD_FACE_1) || pad.isPressed(PAD_R_SHOULDER_1);
        controls.flares ||= pad.isPressed(PAD_FACE_2) || pad.isPressed(PAD_L_SHOULDER_1);
        controls.look ||= pad.isPressed(PAD_FACE_4);
        controls.nextTarget = pad.wasPressed(PAD_FACE_3);
        controls.proceed = pad.wasPressed(PAD_START);
    }

    controls.pitch = math.clamp(pitch, -1, 1);
    controls.roll = math.clamp(roll, -1, 1);
    controls.yaw = math.clamp(yaw, -1, 1);
    controls.manual = Math.abs(pitch) + Math.abs(roll) + Math.abs(yaw) > 0.05;
};

// --------------------------------------------------------------------------------------------
// flying the player's jet

/**
 * Flies the player's jet from the controls.
 *
 * @param {number} dt - The time step.
 */
const updatePlayerFlight = (dt) => {
    // During the briefing the jet flies itself, in a wide, gentle circle at the altitude it started
    // at, with the controls left alone.
    const briefing = missionState === MISSION_BRIEFING;
    const pitch = briefing ? 0 : controls.pitch;
    const roll = briefing ? 0 : controls.roll;
    const yaw = briefing ? 0 : controls.yaw;
    const boost = !briefing && controls.boost;
    const brake = !briefing && controls.brake;
    if (briefing) {
        aimYaw += 7 * dt;
        aimPitch = math.clamp((startPosition.y - player.position.y) * 0.08, -8, 8);
        updateAimDirection();
    }

    // the bank angle against the horizon, and how close to level flight the nose is - neither the
    // leveling nor the turn assist mean anything when pointing straight up or down
    player.refreshAxes();
    const level = 1 - Math.abs(player.forward.y);
    const bank = Math.atan2(-player.right.y, player.up.y);

    let targetPitch = pitch * PITCH_RATE * (boost ? 0.85 : 1);
    let targetRoll = roll * ROLL_RATE;
    let targetYaw = yaw * YAW_RATE;
    let levelWings = Math.abs(roll) < 0.01;

    if (briefing || (mouseFlying() && !controls.manual)) {
        // Fly towards the aim the way a pilot would: bank in proportion to how far round it is from
        // the heading, and pull the nose towards it in the jet's own frame - once banked, a point off
        // to the side is above the nose, so this pulls the jet round the turn, helped by the turn
        // assist. The rudder takes out what is left, and the wings come level as the nose arrives.
        _q1.copy(player.rotation).invert();
        _q1.transformVector(aimDirection, _v1);
        const pitchError = Math.atan2(_v1.y, -_v1.z);
        const yawError = Math.atan2(_v1.x, -_v1.z);

        const fx = player.forward.x;
        const fz = player.forward.z;
        const headingError = Math.atan2(
            fz * aimDirection.x - fx * aimDirection.z,
            fx * aimDirection.x + fz * aimDirection.z
        );

        // banking for where the heading will be a moment from now, so the wings start to come level
        // before the nose arrives rather than after it, and the turn does not overshoot
        const leadError = headingError - playerHeadingRate * AIM_LEAD;
        const desiredBank = math.clamp(
            -leadError * AIM_BANK_GAIN,
            -AIM_MAX_BANK * math.DEG_TO_RAD,
            AIM_MAX_BANK * math.DEG_TO_RAD
        );

        targetRoll = math.clamp((desiredBank - bank) * math.RAD_TO_DEG * 4, -ROLL_RATE, ROLL_RATE);
        targetPitch = math.clamp(pitchError * math.RAD_TO_DEG * 3, -PITCH_RATE, PITCH_RATE);
        targetYaw = math.clamp(yawError * math.RAD_TO_DEG * 2, -YAW_RATE, YAW_RATE);
        levelWings = false;
    } else {
        // flown by hand, the aim follows the nose, so the jet holds its course once let go
        setAim(player.forward);
    }

    // the rates ease in, so a key press rolls the jet in smoothly rather than snapping it
    const ease = 1 - Math.exp(-RATE_RESPONSE * dt);
    player.pitchRate += (targetPitch - player.pitchRate) * ease;
    player.rollRate += (targetRoll - player.rollRate) * ease;
    player.yawRate += (targetYaw - player.yawRate) * ease;

    let rollRate = player.rollRate;
    if (levelWings) {
        rollRate -= bank * math.RAD_TO_DEG * AUTO_LEVEL * level;
    }

    _q0.setFromAxisAngle(Vec3.RIGHT, player.pitchRate * dt);
    player.rotation.mul(_q0);
    _q0.setFromAxisAngle(Vec3.UP, -player.yawRate * dt);
    player.rotation.mul(_q0);
    // rolling right turns the jet clockwise about its tail to nose axis, a negative turn about +z
    _q0.setFromAxisAngle(Vec3.BACK, -rollRate * dt);
    player.rotation.mul(_q0);

    // a banked jet turns, as if the stick were held back just enough to hold the turn level
    _q0.setFromAxisAngle(Vec3.UP, -Math.sin(bank) * TURN_ASSIST * level * dt);
    player.rotation.mul2(_q0, player.rotation);

    // beyond the edge of the combat area the jet is nudged back round towards it
    const distance = Math.hypot(player.position.x, player.position.z);
    if (distance > COMBAT_RADIUS * 1.12) {
        player.refreshAxes();
        const toCenter = Math.atan2(-player.position.x, -player.position.z);
        const heading = Math.atan2(player.forward.x, player.forward.z);
        const delta = ((toCenter - heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        const push = math.clamp((distance - COMBAT_RADIUS * 1.12) / 1500, 0, 1) * 40;
        _q0.setFromAxisAngle(Vec3.UP, Math.sign(delta) * push * dt);
        player.rotation.mul2(_q0, player.rotation);

        // and the aim with it, so the mouse does not fight the turn
        aimYaw += Math.sign(delta) * push * dt;
        updateAimDirection();
    }

    player.rotation.normalize();
    player.refreshAxes();

    const heading = Math.atan2(-player.forward.x, -player.forward.z);
    const turned = ((heading - playerHeading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    playerHeadingRate = math.lerp(playerHeadingRate, dt > 0 ? turned / dt : 0, 1 - Math.exp(-12 * dt));
    playerHeading = heading;

    // the speed eases towards the throttle setting, and the jet loses it climbing and gains it diving
    const targetSpeed = boost ? BOOST_SPEED : brake ? BRAKE_SPEED : CRUISE_SPEED;
    const targetThrottle = boost ? 1.6 : brake ? 0.15 : 0.65;
    player.throttle = math.lerp(player.throttle, targetThrottle, 1 - Math.exp(-4 * dt));
    player.speed += (targetSpeed - player.speed) * (1 - Math.exp(-SPEED_RESPONSE * dt));
    player.speed -= player.forward.y * 9.81 * 0.55 * dt;
    player.speed = math.clamp(player.speed, MIN_SPEED, MAX_SPEED);

    player.velocity.copy(player.forward).mulScalar(player.speed);
    player.position.add(_v0.copy(player.velocity).mulScalar(dt));
    player.measureLoad(dt);
    player.sync();

    // flying into the ground
    if (player.position.y < groundHeight(player.position.x, player.position.z) + 1.5) {
        player.state = FALLING;
        player.health = 0;
        player.crash();
        endMission(false, 'Crashed');
    }
};

/**
 * Brings an enemy fighter into the fight.
 *
 * @param {Vec3} position - Where it appears.
 * @param {number} skill - How good a pilot it is, from zero to one.
 * @returns {Aircraft|null} The fighter, or null when every slot is taken.
 */
const spawnEnemy = (position, skill) => {
    const enemy = enemies.find((e) => e.state === DEAD);
    if (!enemy) {
        return null;
    }
    _v1.sub2(player.position, position);
    _v1.y = 0;
    _v1.normalize();

    // heading in roughly towards the player, but not straight at them
    _q0.setFromAxisAngle(Vec3.UP, (Math.random() - 0.5) * 70);
    _q0.transformVector(_v1, _v1);
    enemy.launch(position, _v1, ENEMY_SPEED);
    enemy.throttle = 0.7;

    const ai = enemy.ai;
    ai.mode = 'patrol';
    ai.timer = 2 + Math.random() * 5;
    ai.fireCooldown = 5 + Math.random() * 4 - skill * 2;
    ai.evadeCooldown = 0;
    ai.skill = skill;
    ai.patrolCenter.copy(position);
    ai.patrolSign = Math.random() < 0.5 ? -1 : 1;
    return enemy;
};

const _desired = new Vec3();
const _lift = new Vec3();

/**
 * Flies an enemy fighter - the decisions, and then the flying itself.
 *
 * @param {Aircraft} enemy - The fighter.
 * @param {number} dt - The time step.
 */
const updateEnemy = (enemy, dt) => {
    const ai = enemy.ai;
    ai.timer -= dt;
    ai.fireCooldown -= dt;
    ai.evadeCooldown -= dt;

    const toPlayer = _v0.sub2(player.position, enemy.position);
    const distance = toPlayer.length();
    const playerAlive = player.state === ALIVE;

    // a missile closing in makes it break hard, and sometimes pop flares
    if (ai.mode !== 'evade' && ai.evadeCooldown <= 0) {
        for (let i = 0; i < missiles.length; i++) {
            const missile = missiles[i];
            if (
                missile.active &&
                missile.target === enemy &&
                missile.position.distance(enemy.position) < 1100 + ai.skill * 600
            ) {
                ai.mode = 'evade';
                ai.timer = 2 + Math.random() * 1.5;
                ai.evadeCooldown = 5;
                _v1.sub2(enemy.position, missile.position).normalize();
                ai.evade.cross(_v1, Vec3.UP);
                if (Math.random() < 0.5) {
                    ai.evade.mulScalar(-1);
                }
                ai.evade.y = (Math.random() - 0.3) * 0.6;
                ai.evade.normalize();
                if (Math.random() < 0.25 + ai.skill * 0.25) {
                    releaseFlares(enemy, 4, 'player', 0.45);
                }
                break;
            }
        }
    }

    switch (ai.mode) {
        case 'patrol': {
            // circle loosely until it is time to come for the player
            _desired.sub2(ai.patrolCenter, enemy.position);
            _desired.y = 0;
            _v1.cross(_desired, Vec3.UP)
                .normalize()
                .mulScalar(ai.patrolSign * 900);
            _desired.add(_v1).normalize();
            if (ai.timer <= 0 || distance < 3500) {
                ai.mode = 'engage';
            }
            break;
        }
        case 'engage': {
            if (!playerAlive) {
                ai.mode = 'patrol';
                ai.timer = 1e9;
                ai.patrolCenter.copy(enemy.position);
                break;
            }

            // lead pursuit - aim where the player will be
            const lead = math.clamp(distance / 500, 0, 2.5) * (0.5 + ai.skill * 0.5);
            _desired.copy(player.velocity).mulScalar(lead).add(player.position).sub(enemy.position).normalize();

            // passing too close - extend away and come round again
            if (distance < 320) {
                ai.mode = 'extend';
                ai.timer = 3.5 + Math.random() * 2.5;
            }

            // a shot, when the player is in range and in front
            toPlayer.mulScalar(1 / Math.max(distance, 0.001));
            const onNose = enemy.forward.dot(toPlayer) > Math.cos(ENEMY_FIRE_CONE * math.DEG_TO_RAD);
            if (
                onNose &&
                distance < ENEMY_FIRE_RANGE &&
                ai.fireCooldown <= 0 &&
                missionState === MISSION_ACTIVE &&
                enemyMissileCount() < MAX_ENEMY_MISSILES
            ) {
                ai.fireCooldown = 3.5 + Math.random() * 3 - ai.skill;
                enemy.takePylon(_v1);
                _v2.copy(enemy.up).mulScalar(-1);
                fireMissile(ENEMY_MISSILE, 'enemy', _v1, enemy.forward, enemy.speed, player, _v2);
                hud.message('MISSILE LAUNCH', '', 1.6, HUD_RED);
            }
            break;
        }
        case 'extend': {
            _desired.copy(toPlayer).mulScalar(-1).normalize();
            _desired.y = Math.max(_desired.y, 0.1);
            _desired.normalize();
            if (ai.timer <= 0) {
                ai.mode = 'engage';
            }
            break;
        }
        case 'evade': {
            _desired.copy(ai.evade);
            if (ai.timer <= 0) {
                ai.mode = 'engage';
            }
            break;
        }
    }

    // keep clear of the ground, looking a few seconds ahead along the flight path, far enough to climb
    // over a ridge in time, and out of the stratosphere
    let ahead = groundHeight(enemy.position.x, enemy.position.z);
    for (const seconds of [1.5, 3, 5]) {
        const lookAhead = enemy.speed * seconds;
        ahead = Math.max(
            ahead,
            groundHeight(enemy.position.x + enemy.forward.x * lookAhead, enemy.position.z + enemy.forward.z * lookAhead)
        );
    }
    const floor = ahead + ENEMY_MIN_ALTITUDE;
    if (enemy.position.y < floor) {
        const urgency = math.clamp((floor - enemy.position.y) / ENEMY_MIN_ALTITUDE, 0, 1);
        _desired.y = Math.max(_desired.y, 0.25 + urgency * 0.6);
        _desired.normalize();
    } else if (enemy.position.y > 3800) {
        _desired.y = Math.min(_desired.y, -0.2);
        _desired.normalize();
    }

    // and inside the combat area
    if (Math.hypot(enemy.position.x, enemy.position.z) > COMBAT_RADIUS * 1.15) {
        _v1.set(-enemy.position.x, 0, -enemy.position.z).normalize();
        _desired.lerp(_desired, _v1, 0.6).normalize();
    }

    // fly - turn the nose towards where it wants to go, as fast as the airframe allows
    const turnRate = (ai.mode === 'evade' ? 58 : ENEMY_TURN_RATE + ai.skill * 8) * math.DEG_TO_RAD;
    _v2.copy(enemy.forward);
    turnTowards(enemy.forward, _desired, turnRate * dt);

    // Bank into the turn the way a real jet would - the lift has to balance the turn and gravity, so the
    // top of the jet points along the acceleration plus one g up. Smoothed, so the wings roll in.
    _lift.sub2(enemy.forward, _v2).mulScalar(enemy.speed / Math.max(dt, 1e-4));
    ai.accel.lerp(ai.accel, _lift, 1 - Math.exp(-5 * dt));
    _lift.copy(ai.accel);
    _lift.y += 9.81;
    _lift.sub(_v1.copy(enemy.forward).mulScalar(_lift.dot(enemy.forward)));
    if (_lift.lengthSq() > 1e-6) {
        _lift.normalize();
        enemy.up.lerp(enemy.up, _lift, 1 - Math.exp(-5 * dt));
    }
    enemy.up.sub(_v1.copy(enemy.forward).mulScalar(enemy.up.dot(enemy.forward))).normalize();
    orientation(enemy.forward, enemy.up, enemy.rotation);
    enemy.refreshAxes();

    const targetSpeed = ai.mode === 'evade' ? ENEMY_SPEED * 1.25 : ENEMY_SPEED;
    enemy.throttle = math.lerp(enemy.throttle, ai.mode === 'evade' ? 1.5 : 0.7, 1 - Math.exp(-3 * dt));
    enemy.speed += (targetSpeed - enemy.speed) * (1 - Math.exp(-0.7 * dt));
    enemy.speed -= enemy.forward.y * 9.81 * 0.5 * dt;
    enemy.speed = math.clamp(enemy.speed, 110, 320);
    enemy.velocity.copy(enemy.forward).mulScalar(enemy.speed);
    enemy.position.add(_v1.copy(enemy.velocity).mulScalar(dt));
    enemy.measureLoad(dt);
    enemy.sync();

    if (enemy.position.y < groundHeight(enemy.position.x, enemy.position.z) + 2) {
        enemy.state = FALLING;
        enemy.crash();
        onKill(enemy);
    }
};

// --------------------------------------------------------------------------------------------
// targeting

/** @type {Target|null} */
let activeTarget = null;
let lockProgress = 0;
let manualHold = 0;

/**
 * Everything the player can shoot at.
 *
 * @param {Target[]} out - Receives the targets.
 * @returns {Target[]} The targets.
 */
const collectTargets = (out) => {
    out.length = 0;
    for (let i = 0; i < enemies.length; i++) {
        if (enemies[i].targetable) {
            out.push(enemies[i]);
        }
    }
    for (let i = 0; i < units.length; i++) {
        if (units[i].targetable) {
            out.push(units[i]);
        }
    }
    return out;
};

/** @type {Target[]} */
const allTargets = [];

/** @type {Target[]} */
const lockable = [];

/**
 * Whether a target is inside the lock cone and in range.
 *
 * @param {Target} target - The target.
 * @returns {boolean} True if it can be locked.
 */
const canLock = (target) => {
    _v0.sub2(target.position, player.position);
    const distance = _v0.length();
    if (distance > LOCK_RANGE || distance < 1) {
        return false;
    }
    return player.forward.dot(_v0.mulScalar(1 / distance)) > Math.cos(LOCK_CONE * math.DEG_TO_RAD);
};

/**
 * Makes a target the active one.
 *
 * @param {Target|null} target - The target.
 */
const selectTarget = (target) => {
    if (target !== activeTarget) {
        activeTarget = target;
        lockProgress = 0;
    }
};

/**
 * Picks the target to lock. The nearest target in front is chosen automatically, unless one was
 * picked by hand a moment ago.
 *
 * @param {number} dt - The time step.
 */
const updateTargeting = (dt) => {
    manualHold -= dt;
    collectTargets(allTargets);

    lockable.length = 0;
    for (let i = 0; i < allTargets.length; i++) {
        if (canLock(allTargets[i])) {
            lockable.push(allTargets[i]);
        }
    }
    lockable.sort((a, b) => a.position.distance(player.position) - b.position.distance(player.position));

    if (activeTarget && !activeTarget.targetable) {
        activeTarget = null;
    }

    const activeLockable = activeTarget && lockable.includes(activeTarget);
    if (!activeLockable && manualHold <= 0) {
        if (lockable.length) {
            selectTarget(lockable[0]);
        } else if (!activeTarget && allTargets.length) {
            // nothing ahead - mark the nearest one, so the display can point the way to it
            let nearest = allTargets[0];
            for (let i = 1; i < allTargets.length; i++) {
                if (allTargets[i].position.distance(player.position) < nearest.position.distance(player.position)) {
                    nearest = allTargets[i];
                }
            }
            selectTarget(nearest);
        }
    }

    // the seeker takes a moment to settle on a new target
    if (activeTarget && lockable.includes(activeTarget)) {
        lockProgress = Math.min(1, lockProgress + dt / 0.35);
    } else {
        lockProgress = 0;
    }
};

/**
 * Moves the selection on to the next target - among those ahead if there are any, otherwise among
 * all of them, nearest first.
 */
const cycleTarget = () => {
    const list =
        lockable.length > 1 || (lockable.length === 1 && lockable[0] !== activeTarget)
            ? lockable
            : allTargets
                  .slice()
                  .sort((a, b) => a.position.distance(player.position) - b.position.distance(player.position));
    if (!list.length) {
        return;
    }
    const index = activeTarget ? list.indexOf(activeTarget) : -1;
    selectTarget(list[(index + 1) % list.length]);
    manualHold = MANUAL_SELECTION_HOLD;
};

/**
 * Fires a missile at the active target, if it is locked, or straight ahead otherwise, and moves the
 * lock on to the next target ahead - the one with the fewest missiles already on their way to it.
 */
const firePlayerMissile = () => {
    if (missilesLeft <= 0 || player.state !== ALIVE) {
        return;
    }
    missilesLeft--;
    shots++;
    fireCooldown = FIRE_INTERVAL;

    const target = activeTarget && lockable.includes(activeTarget) ? activeTarget : null;
    player.takePylon(_v1);

    // it drops clear of the pylon before the motor takes it ahead
    _v2.copy(player.up).mulScalar(-1);
    fireMissile(PLAYER_MISSILE, 'player', _v1, player.forward, player.speed, target, _v2);
    if (target) {
        target.incoming++;
    }

    if (lockable.length > 1) {
        let best = null;
        for (let i = 0; i < lockable.length; i++) {
            const candidate = lockable[i];
            if (!best || candidate.incoming < best.incoming) {
                best = candidate;
            }
        }
        if (best && best !== activeTarget) {
            selectTarget(best);
            lockProgress = 0.6;
        }
    }
    if (missilesLeft === 0) {
        hud.message('OUT OF MISSILES', '', 3, HUD_RED);
    }
};

// --------------------------------------------------------------------------------------------
// the chase camera

/**
 * Snaps the camera behind the player.
 */
const resetCamera = () => {
    cameraForward.copy(player.forward);
    cameraUp.copy(player.up);
    cameraOffset.copy(cameraForward).mulScalar(-CAMERA_DISTANCE).add(_v0.copy(cameraUp).mulScalar(CAMERA_HEIGHT));
    cameraShake = 0;
};

/**
 * Places the chase camera behind the jet.
 *
 * @param {number} dt - The time step, unscaled by slow motion, so the camera stays smooth.
 */
const updateCamera = (dt) => {
    cameraTime += dt;

    if (player.state === ALIVE && missionState === MISSION_BRIEFING) {
        // circling slowly round the jet while the briefing is up
        const angle = cameraTime * 0.16;
        _cameraPosition
            .set(Math.sin(angle) * 34, 7 + Math.sin(angle * 0.7) * 3, Math.cos(angle) * 34)
            .add(player.position);
        _lookAt.copy(player.position);
        cameraUp.set(0, 1, 0);
        cameraFov = math.lerp(cameraFov, CAMERA_FOV - 10, 1 - Math.exp(-2 * dt));
    } else if (player.state === ALIVE) {
        // The direction the camera looks in trails the jet's nose - or, flying with the mouse, follows
        // the aim closely, so the view swings with the mouse and the jet turns after it. Holding C
        // looks past the jet at the target instead.
        const aiming = mouseFlying();
        _v0.copy(aiming ? aimDirection : player.forward);
        if (controls.look && activeTarget) {
            _v0.sub2(activeTarget.position, player.position).normalize();
        }
        cameraForward.lerp(cameraForward, _v0, 1 - Math.exp(-(aiming ? 9 : CAMERA_FOLLOW) * dt)).normalize();

        // The camera rolls with the jet, but levels out part of a gentle bank. Flying with the mouse it
        // keeps the horizon almost level, as the aim it follows does not roll at all.
        _v1.copy(Vec3.UP).sub(_v2.copy(cameraForward).mulScalar(cameraForward.y)).normalize();
        const leveling = aiming ? 0.88 : 0.55 * math.clamp(player.up.y / 0.5, 0, 1);
        _v2.lerp(player.up, _v1, leveling).normalize();
        cameraUp.lerp(cameraUp, _v2, 1 - Math.exp(-CAMERA_ROLL_FOLLOW * dt));
        cameraUp.sub(_v1.copy(cameraForward).mulScalar(cameraUp.dot(cameraForward))).normalize();

        // falls back a little as the speed builds
        const distance = (CAMERA_DISTANCE + math.clamp((player.speed - CRUISE_SPEED) / 100, -0.5, 1) * 5) * cameraZoom;
        _v0.copy(cameraForward)
            .mulScalar(-distance)
            .add(_v1.copy(cameraUp).mulScalar(CAMERA_HEIGHT * cameraZoom));
        cameraOffset.lerp(cameraOffset, _v0, 1 - Math.exp(-9 * dt));
        _cameraPosition.add2(player.position, cameraOffset);
        _lookAt.copy(cameraForward).mulScalar(45).add(player.position).add(_v1.copy(cameraUp).mulScalar(2.6));

        const boosting = player.throttle > 1.05;
        cameraFov = math.lerp(
            cameraFov,
            CAMERA_FOV + (boosting ? 8 : 0) + math.clamp(player.speed - CRUISE_SPEED, -60, 120) * 0.03,
            1 - Math.exp(-2 * dt)
        );
        if (boosting) {
            cameraShake = Math.max(cameraShake, 0.08);
        }
    } else if (player.state === FALLING) {
        // drifting after the burning jet as it goes down, from above and to one side of its path
        _v0.copy(player.velocity);
        _v0.y = 0;
        if (_v0.lengthSq() < 1) {
            _v0.copy(cameraForward);
            _v0.y = 0;
        }
        _v0.normalize();
        _v1.cross(_v0, Vec3.UP);
        _v2.copy(player.position).sub(_v0.mulScalar(70)).add(_v1.mulScalar(45));
        _v2.y += 30;
        _cameraPosition.lerp(_cameraPosition, _v2, 1 - Math.exp(-2.5 * dt));
        _lookAt.copy(player.position);
        cameraUp.set(0, 1, 0);
        cameraFov = math.lerp(cameraFov, CAMERA_FOV, 1 - Math.exp(-2 * dt));
    } else {
        // circling slowly around the smoke rising from where the jet went down
        const angle = cameraTime * 0.12;
        _v2.set(
            deathCameraPosition.x + Math.sin(angle) * 230,
            deathCameraPosition.y + 85,
            deathCameraPosition.z + Math.cos(angle) * 230
        );
        _cameraPosition.lerp(_cameraPosition, _v2, 1 - Math.exp(-1.5 * dt));
        _lookAt.copy(deathCameraPosition);
        _lookAt.y += 25;
        cameraUp.set(0, 1, 0);
        cameraFov = math.lerp(cameraFov, CAMERA_FOV, 1 - Math.exp(-2 * dt));
    }

    // never under the ground
    const ground = groundHeight(_cameraPosition.x, _cameraPosition.z) + 4;
    if (_cameraPosition.y < ground) {
        _cameraPosition.y = ground;
    }

    camera.setPosition(_cameraPosition);
    camera.lookAt(_lookAt, cameraUp);
    camera.camera.fov = cameraFov;

    // two sine waves at unrelated frequencies read as a knock rather than a vibration
    if (cameraShake > 0.001) {
        camera.translateLocal(
            Math.sin(cameraTime * 51) * cameraShake * 0.6,
            Math.sin(cameraTime * 63 + 1.3) * cameraShake * 0.6,
            0
        );
        cameraShake *= Math.exp(-5 * dt);
    }
};

// --------------------------------------------------------------------------------------------
// running the mission

const _spawnPosition = new Vec3();

/**
 * Sends in the next wave of fighters, spread out ahead of the player.
 */
const spawnWave = () => {
    const count = Math.min(TARGET_CLASSES.fighter.total - airSpawned, 2 + Math.floor(Math.random() * 3));
    if (count <= 0) {
        return;
    }
    const heading = Math.atan2(player.forward.x, player.forward.z);
    for (let i = 0; i < count; i++) {
        const angle = heading + (Math.random() - 0.5) * 1.8;
        const distance = 5500 + Math.random() * 2500;
        let x = player.position.x + Math.sin(angle) * distance;
        let z = player.position.z + Math.cos(angle) * distance;

        // pulled back inside the combat area
        const r = Math.hypot(x, z);
        if (r > COMBAT_RADIUS * 0.95) {
            x *= (COMBAT_RADIUS * 0.95) / r;
            z *= (COMBAT_RADIUS * 0.95) / r;
        }
        const y = Math.max(
            groundHeight(x, z) + 500,
            math.clamp(player.position.y + (Math.random() - 0.3) * 600, 400, 2600)
        );
        _spawnPosition.set(x, y, z);
        if (spawnEnemy(_spawnPosition, Math.min(1, (missionNumber - 1) * 0.2 + Math.random() * 0.4))) {
            airSpawned++;
        }
    }
    hud.message('ENEMY FIGHTERS INBOUND', `${count} ON RADAR`, 2.5, HUD_RED);
};

// the briefing's objectives, repeated as the mission starts, and the name of the operation
let briefingObjective = '';
let operationName = '';

// whether the debrief at the end of the mission is up
let debriefShown = false;

// the words operations are named from
const OPERATION_WORDS = [
    [
        'IRON',
        'SILENT',
        'CRIMSON',
        'BROKEN',
        'COLD',
        'BURNING',
        'HOLLOW',
        'SILVER',
        'NIGHT',
        'DISTANT',
        'SHATTERED',
        'PALE'
    ],
    ['SKY', 'DAWN', 'ARROW', 'HORIZON', 'HAMMER', 'TALON', 'LANCE', 'WIND', 'THUNDER', 'SHIELD', 'SPEAR', 'TIDE']
];

/**
 * The name of the time of day of the mission.
 *
 * @returns {string} The name.
 */
const timeOfDayName = () => {
    if (sunElevation < -4) {
        return 'NIGHT';
    }
    if (sunElevation < 8) {
        return sunAzimuth < 180 ? 'DAWN' : 'DUSK';
    }
    return sunElevation < 30 ? 'DAY' : 'MIDDAY';
};

/**
 * The name of the weather of the mission, for the briefing.
 *
 * @returns {string} The name.
 */
const weatherName = () => {
    if (sky.cloudType === CLOUDTYPE_NONE) {
        return 'CLEAR';
    }
    return sky.cloudCoverage < 0.45 ? 'SCATTERED CLOUD' : 'CLOUDY';
};

/**
 * Sets up a mission from scratch - a new landscape, its bases and the jet in the air - and shows its
 * briefing. Nothing happens until the mission is started from there.
 */
const startMission = () => {
    // a new landscape every time, with its bases somewhere else
    units.forEach((unit) => unit.remove());
    units.length = 0;
    if (worldUsed) {
        terrain.destroy();
        terrain = createWorld();
    }
    worldUsed = true;

    // clear the sky
    enemies.forEach((enemy) => enemy.remove());
    missiles.forEach((missile) => {
        missile.active = false;
        missile.entity.enabled = false;
        releaseMissileTrail(missile);
    });
    effects.trails.clear();
    flares.length = 0;
    wreckFires.length = 0;
    timers.length = 0;
    effects.particles.clear();

    // what the mission is made of - fighters arriving in waves, the bases, and in some missions ships
    const between = (/** @type {number} */ min, /** @type {number} */ max) =>
        min + Math.floor(Math.random() * (max - min + 1));
    createGroundUnits(between(MISSION_GROUND_MIN, MISSION_GROUND_MAX));
    if (Math.random() < MISSION_SHIPS_CHANCE) {
        createShips(between(MISSION_SHIPS_MIN, MISSION_SHIPS_MAX));
    }
    for (const targetClass of TARGET_CLASS_LIST) {
        targetClass.total = units.filter((unit) => unit.targetClass === targetClass).length;
        targetClass.killed = 0;
    }
    TARGET_CLASSES.fighter.total = between(MISSION_FIGHTERS_MIN, MISSION_FIGHTERS_MAX);

    missionState = MISSION_BRIEFING;
    missionTime = 0;
    endTimer = 0;
    airSpawned = 0;
    waveTimer = 3.5;
    shots = 0;
    hits = 0;
    slowMotion = 0;
    app.timeScale = 1;

    // in the air already, heading into the combat area
    player.launch(startPosition, startForward, CRUISE_SPEED);
    player.throttle = 0.65;
    setAim(player.forward);
    missilesLeft = TARGET_CLASS_LIST.reduce((sum, c) => sum + c.total * c.hits, 0) * MISSILES_PER_TARGET;
    flaresLeft = FLARE_COUNT;
    activeTarget = null;
    lockProgress = 0;
    manualHold = 0;
    defenseTarget = null;
    defenseShots = DEFENSE_SHOTS;
    defenseRecharge = 0;
    defenseGap = 0;
    timeSinceHit = 0;

    // the wind, which every trail of smoke drifts on
    const windAngle = Math.random() * Math.PI * 2;
    const windSpeed = 2 + Math.random() * 5;
    effects.particles.wind.set(Math.cos(windAngle) * windSpeed, 0, Math.sin(windAngle) * windSpeed);
    terrain.setWind(effects.particles.wind.x, effects.particles.wind.z);

    // the weather - now and then a clear sky, otherwise clouds, drifting on the same wind, which
    // blows harder up there
    sky.cloudType = Math.random() > 0.2 ? CLOUD_TYPE : CLOUDTYPE_NONE;
    sky.cloudCoverage = math.lerp(0.25, 0.6, Math.random());
    sky.windDirection = windAngle * math.RAD_TO_DEG;
    sky.windSpeed = windSpeed * 3;
    setTimeOfDay(sunElevation, sunAzimuth);

    resetCamera();
    hud.setFlightVisible(false);

    // the briefing, with the mouse let go so its button can be clicked
    if (Mouse.isPointerLocked()) {
        app.mouse.disablePointerLock();
    }
    const sams = units.filter((unit) => unit instanceof GroundUnit && unit.type === 'sam').length;
    const objectives = TARGET_CLASS_LIST.filter((c) => c.total > 0).map((c) => `DESTROY ${c.total} ${c.objective}`);
    if (sams > 0) {
        objectives.push(`BEWARE ${sams} SAM LAUNCHER${sams > 1 ? 'S' : ''}`);
    }
    if (TARGET_CLASSES.ship.total > 0) {
        objectives.push('SHIP MISSILES ARE FAST BUT TURN WIDE');
    }
    operationName = `OPERATION ${OPERATION_WORDS[0][Math.floor(Math.random() * OPERATION_WORDS[0].length)]} ${
        OPERATION_WORDS[1][Math.floor(Math.random() * OPERATION_WORDS[1].length)]
    }`;
    hud.hideDebrief();
    debriefShown = false;
    hud.showBriefing({
        title: `MISSION ${missionNumber}`,
        name: operationName,
        conditions: `${timeOfDayName()} · ${weatherName()} · WIND ${Math.round(windSpeed)} M/S · SECTOR ${terrain.seed}`,
        objectives: objectives.join('\n'),
        loadout: [`${missilesLeft} MISSILES`, `${FLARE_COUNT} FLARES`, `MISSILE DEFENSE · ${DEFENSE_SHOTS} SHOTS`].join(
            '\n'
        )
    });
    briefingObjective = `DESTROY ${TARGET_CLASS_LIST.filter((c) => c.total > 0)
        .map((c) => `${c.total} ${c.counter}`)
        .join(' · ')}`;
};

/**
 * Starts the mission from its briefing - the enemy is on its way.
 */
const beginMission = () => {
    if (missionState !== MISSION_BRIEFING) {
        return;
    }
    missionState = MISSION_ACTIVE;
    missionTime = 0;
    waveTimer = 3.5;
    wasTracked = false;
    hud.hideBriefing();
    hud.setFlightVisible(true);
    setAim(player.forward);
    resetCamera();
    hud.message(`MISSION ${missionNumber}`, briefingObjective, 3.5);

    // the mouse flies the jet from here on - this runs from the click or the key press, which the
    // browser needs to let the pointer be captured
    app.mouse.enablePointerLock();
};

/**
 * Runs the waves, and the end of the mission.
 *
 * @param {number} dt - The time step.
 */
const updateMission = (dt) => {
    if (missionState === MISSION_ACTIVE) {
        missionTime += dt;

        // the next wave arrives once the current one is thinning out - counting only the fighters
        // still flying, not the wrecks on their way down
        let airAlive = 0;
        for (let i = 0; i < enemies.length; i++) {
            if (enemies[i].state === ALIVE) {
                airAlive++;
            }
        }
        if (airSpawned < TARGET_CLASSES.fighter.total) {
            if (airAlive <= 1 && waveTimer > 4) {
                waveTimer = 4;
            }
            waveTimer -= dt;
            if (waveTimer <= 0) {
                spawnWave();
                waveTimer = 40 + Math.random() * 15;
            }
        }

        // out of missiles with targets left is the end
        if (missilesLeft <= 0 && remainingTargets() > 0) {
            let inFlight = false;
            for (let i = 0; i < missiles.length; i++) {
                inFlight ||= missiles[i].active && missiles[i].owner === 'player';
            }
            if (!inFlight) {
                endMission(false, 'Out of missiles');
            }
        }
    } else {
        endTimer += dt;
    }
};

// --------------------------------------------------------------------------------------------
// the heads up display

/**
 * Whether an enemy missile is homing on the player.
 *
 * @returns {boolean} True if one is.
 */
const isMissileTracking = () => {
    for (let i = 0; i < missiles.length; i++) {
        const missile = missiles[i];
        if (missile.active && missile.owner === 'enemy' && missile.target === player) {
            return true;
        }
    }
    return false;
};

/**
 * How long until the jet flies into the ground on its current path.
 *
 * @returns {number} The time in seconds, or a large number when it is not heading into the ground.
 */
const timeToImpact = () => {
    for (let t = 0.5; t <= 4; t += 0.5) {
        const x = player.position.x + player.velocity.x * t;
        const y = player.position.y + player.velocity.y * t;
        const z = player.position.z + player.velocity.z * t;
        if (y < groundHeight(x, z) + 10) {
            return t;
        }
    }
    return 1e9;
};

/**
 * Something that is shooting at the player, or could.
 *
 * @typedef {object} Threat
 * @property {Vec3} position - Where it is.
 * @property {boolean} missile - Whether it is a missile on its way, rather than something that can fire one.
 * @property {number} closeness - How close it is, from zero far off to one about to hit or in range.
 * @property {string} label - Its time to impact, or its distance.
 */

/** @type {Threat[]} */
const threats = [];
for (let i = 0; i < 16; i++) {
    threats.push({ position: new Vec3(), missile: false, closeness: 0, label: '' });
}

/** @type {Threat[]} */
const sortedThreats = [];

/** @type {number[]} */
const shownAngles = [];
let missileWarning = 0;

/**
 * Lists what is shooting at the player, most urgent first - the missiles homing on the jet, then the
 * fighters and missile launchers close enough to fire.
 */
const collectThreats = () => {
    let count = 0;
    missileWarning = 0;
    const add = (
        /** @type {Vec3} */ position,
        /** @type {boolean} */ missile,
        /** @type {number} */ closeness,
        /** @type {string} */ label
    ) => {
        if (count < threats.length) {
            const threat = threats[count++];
            threat.position.copy(position);
            threat.missile = missile;
            threat.closeness = closeness;
            threat.label = label;
        }
    };

    if (player.state === ALIVE) {
        for (let i = 0; i < missiles.length; i++) {
            const missile = missiles[i];
            if (!missile.active || missile.owner !== 'enemy' || missile.target !== player) {
                continue;
            }
            _v0.sub2(player.position, missile.position);
            const distance = _v0.length();
            _v0.mulScalar(1 / Math.max(distance, 1));
            const closing = Math.max(missile.speed * missile.direction.dot(_v0) - player.velocity.dot(_v0), 50);
            const closeness = 1 - math.smoothstep(250, 4500, distance);
            missileWarning = Math.max(missileWarning, Math.max(closeness, 0.05));
            add(missile.position, true, closeness, `${(distance / closing).toFixed(1)} S`);
        }

        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (enemy.state !== ALIVE) {
                continue;
            }
            _v0.sub2(player.position, enemy.position);
            const distance = _v0.length();
            if (distance > ENEMY_FIRE_RANGE * 1.8) {
                continue;
            }

            // more urgent still with its nose on the player
            const onNose = enemy.forward.dot(_v0.mulScalar(1 / Math.max(distance, 1))) > Math.cos(30 * math.DEG_TO_RAD);
            const closeness = (1 - math.smoothstep(600, ENEMY_FIRE_RANGE * 1.8, distance)) * (onNose ? 1 : 0.6);
            add(enemy.position, false, closeness, `${(distance / 1000).toFixed(1)} KM`);
        }

        // and everything else armed - the missile launchers on the ground and the ships
        for (let i = 0; i < units.length; i++) {
            const unit = units[i];
            const weapon = unit.weapon;
            if (!unit.alive || !weapon) {
                continue;
            }
            const distance = unit.position.distance(player.position);
            if (distance < weapon.range * 1.4) {
                const closeness = 1 - math.smoothstep(weapon.range * 0.4, weapon.range * 1.4, distance);
                add(unit.position, false, closeness, `${weapon.label} ${(distance / 1000).toFixed(1)} KM`);
            }
        }
    }

    sortedThreats.length = 0;
    for (let i = 0; i < count; i++) {
        sortedThreats.push(threats[i]);
    }
    sortedThreats.sort((a, b) => (a.missile !== b.missile ? (a.missile ? -1 : 1) : b.closeness - a.closeness));
};

// how a won mission is rated - by the accuracy of the shooting and the state of the hull, the letter
// for at least each score, and what it means
/** @type {[number, string, string][]} */
const RATINGS = [
    [0.86, 'S', 'ACE'],
    [0.72, 'A', 'EXCELLENT'],
    [0.58, 'B', 'GOOD'],
    [0.42, 'C', 'FAIR'],
    [0, 'D', 'ROOKIE']
];

/**
 * Shows the debrief at the end of the mission - what was destroyed of what, how it was flown, and a
 * rating - and lets the mouse go, so its button can be clicked.
 */
const showDebrief = () => {
    debriefShown = true;
    if (Mouse.isPointerLocked()) {
        app.mouse.disablePointerLock();
    }
    const success = missionState === MISSION_COMPLETE;
    const minutes = Math.floor(missionTime / 60);
    const seconds = Math.floor(missionTime % 60);
    const accuracy = shots ? hits / shots : 0;
    const hull = player.state === ALIVE ? player.health / PLAYER_HEALTH : 0;
    const classes = TARGET_CLASS_LIST.filter((c) => c.total > 0);
    const total = classes.reduce((sum, c) => sum + c.total, 0);
    const killed = classes.reduce((sum, c) => sum + c.killed, 0);

    // won, the rating is a letter - lost, how much of the job got done
    let rating = `${Math.round((killed / Math.max(total, 1)) * 100)}%`;
    let ratingWord = 'OF THE TARGETS DESTROYED';
    if (success) {
        const value = accuracy * 0.6 + hull * 0.4;
        const [, letter, word] = RATINGS.find(([min]) => value >= min) ?? RATINGS[RATINGS.length - 1];
        rating = letter;
        ratingWord = word;
    }

    hud.showDebrief({
        success,
        title: `MISSION ${missionNumber} ${success ? 'COMPLETE' : 'FAILED'}`,
        name: operationName,
        reason: success ? 'ALL TARGETS DESTROYED' : endReason.toUpperCase(),
        targets: classes.map((c) => ({
            name: c.counter,
            value: `${c.killed} / ${c.total}`,
            done: c.killed >= c.total
        })),
        stats: [
            { name: 'SCORE', value: score, format: (n) => `${n}` },
            { name: 'TIME', value: `${minutes}:${seconds < 10 ? '0' : ''}${seconds}` },
            { name: 'ACCURACY', value: `${Math.round(accuracy * 100)}%` },
            { name: 'MISSILES', value: `${shots} FIRED · ${hits} HIT` },
            { name: 'HULL', value: `${Math.round(hull * 100)}%` }
        ],
        rating,
        ratingWord,
        button: success ? 'NEXT MISSION' : 'TRY AGAIN'
    });
};

/**
 * Refreshes the display from the game state.
 *
 * @param {number} dt - The time step.
 */
const updateHud = (dt) => {
    hud.update(dt);
    const flying = player.state === ALIVE;
    const height = device.clientRect.height;
    const width = device.clientRect.width;
    const units = hud.unitsPerPixel;

    // the boresight, where the nose points and where a missile fired now would go
    _v0.copy(player.forward).mulScalar(3000).add(player.position);
    const boresightVisible = flying && project(camera.camera, _v0, _screen);
    hud.boresight.enabled = boresightVisible;
    hud.lockCircle.enabled = boresightVisible;
    if (boresightVisible) {
        hud.place(hud.boresight, _screen, height);
        hud.place(hud.lockCircle, _screen, height);
        const radius =
            (Math.tan(LOCK_CONE * math.DEG_TO_RAD) / Math.tan(cameraFov * 0.5 * math.DEG_TO_RAD)) *
            height *
            0.5 *
            units;
        hud.lockCircle.element.width = radius * 2;
        hud.lockCircle.element.height = radius * 2;
        hud.lockCircle.element.opacity = lockable.length ? 0.35 : 0.16;
    }
    _v0.copy(player.velocity).normalize().mulScalar(3000).add(player.position);
    hud.velocityMarker.enabled = flying && project(camera.camera, _v0, _screen);
    if (hud.velocityMarker.enabled) {
        hud.place(hud.velocityMarker, _screen, height);
    }

    // where the mouse is asking the jet to go
    _v0.copy(aimDirection).mulScalar(3000).add(player.position);
    hud.aimMarker.enabled = flying && mouseFlying() && project(camera.camera, _v0, _screen);
    if (hud.aimMarker.enabled) {
        hud.place(hud.aimMarker, _screen, height);
    }

    // a marker over every target in view, and the brackets around the active one
    let marker = 0;
    const blink = (cameraTime * 4) % 1 < 0.5;
    if (flying) {
        for (let i = 0; i < allTargets.length && marker < hud.markers.length; i++) {
            const target = allTargets[i];
            const distance = target.position.distance(camera.getPosition());
            if (distance > 15000 || !project(camera.camera, target.position, _screen)) {
                continue;
            }
            if (_screen.x < -20 || _screen.y < -20 || _screen.x > width + 20 || _screen.y > height + 20) {
                continue;
            }
            const element = hud.markers[marker++];
            element.enabled = true;
            hud.place(element, _screen, height);
            const targetClass = /** @type {TargetClass} */ (target.targetClass);
            element.element.texture = hud.shapes[targetClass.marker];
            const size = math.lerp(24, 12, math.smoothstep(500, 9000, distance));
            element.element.width = size;
            element.element.height = size;
            element.element.color = target.incoming > 0 && blink ? HUD_WHITE : targetClass.color;
        }
    }
    for (let i = marker; i < hud.markers.length; i++) {
        hud.markers[i].enabled = false;
    }

    const target = flying ? activeTarget : null;
    let onScreen = false;
    if (target && project(camera.camera, target.position, _screen)) {
        onScreen = _screen.x > 0 && _screen.y > 0 && _screen.x < width && _screen.y < height;
    }
    hud.bracket.enabled = !!target && onScreen;
    hud.bracketLabel.enabled = hud.bracket.enabled;
    hud.bracketRange.enabled = hud.bracket.enabled;
    if (target && onScreen) {
        const distance = target.position.distance(player.position);
        const locked = lockProgress >= 1;
        const size = math.lerp(110, 46, lockProgress) * math.lerp(1, 0.75, math.smoothstep(800, 5000, distance));
        hud.place(hud.bracket, _screen, height);
        hud.bracket.element.width = size;
        hud.bracket.element.height = size;
        hud.bracketSpin = locked ? 0 : hud.bracketSpin + dt * 180;
        hud.bracket.setLocalEulerAngles(0, 0, locked ? 0 : hud.bracketSpin);
        const color = locked ? HUD_RED : lockable.includes(target) ? HUD_AMBER : HUD_GREEN;
        hud.bracket.element.color = color;

        const p = hud.bracket.getLocalPosition();
        hud.bracketLabel.setLocalPosition(p.x, p.y + size * 0.5 + 6, 0);
        hud.bracketRange.setLocalPosition(p.x, p.y - size * 0.5 - 6, 0);
        hud.bracketLabel.element.color = color;
        hud.bracketRange.element.color = color;
        hud.setText(
            hud.bracketLabel,
            locked ? 'LOCK' : lockable.includes(target) ? '' : /** @type {TargetClass} */ (target.targetClass).name
        );
        hud.setText(hud.bracketRange, `${(distance / 1000).toFixed(1)} KM`);
    }

    // the kills of the last moments, marked where they happened
    for (let i = 0; i < hud.killMarkers.length; i++) {
        const element = hud.killMarkers[i];
        const mark = killMarks[i];
        element.enabled = false;
        if (!mark) {
            continue;
        }
        mark.time += dt;
        if (mark.time < 2.2 && flying && project(camera.camera, mark.position, _screen)) {
            element.enabled = true;
            hud.place(element, _screen, height);
            const size = 30 + mark.time * 14;
            element.element.width = size;
            element.element.height = size;
            element.element.opacity = 1 - mark.time / 2.2;
        }
    }
    while (killMarks.length && killMarks[0].time >= 2.2) {
        killMarks.shift();
    }

    // The threats. One out of view is pointed at from the edge of the screen - bigger, brighter and,
    // for a missile, flashing faster the closer it gets. A missile in view carries its time to
    // impact next to it.
    collectThreats();
    const camPosition = camera.getPosition();
    const centerX = width * 0.5 * units;
    const centerY = height * 0.5 * units;
    shownAngles.length = 0;
    let shown = 0;
    for (let i = 0; i < hud.threatArrows.length; i++) {
        hud.threatArrows[i].enabled = false;
        hud.threatLabels[i].enabled = false;
    }
    const threatCount = flying ? sortedThreats.length : 0;
    for (let i = 0; i < threatCount && shown < hud.threatArrows.length; i++) {
        const threat = sortedThreats[i];
        const arrow = hud.threatArrows[shown];
        const label = hud.threatLabels[shown];

        const color = threat.missile ? HUD_RED : HUD_AMBER;
        const inView =
            project(camera.camera, threat.position, _screen) &&
            _screen.x > 30 &&
            _screen.y > 30 &&
            _screen.x < width - 30 &&
            _screen.y < height - 30;
        if (inView) {
            if (threat.missile) {
                shown++;
                label.enabled = true;
                hud.place(label, _screen, height);
                const p = label.getLocalPosition();
                label.setLocalPosition(p.x, p.y + 20, 0);
                label.element.color = color;
                hud.setText(label, threat.label);
            }
            continue;
        }

        _v0.sub2(threat.position, camPosition);
        const angle = Math.atan2(_v0.dot(camera.right), _v0.dot(camera.up));

        // the launchers of one base sit almost on top of each other at the edge - only the most
        // urgent of a cluster is shown
        if (
            !threat.missile &&
            shownAngles.some((a) => Math.abs(((angle - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.14)
        ) {
            continue;
        }
        if (!threat.missile) {
            shownAngles.push(angle);
        }
        shown++;
        const x = centerX + Math.sin(angle) * (centerX - 70);
        const y = centerY + Math.cos(angle) * (centerY - 60);
        const size = threat.missile ? math.lerp(24, 54, threat.closeness) : math.lerp(18, 32, threat.closeness);
        const flash = threat.missile && (cameraTime * (3 + threat.closeness * 9)) % 1 > 0.6;

        arrow.enabled = true;
        arrow.element.texture = threat.missile ? hud.shapes.triangle : hud.shapes.arrow;
        arrow.element.color = flash ? HUD_WHITE : color;
        arrow.element.width = size;
        arrow.element.height = size;
        arrow.element.opacity = math.lerp(0.45, 1, threat.closeness);
        arrow.setLocalPosition(x, y, 0);
        arrow.setLocalEulerAngles(0, 0, -angle * math.RAD_TO_DEG);

        label.enabled = true;
        label.setLocalPosition(x - Math.sin(angle) * (size * 0.5 + 22), y - Math.cos(angle) * (size * 0.5 + 12), 0);
        label.element.color = color;
        label.element.opacity = arrow.element.opacity;
        hud.setText(label, threat.label);
    }

    // pointing the way to a target that is off the screen
    hud.offscreenArrow.enabled = !!target && !onScreen;
    if (target && !onScreen) {
        _v0.sub2(target.position, camera.getPosition());
        const x = _v0.dot(camera.right);
        const y = _v0.dot(camera.up);
        const angle = Math.atan2(x, y);
        const centerX = width * 0.5 * units;
        const centerY = height * 0.5 * units;
        const radiusX = centerX * 0.62;
        const radiusY = centerY * 0.62;
        hud.offscreenArrow.setLocalPosition(
            centerX + Math.sin(angle) * radiusX,
            centerY + Math.cos(angle) * radiusY,
            0
        );
        hud.offscreenArrow.setLocalEulerAngles(0, 0, -angle * math.RAD_TO_DEG);
        hud.offscreenArrow.element.color = /** @type {TargetClass} */ (target.targetClass).color;
    }

    // the readouts
    hud.setText(hud.speedText, `${Math.round(player.speed * 3.6)}`);
    hud.setText(hud.altText, `${Math.round(player.position.y)}`);
    hud.setText(hud.gText, `${player.gLoad.toFixed(1)} G`);
    hud.setText(hud.throttleText, player.throttle > 1.05 ? 'AFTERBURNER' : player.throttle < 0.3 ? 'AIR BRAKE' : '');
    hud.throttleText.element.color = player.throttle > 1.05 ? HUD_AMBER : HUD_GREEN;
    hud.setText(hud.missileText, `${missilesLeft}`);
    hud.missileText.element.color = missilesLeft === 0 ? HUD_RED : HUD_GREEN;
    hud.setText(hud.flareText, `FLARES ${flaresLeft}`);
    // the shots left, and while recharging, how long until the next one
    const defenseShotsText = `DEFENSE ${defenseShots} / ${DEFENSE_SHOTS}`;
    hud.setText(
        hud.defenseText,
        defenseShots < DEFENSE_SHOTS ? `${defenseShotsText} · ${defenseRecharge.toFixed(1)}` : defenseShotsText
    );
    hud.defenseText.element.color = defenseShots > 0 ? HUD_GREEN : HUD_AMBER;
    const hull = player.health / PLAYER_HEALTH;
    hud.hullFill.element.width = Math.max(1, 160 * hull);
    hud.hullFill.element.color = hull < 0.35 ? HUD_RED : hull < 0.7 ? HUD_AMBER : HUD_GREEN;
    // what has been destroyed so far, out of what the mission asks for, and the bar filling up as the
    // end of the mission approaches
    let total = 0;
    let killed = 0;
    let counter = 0;
    for (const targetClass of TARGET_CLASS_LIST) {
        if (targetClass.total > 0) {
            hud.counter(
                counter++,
                `${targetClass.counter} ${targetClass.killed} / ${targetClass.total}`,
                targetClass.killed >= targetClass.total
            );
            total += targetClass.total;
            killed += targetClass.killed;
        }
    }
    hud.hideCounters(counter);
    hud.progressFill.element.width = Math.max(1, (600 * killed) / Math.max(total, 1));
    hud.setText(hud.scoreText, `SCORE ${score}`);
    const minutes = Math.floor(missionTime / 60);
    const seconds = Math.floor(missionTime % 60);
    hud.setText(hud.timeText, `TIME ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);

    // The radar, turned so the player's heading is up. White is the player's own jet alone - the
    // active target is ringed in its own color instead.
    let blip = 0;
    let activeBlip = -1;
    let activeColor = HUD_RED;
    if (flying) {
        const heading = Math.atan2(-player.forward.x, -player.forward.z);
        for (let i = 0; i < allTargets.length; i++) {
            const t = allTargets[i];
            const dx = t.position.x - player.position.x;
            const dz = t.position.z - player.position.z;
            const targetClass = /** @type {TargetClass} */ (t.targetClass);
            if (t === activeTarget) {
                activeBlip = blip;
                activeColor = targetClass.color;
            }
            let rotation = 0;
            if (targetClass.heading) {
                const forward = /** @type {Aircraft|Ship} */ (t).forward;
                rotation = (Math.atan2(-forward.x, -forward.z) - heading) * math.RAD_TO_DEG;
            }
            const shape = hud.shapes[targetClass.blip];
            hud.blip(blip++, dx, dz, heading, shape, targetClass.color, targetClass.blipSize, -rotation);
        }
        // missiles - the enemy's as small blinking darts pointing the way they fly, the player's as dots
        for (let i = 0; i < missiles.length && blip < hud.blips.length; i++) {
            const missile = missiles[i];
            if (!missile.active) {
                continue;
            }
            const dx = missile.position.x - player.position.x;
            const dz = missile.position.z - player.position.z;
            if (missile.owner === 'enemy') {
                const rotation = (Math.atan2(-missile.direction.x, -missile.direction.z) - heading) * math.RAD_TO_DEG;
                hud.blip(blip++, dx, dz, heading, hud.shapes.triangle, HUD_MISSILE, 8, -rotation, blink ? 1 : 0.3);
            } else {
                hud.blip(blip++, dx, dz, heading, hud.shapes.dot, HUD_GREEN, 4, 0);
            }
        }

        // and the launches, pinging out from where they were fired
        for (let i = 0; i < radarPings.length; i++) {
            const ping = radarPings[i];
            hud.ping(i, ping.position.x - player.position.x, ping.position.z - player.position.z, heading, ping.time);
        }
    }
    for (let i = radarPings.length - 1; i >= 0; i--) {
        radarPings[i].time += dt;
        if (radarPings[i].time > 1.2) {
            radarPings.splice(i, 1);
        }
    }
    hud.hidePings(flying ? radarPings.length : 0);
    hud.hideBlips(blip);
    hud.lockBlip(activeBlip, activeColor);

    // the enemy missiles marked in view, as their smoke can be hard to pick out against the sky
    let missileMarker = 0;
    const markerCount = flying ? hud.missileMarkers.length : 0;
    for (let i = 0; i < missiles.length && missileMarker < markerCount; i++) {
        const missile = missiles[i];
        if (!missile.active || missile.owner !== 'enemy' || missile.position.distance(player.position) > 8000) {
            continue;
        }
        if (project(camera.camera, missile.position, _screen)) {
            const marker = hud.missileMarkers[missileMarker++];
            marker.enabled = true;
            hud.place(marker, _screen, height);
            marker.element.color = blink ? HUD_RED : HUD_WHITE;
        }
    }
    for (let i = missileMarker; i < hud.missileMarkers.length; i++) {
        hud.missileMarkers[i].enabled = false;
    }

    // warnings - a missile tracking the player, the ground coming up, the edge of the combat area
    let warning = '';
    if (flying) {
        if (isMissileTracking()) {
            warning = blink ? 'MISSILE' : '';
        } else if (timeToImpact() < 3.5) {
            warning = blink ? 'PULL UP' : '';
        } else if (Math.hypot(player.position.x, player.position.z) > COMBAT_RADIUS) {
            warning = 'RETURN TO COMBAT AREA';
        }
    }
    hud.setText(hud.warningText, warning);

    // a reminder of how to fly with the mouse, and the debrief once the end of a mission has played out
    let hint = '';
    if (!Mouse.isPointerLocked() && flying && missionState === MISSION_ACTIVE) {
        hint = 'CLICK TO FLY WITH THE MOUSE  ·  ESC RELEASES IT';
    }
    hud.setText(hud.hintText, hint);
    const ended = missionState === MISSION_COMPLETE || missionState === MISSION_FAILED;
    if (ended && !debriefShown && endTimer > (missionState === MISSION_COMPLETE ? 2 : 2.5)) {
        showDebrief();
    }
    if (debriefShown && Mouse.isPointerLocked()) {
        app.mouse.disablePointerLock();
    }
    const briefing = missionState === MISSION_BRIEFING;
    const fade = briefing ? 1 : math.clamp((endTimer - 2) * 1.5, 0, 1);
    hud.scrim.enabled = missionState !== MISSION_ACTIVE && fade > 0;
    hud.scrim.element.opacity = fade * (briefing ? 0.25 : 0.35);
    hud.setFlightVisible(missionState === MISSION_ACTIVE || (!briefing && endTimer < 2));
};

// --------------------------------------------------------------------------------------------
// input

app.mouse.on('mousedown', (event) => {
    // The first click captures the pointer for mouse flight - it has to be asked for from a click.
    // Only while the mission is on, though - the briefing and the debrief need the pointer to click
    // their buttons.
    if (!Mouse.isPointerLocked() && missionState === MISSION_ACTIVE) {
        app.mouse.enablePointerLock();
    }
    if (event.button === MOUSEBUTTON_RIGHT) {
        cycleTarget();
    }
});

app.mouse.on('mousemove', (event) => {
    if (mouseFlying() && player.state === ALIVE) {
        aimYaw -= event.dx * MOUSE_SENSITIVITY;
        aimPitch = math.clamp(aimPitch - event.dy * MOUSE_SENSITIVITY, -AIM_PITCH_LIMIT, AIM_PITCH_LIMIT);
        updateAimDirection();
    }
});

app.mouse.on('mousewheel', (event) => {
    cameraZoom = math.clamp(cameraZoom * (1 + event.wheelDelta * 0.1), 0.6, 2.2);
});

/**
 * Moves on from the end of a mission - to the next one after a win, or to another try after a loss.
 */
const proceed = () => {
    if (missionState === MISSION_ACTIVE) {
        return;
    }
    if (missionState === MISSION_BRIEFING) {
        beginMission();
        return;
    }
    if (!debriefShown) {
        return;
    }
    if (missionState === MISSION_COMPLETE) {
        missionNumber++;
    }
    randomTimeOfDay();
    startMission();
};

app.keyboard.on('keydown', (event) => {
    if (event.key === KEY_TAB || event.key === KEY_R) {
        cycleTarget();
    }
    if (event.key === KEY_ENTER) {
        proceed();
    }
});

hud.startButton.button.on('click', () => beginMission());
hud.debriefButton.button.on('click', () => proceed());

// --------------------------------------------------------------------------------------------
// the frame

app.on('update', (rawDt) => {
    // the frame time arrives scaled by the slow motion, the camera and the display run in real time
    const dt = Math.min(rawDt, 0.05);
    const realDt = app.timeScale > 0 ? dt / app.timeScale : dt;

    // slow motion for the last kill of a mission
    if (slowMotion > 0) {
        slowMotion -= realDt;
        app.timeScale = slowMotion > 0 ? 0.3 : 1;
    }

    for (let i = timers.length - 1; i >= 0; i--) {
        timers[i].time -= dt;
        if (timers[i].time <= 0) {
            const timer = timers[i];
            timers.splice(i, 1);
            timer.callback();
        }
    }

    readControls();
    if (controls.nextTarget) {
        cycleTarget();
    }
    if (controls.proceed) {
        proceed();
    }

    // the player
    if (player.state === ALIVE) {
        updatePlayerFlight(dt);
    } else if (player.state === FALLING) {
        if (player.updateFalling(dt)) {
            player.crash();
        }
    }

    // weapons
    fireCooldown -= dt;
    flareCooldown -= dt;
    if (player.state === ALIVE && (missionState === MISSION_ACTIVE || missionState === MISSION_COMPLETE)) {
        if (controls.fire && fireCooldown <= 0) {
            firePlayerMissile();
        }
        if (controls.flares && flareCooldown <= 0 && flaresLeft > 0) {
            flareCooldown = FLARE_INTERVAL;
            flaresLeft = Math.max(0, flaresLeft - 2);
            releaseFlares(player, 6, 'enemy', 0.7);
        }
    }

    // the enemy
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        if (enemy.state === ALIVE) {
            updateEnemy(enemy, dt);
        } else if (enemy.state === FALLING && enemy.updateFalling(dt)) {
            enemy.crash();
        }
    }
    for (let i = 0; i < units.length; i++) {
        units[i].update(dt);
    }

    updateTargeting(dt);
    updateMissiles(dt);
    updateDefense(dt);
    updateFlares(dt);
    updateWreckFires(dt);
    updateMission(dt);

    // the number of the player's missiles homing on each target, for the display and the next lock
    for (let i = 0; i < allTargets.length; i++) {
        allTargets[i].incoming = 0;
    }
    for (let i = 0; i < missiles.length; i++) {
        const missile = missiles[i];
        if (missile.active && missile.owner === 'player' && missile.target) {
            missile.target.incoming++;
        }
    }

    player.updateVisuals(dt, missilesLeft);
    for (let i = 0; i < enemies.length; i++) {
        if (enemies[i].state !== DEAD) {
            enemies[i].updateVisuals(dt, 4);
        }
    }

    updateCamera(realDt);

    // lighting for the smoke, from the sun and the sky
    sunLight.linear(sun.light.color).mulScalar(sun.light.intensity);
    effects.setLighting(sun.up, sunLight, skyLight, groundLight);
    device.scope.resolve('atmosphere_params').setValue(atmosphere);

    terrain.update(effects.time);
    terrain.setLighting(sun.up, sunLight, skyLight);
    effects.update(dt, camera.camera);
    updateHud(realDt);

    // the first time a missile tracks the player, say what to do about it
    const tracked = isMissileTracking();
    if (tracked && !wasTracked && missileHints < 2 && player.state === ALIVE) {
        missileHints++;
        hud.message('MISSILE INBOUND', 'TURN HARD TO OUTRUN ITS TURN, OR DROP FLARES WITH F', 3.5, HUD_RED);
    }
    wasTracked = tracked;

    // the nearest enemy jet, roaring past - how far it is, and how fast it closes on the camera,
    // which moves with the player's jet
    let flybyDistance = Infinity;
    let flybyClosing = 0;
    const listener = camera.getPosition();
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        const distance = enemy.state === ALIVE ? enemy.position.distance(listener) : Infinity;
        if (distance < flybyDistance) {
            flybyDistance = distance;
            _v0.sub2(enemy.position, listener).mulScalar(1 / Math.max(distance, 0.001));
            flybyClosing = _v1.sub2(player.velocity, enemy.velocity).dot(_v0);
        }
    }

    audio?.update(realDt, {
        alive: player.state === ALIVE,
        throttle: player.throttle,
        speed: player.speed,
        lock: missionState === MISSION_ACTIVE && activeTarget && lockable.includes(activeTarget) ? lockProgress : 0,
        warning: missileWarning,
        flybyDistance,
        flybyClosing
    });
});

randomTimeOfDay();
startMission();

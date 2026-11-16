// @config
//
// **Storm Petrel**, a vertical shooter drawn from one sprite sheet. The game is 192 by 256 pixels,
// shown at the largest whole multiple that fits the window, so every pixel of the art is a square
// of the screen. Raiders come in waves over the sea, and an airship follows them: shoot them down,
// and collect the power ups the bombers drop for more guns.
//
// `←` `→` `↑` `↓` Fly · `Space` Fire · or drag to fly and fire

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_NONE,
    KEY_A,
    KEY_D,
    KEY_DOWN,
    KEY_ENTER,
    KEY_LEFT,
    KEY_RIGHT,
    KEY_S,
    KEY_SPACE,
    KEY_UP,
    KEY_W,
    KEY_Z,
    Keyboard,
    PROJECTION_ORTHOGRAPHIC,
    RESOLUTION_FIXED,
    SPRITETYPE_ANIMATED,
    SPRITE_RENDERMODE_TILED,
    SoundManager,
    SpriteComponentSystem,
    TextureAtlasHandler,
    TextureHandler,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

import { Sounds } from './audio.mjs';
import { Label, Pool, Sheet } from './sheet.mjs';
import { ARRIVALS, BOSS, BOSS_AT, HEIGHT, PATHS, WIDTH, updateBoss } from './stage.mjs';

/**
 * @import { Enemy, World } from './stage.mjs'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// The sprite sheet: a JSON file that names its image, storm-petrel.png, beside it. Pixel art is
// read pixel for pixel, with no filtering or mipmaps.
const sheetAsset = new Asset(
    'storm-petrel',
    'textureatlas',
    { url: './assets/sprites/storm-petrel.json' },
    {
        srgb: true,
        mipmaps: false,
        minfilter: 'nearest',
        magfilter: 'nearest'
    }
);

// No antialiasing: the edge of a sprite is the edge of a pixel
const device = await createGraphicsDevice(canvas, { deviceTypes: [deviceType], antialias: false });
device.maxPixelRatio = 1;

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.keyboard = new Keyboard(window);
createOptions.soundManager = new SoundManager();
createOptions.componentSystems = [CameraComponentSystem, SpriteComponentSystem];
createOptions.resourceHandlers = [TextureHandler, TextureAtlasHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// The canvas always holds 192 by 256 pixels. The page stretches it by a whole number of screen
// pixels, without smoothing, and centers it.
app.setCanvasFillMode(FILLMODE_NONE);
app.setCanvasResolution(RESOLUTION_FIXED, WIDTH, HEIGHT);
const canvasStyle = canvas.style.cssText;
canvas.style.imageRendering = 'pixelated';
canvas.style.position = 'absolute';
// a drag flies the seaplane, so it must not scroll or zoom the page
canvas.style.touchAction = 'none';
const fit = () => {
    const ratio = window.devicePixelRatio;
    const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT) * ratio));
    const width = (WIDTH * scale) / ratio;
    const height = (HEIGHT * scale) / ratio;
    app.resizeCanvas(width, height);
    canvas.style.left = `${Math.round(((window.innerWidth - width) / 2) * ratio) / ratio}px`;
    canvas.style.top = `${Math.round(((window.innerHeight - height) / 2) * ratio) / ratio}px`;
};
fit();
window.addEventListener('resize', fit);

await new Promise((resolve) => {
    new AssetListLoader([sheetAsset], app.assets).load(resolve);
});
app.start();

const sheet = new Sheet(device, sheetAsset.resource);
const sounds = new Sounds(app.soundManager);

// How far each kind of thing is from the camera, back to front
const Z = {
    sea: 0,
    island: 1,
    boat: 2,
    shadow: 3,
    enemy: 5,
    pickup: 6,
    player: 7,
    shot: 8,
    effect: 9,
    cloud: 10,
    orb: 11,
    hud: 20
};

// A shadow is its sprite again, dark and see through, down and to the right on the sea
const SHADOW_COLOR = new Color(0.03, 0.07, 0.2);
const SHADOW_OPACITY = 0.38;
const SHADOW_X = 6;
const SHADOW_Y = -8;

// The sea and its islands go by a whole pixel at a time. At this speed that is a pixel every two
// frames at 60 frames a second, or every four at 120, and the scroll starts part way between two
// pixels, so the steps stay evenly spaced while the frame times wobble.
const SCROLL_SPEED = 30;
const SCROLL_START = 0.125;
const random = (/** @type {number} */ min, /** @type {number} */ max) => min + Math.random() * (max - min);

/**
 * @param {string} name - The entity name.
 * @param {number} z - How far the entity is from the camera.
 * @param {object} data - The sprite component data.
 * @param {boolean} [enabled] - Whether the entity starts enabled.
 * @returns {Entity} An entity with a sprite component.
 */
const spawn = (name, z, data, enabled = true) => {
    const entity = new Entity(name);
    entity.addComponent('sprite', data);
    entity.setLocalPosition(0, 0, z);
    entity.enabled = enabled;
    app.root.addChild(entity);
    return entity;
};

/**
 * Moves an entity to the nearest whole pixel.
 *
 * @param {Entity} entity - The entity.
 * @param {number} x - The x position.
 * @param {number} y - The y position.
 */
const place = (entity, x, y) => {
    entity.setLocalPosition(Math.round(x), Math.round(y), entity.getLocalPosition().z);
};

// The camera sees the whole screen: a world unit is a pixel
const camera = new Entity('camera');
camera.addComponent('camera', {
    projection: PROJECTION_ORTHOGRAPHIC,
    orthoHeight: HEIGHT / 2,
    nearClip: 1,
    farClip: 100,
    clearColor: new Color().fromString('#2659a8')
});
camera.setPosition(WIDTH / 2, HEIGHT / 2, 50);
app.root.addChild(camera);

// ------------------------------------------------------------------------------------ scenery

// The sea: one tile, repeated over the screen and a tile more, sliding down a tile's height and
// starting again. Its waves are a clip: a loop of frames in which each crest rises, runs and
// sinks in its own time.
const SEA_TILE = sheet.size('sea-0').height;
const sea = spawn('sea', Z.sea, {
    type: SPRITETYPE_ANIMATED,
    clips: { waves: { fps: 7, loop: true, sprite: sheet.sprite(sheet.frames('sea'), SPRITE_RENDERMODE_TILED) } },
    autoPlayClip: 'waves',
    width: WIDTH,
    height: HEIGHT + SEA_TILE
});

/**
 * Something that drifts down the screen and comes around again above it.
 *
 * @typedef {object} Drifter
 * @property {Entity} entity - Its sprite, which has a frame for each shape it can take.
 * @property {string[]} frames - The names of those frames.
 * @property {number} x - Its position.
 * @property {number} y - Its position.
 * @property {number} half - Half its height.
 */

/**
 * @param {string} name - The start of the frame names.
 * @param {number} count - How many to make.
 * @param {number} z - How far they are from the camera.
 * @param {number} opacity - How see through they are.
 * @returns {Drifter[]} Sprites that share the frames of that name.
 */
const drifters = (name, count, z, opacity) => {
    const frames = sheet.frames(name);
    return Array.from({ length: count }, () => ({
        entity: spawn(name, z, { sprite: sheet.sprite(frames), opacity }),
        frames,
        x: 0,
        y: 0,
        half: 0
    }));
};

/**
 * Gives a drifter a new shape and a new place.
 *
 * @param {Drifter} drifter - The drifter.
 * @param {number} bottom - The height of its lower edge.
 */
const recycle = (drifter, bottom) => {
    const frame = Math.floor(Math.random() * drifter.frames.length);
    const { width, height } = sheet.size(drifter.frames[frame]);
    drifter.entity.sprite.frame = frame;
    drifter.entity.sprite.flipX = Math.random() < 0.5;
    drifter.half = height / 2;
    drifter.x = random(width * 0.2, WIDTH - width * 0.2);
    drifter.y = Math.round(bottom) + drifter.half;
};

/**
 * @param {Drifter[]} list - The drifters.
 * @param {number} distance - How far they drift down the screen, in pixels.
 * @param {number} gap - The most space between one and the next, in pixels.
 */
const drift = (list, distance, gap) => {
    for (const drifter of list) {
        drifter.y -= distance;
        if (drifter.y < -drifter.half) {
            const top = Math.max(HEIGHT, ...list.map((other) => other.y + other.half));
            recycle(drifter, top + random(gap * 0.3, gap));
        }
        place(drifter.entity, drifter.x, drifter.y);
    }
};

const islands = drifters('island', 3, Z.island, 1);
const clouds = drifters('cloud', 3, Z.cloud, 0.9);
islands.forEach((island, i) => recycle(island, 90 + i * 190));
clouds.forEach((cloud, i) => recycle(cloud, 40 + i * 230));

// ------------------------------------------------------------------------------------ the player

const player = {
    entity: spawn(
        'player',
        Z.player,
        {
            type: SPRITETYPE_ANIMATED,
            // each clip is two frames, for the propeller, with the wings level or banked into a turn
            clips: {
                level: { fps: 24, loop: true, sprite: sheet.animation('player-level') },
                left: { fps: 24, loop: true, sprite: sheet.animation('player-left') },
                right: { fps: 24, loop: true, sprite: sheet.animation('player-right') }
            },
            autoPlayClip: 'level'
        },
        false
    ),
    shadow: spawn(
        'player-shadow',
        Z.shadow,
        {
            sprite: sheet.sprite(['player-level-0', 'player-left-0', 'player-right-0']),
            color: SHADOW_COLOR,
            opacity: SHADOW_OPACITY
        },
        false
    ),
    x: WIDTH / 2,
    y: 40,
    alive: false,
    lives: 0,
    // how many guns: 1 to 3
    power: 1,
    // seconds until the guns fire again, until a lost seaplane is replaced, and of safety after
    cooldown: 0,
    respawn: 0,
    shield: 0
};
const BANKS = ['level', 'left', 'right'];
const PLAYER_SPEED = 112;
const PLAYER_RADIUS = 3;

// The guns at each power: where each shot starts across the wings, and how fast it goes sideways
const GUNS = [
    [
        [-4, 0],
        [4, 0]
    ],
    [
        [-7, -26],
        [0, 0],
        [7, 26]
    ],
    [
        [-10, -62],
        [-5, -24],
        [0, 0],
        [5, 24],
        [10, 62]
    ]
];
const SHOT_SPEED = 300;
const FIRE_EVERY = 0.13;

// Something that is hit shows white for a moment, and then not again for a while
const FLASH_TIME = 0.05;
const FLASH_GAP = 0.16;

// ------------------------------------------------------------------------------------ pools

/**
 * A shot, the player's or a raider's.
 *
 * @typedef {object} Shot
 * @property {Entity} entity - Its sprite.
 * @property {boolean} active - Whether it is in play.
 * @property {number} x - Its position.
 * @property {number} y - Its position.
 * @property {number} vx - Its velocity.
 * @property {number} vy - Its velocity.
 */

/**
 * @param {number} size - The number of shots.
 * @param {number} z - How far they are from the camera.
 * @param {object} data - The sprite component data.
 * @returns {Pool<Shot>} The shots.
 */
const shotPool = (size, z, data) => {
    return new Pool(size, () => ({ entity: spawn('shot', z, data), active: false, x: 0, y: 0, vx: 0, vy: 0 }));
};

const shots = shotPool(48, Z.shot, { sprite: sheet.sprite(['shot-0']) });
const needles = shotPool(40, Z.orb, { sprite: sheet.sprite(['needle-0']) });
// an orb pulses, which a clip that starts with the entity does
const orbs = shotPool(150, Z.orb, {
    type: SPRITETYPE_ANIMATED,
    clips: { pulse: { fps: 8, loop: true, sprite: sheet.animation('orb') } },
    autoPlayClip: 'pulse'
});

/**
 * @param {Pool<Shot>} pool - The pool the shot is from.
 * @param {number} x - Where the shot starts.
 * @param {number} y - Where the shot starts.
 * @param {number} vx - Its velocity.
 * @param {number} vy - Its velocity.
 */
const fire = (pool, x, y, vx, vy) => {
    const shot = pool.spawn();
    if (!shot) return;
    shot.x = x;
    shot.y = y;
    shot.vx = vx;
    shot.vy = vy;
    place(shot.entity, x, y);
};

// The raiders. Each type has a sprite of its frames, then the white frame it shows when hit.
/** @type {Pool<Enemy>} */
const enemies = new Pool(40, () => {
    const dart = sheet.sprite([...sheet.frames('dart'), 'dart-flash']);
    return /** @type {Enemy} */ ({
        entity: spawn('enemy', Z.enemy, { sprite: dart }),
        shadow: spawn('enemy-shadow', Z.shadow, { sprite: dart, color: SHADOW_COLOR, opacity: SHADOW_OPACITY }, false),
        active: false
    });
});

/**
 * @param {Enemy} enemy - The raider to take out of play.
 */
const freeEnemy = (enemy) => {
    enemies.free(enemy);
    enemy.shadow.enabled = false;
};

// Explosions: an entity with a clip for each kind, which plays once and goes back to the pool
const effects = new Pool(40, () => {
    const entity = spawn('effect', Z.effect, {
        type: SPRITETYPE_ANIMATED,
        clips: {
            boom: { fps: 18, loop: false, sprite: sheet.animation('boom') },
            blast: { fps: 15, loop: false, sprite: sheet.animation('blast') },
            spark: { fps: 24, loop: false, sprite: sheet.animation('spark') }
        }
    });
    const item = { entity, active: false };
    entity.sprite.on('end', () => effects.free(item));
    return item;
});

/**
 * @param {'boom'|'blast'|'spark'} kind - The clip to play.
 * @param {number} x - Where it plays.
 * @param {number} y - Where it plays.
 */
const effect = (kind, x, y) => {
    const item = effects.spawn();
    if (!item) return;
    place(item.entity, x, y);
    item.entity.sprite.play(kind);
};

// Power ups: more guns, or another seaplane
const pickups = new Pool(6, () => ({
    entity: spawn('pickup', Z.pickup, {
        type: SPRITETYPE_ANIMATED,
        clips: {
            power: { fps: 8, loop: true, sprite: sheet.animation('power') },
            life: { fps: 8, loop: true, sprite: sheet.animation('life') }
        }
    }),
    active: false,
    kind: 'power',
    x: 0,
    y: 0,
    age: 0
}));

/**
 * @param {'power'|'life'} kind - What it gives.
 * @param {number} x - Where it appears.
 * @param {number} y - Where it appears.
 */
const drop = (kind, x, y) => {
    const pickup = pickups.spawn();
    if (!pickup) return;
    pickup.kind = kind;
    pickup.x = Math.max(12, Math.min(WIDTH - 12, x));
    pickup.y = y;
    pickup.age = 0;
    pickup.entity.sprite.play(kind);
};

// ------------------------------------------------------------------------------------ the airship

const bossSprite = sheet.sprite(['boss-0', 'boss-flash']);
const boss = {
    entity: spawn('boss', Z.enemy, { sprite: bossSprite }, false),
    shadow: spawn('boss-shadow', Z.shadow, { sprite: bossSprite, color: SHADOW_COLOR, opacity: SHADOW_OPACITY }, false),
    // 'away', 'warning' before it arrives, 'fight', then 'sinking' as it goes up
    state: 'away',
    timer: 0,
    hp: 0,
    hpMax: 1,
    flash: 0,
    x: WIDTH / 2,
    y: HEIGHT + 40,
    age: 0,
    cooldown: 0,
    attack: 0,
    burst: 0,
    burstTimer: 0
};

// Its strength, across the top of the screen: a white pixel of the sheet, stretched and tinted
const BAR_WIDTH = 120;
const pixel = sheet.sprite(['pixel']);
const barBack = spawn('bar-back', Z.hud, { sprite: pixel, color: new Color(0.08, 0.09, 0.15) }, false);
const barFill = spawn('bar-fill', Z.hud + 1, { sprite: pixel, color: new Color().fromString('#ff4f9a') }, false);
barBack.setLocalScale(BAR_WIDTH / 2 + 1, 3, 1);
place(barBack, WIDTH / 2, HEIGHT - 18);

// A flash over the whole screen, as the airship goes up
const flash = spawn('flash', Z.hud - 1, { sprite: pixel, opacity: 0 }, false);
flash.setLocalScale(WIDTH / 2, HEIGHT / 2, 1);
place(flash, WIDTH / 2, HEIGHT / 2);

// ------------------------------------------------------------------------------------ the HUD

const YELLOW = new Color().fromString('#ffd23f');
const PINK = new Color().fromString('#ff4f9a');

const scoreLabel = new Label(sheet, app.root, { length: 6, position: [4, HEIGHT - 7, Z.hud] });
const bestLabel = new Label(sheet, app.root, {
    length: 9,
    position: [WIDTH - 3, HEIGHT - 7, Z.hud],
    align: 'right',
    color: YELLOW
});
const titleLabel = new Label(sheet, app.root, {
    length: 12,
    position: [WIDTH / 2, 168, Z.hud],
    align: 'center',
    scale: 2,
    color: YELLOW
});
const messageLabel = new Label(sheet, app.root, { length: 24, position: [WIDTH / 2, 136, Z.hud], align: 'center' });
const hintLabel = new Label(sheet, app.root, { length: 28, position: [WIDTH / 2, 96, Z.hud], align: 'center' });
const lifeIcons = Array.from({ length: 5 }, (_, i) => {
    const icon = spawn('life', Z.hud, { sprite: sheet.sprite(['icon-life']) });
    place(icon, 8 + i * 11, 8);
    return icon;
});

const pad = (/** @type {number} */ value) => String(Math.min(value, 999999)).padStart(6, '0');

// ------------------------------------------------------------------------------------ the game

// 'title', 'play' or 'over'
let state = 'title';
let time = 0;
let score = 0;
let best = 0;
try {
    best = Number(localStorage.getItem('storm-petrel-best')) || 0;
} catch {
    // no storage, so the best score lasts as long as the page
}

// the stage: its clock, the next raider to arrive, and how many times it has been cleared
let stageTime = 0;
let arrival = 0;
let shake = 0;
let message = '';
let messageTime = 0;

/**
 * @param {string} text - A message for the middle of the screen.
 * @param {number} seconds - How long it shows.
 */
const announce = (text, seconds) => {
    message = text;
    messageTime = seconds;
};

/** @type {World} */
const world = {
    player,
    loop: 0,
    scrolled: 0,
    orb: (x, y, vx, vy) => fire(orbs, x, y, vx, vy),
    needle: (x, y, vx, vy) => fire(needles, x, y, vx, vy)
};

const within = (/** @type {number} */ dx, /** @type {number} */ dy, /** @type {number} */ radius) =>
    dx * dx + dy * dy < radius * radius;

/**
 * @param {number} points - The points scored.
 */
const award = (points) => {
    score += points;
    if (score > best) {
        best = score;
        try {
            localStorage.setItem('storm-petrel-best', String(best));
        } catch {
            // no storage
        }
    }
};

const clearField = () => {
    enemies.items.forEach((enemy) => enemy.active && freeEnemy(enemy));
    for (const pool of [shots, needles, orbs, effects, pickups]) {
        pool.freeAll();
    }
    boss.state = 'away';
    boss.entity.enabled = boss.shadow.enabled = barBack.enabled = barFill.enabled = false;
};

const startGame = () => {
    clearField();
    state = 'play';
    score = 0;
    stageTime = 0;
    arrival = 0;
    world.loop = 0;
    player.lives = 2;
    player.power = 1;
    player.alive = true;
    player.shield = 2;
    player.x = WIDTH / 2;
    player.y = 40;
    player.entity.enabled = true;
    announce('STAGE 1', 2);
    sounds.start();
};

const losePlayer = () => {
    player.alive = false;
    player.respawn = 1.3;
    player.entity.enabled = player.shadow.enabled = false;
    effect('blast', player.x, player.y);
    sounds.crash();
    shake = 7;
};

/**
 * @param {Enemy} enemy - The raider that was destroyed.
 */
const destroyEnemy = (enemy) => {
    const { type } = enemy;
    effect(type.big ? 'blast' : 'boom', enemy.x, enemy.y);
    if (type.big) {
        sounds.blast();
        shake = Math.max(shake, 4);
    } else {
        sounds.boom();
    }
    award(type.score * (1 + world.loop));
    if (Math.random() < type.drop) drop('power', enemy.x, enemy.y);
    freeEnemy(enemy);
};

// ------------------------------------------------------------------------------------ input

const keyboard = /** @type {Keyboard} */ (app.keyboard);
const held = (/** @type {number[]} */ ...keys) => keys.some((key) => keyboard.isPressed(key));

// A drag moves the seaplane by as much, wherever it started, so a thumb need not cover it
const pointer = { down: false, pressed: false, x: 0, y: 0, dx: 0, dy: 0 };
const onPointerDown = (/** @type {PointerEvent} */ event) => {
    pointer.down = pointer.pressed = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    canvas.setPointerCapture(event.pointerId);
};
const onPointerMove = (/** @type {PointerEvent} */ event) => {
    if (!pointer.down) return;
    const scale = WIDTH / canvas.clientWidth;
    pointer.dx += (event.clientX - pointer.x) * scale;
    pointer.dy -= (event.clientY - pointer.y) * scale;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
};
const onPointerUp = () => {
    pointer.down = false;
};
canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerup', onPointerUp);
canvas.addEventListener('pointercancel', onPointerUp);

app.on('destroy', () => {
    window.removeEventListener('resize', fit);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.style.cssText = canvasStyle;
    sheet.destroy();
});

// ------------------------------------------------------------------------------------ updates

/**
 * @param {number} dt - The time step.
 */
const updatePlayer = (dt) => {
    if (!player.alive) {
        // a lost seaplane is replaced after a moment, while there is one to replace it
        player.respawn -= dt;
        if (player.respawn < 0) {
            if (player.lives > 0) {
                player.lives--;
                player.alive = true;
                player.shield = 2.5;
                player.power = Math.max(1, player.power - 1);
                player.x = WIDTH / 2;
                player.y = 40;
            } else if (state === 'play') {
                state = 'over';
                announce('GAME OVER', Infinity);
            }
        }
        return;
    }

    // fly
    const dx = (held(KEY_RIGHT, KEY_D) ? 1 : 0) - (held(KEY_LEFT, KEY_A) ? 1 : 0);
    const dy = (held(KEY_UP, KEY_W) ? 1 : 0) - (held(KEY_DOWN, KEY_S) ? 1 : 0);
    const speed = dx && dy ? PLAYER_SPEED * Math.SQRT1_2 : PLAYER_SPEED;
    player.x = Math.max(11, Math.min(WIDTH - 11, player.x + dx * speed * dt + pointer.dx));
    player.y = Math.max(13, Math.min(HEIGHT - 40, player.y + dy * speed * dt + pointer.dy));

    // bank into a turn
    const bank = dx < 0 || pointer.dx < -0.5 ? 1 : dx > 0 || pointer.dx > 0.5 ? 2 : 0;
    const { sprite } = player.entity;
    if (sprite.currentClip.name !== BANKS[bank]) sprite.play(BANKS[bank]);
    player.shadow.sprite.frame = bank;

    // fire
    player.cooldown -= dt;
    if ((held(KEY_SPACE, KEY_Z) || pointer.down) && player.cooldown < 0) {
        player.cooldown = FIRE_EVERY;
        for (const [offset, vx] of GUNS[player.power - 1]) {
            fire(shots, player.x + offset, player.y + 10, vx, SHOT_SPEED);
        }
        sounds.shot();
    }

    // blink while it cannot be hit
    player.shield -= dt;
    const visible = player.shield < 0 || Math.floor(time * 16) % 2 === 0;
    player.entity.enabled = player.shadow.enabled = visible;
    place(player.entity, player.x, player.y);
    place(player.shadow, player.x + SHADOW_X, player.y + SHADOW_Y);
};

/**
 * @param {number} dt - The time step.
 */
const updateShots = (dt) => {
    for (const shot of shots.items) {
        if (!shot.active) continue;
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        if (shot.y > HEIGHT + 8) {
            shots.free(shot);
            continue;
        }
        place(shot.entity, shot.x, shot.y);

        // the airship, a box
        if (
            boss.state === 'fight' &&
            Math.abs(shot.x - boss.x) < BOSS.halfWidth &&
            Math.abs(shot.y - boss.y) < BOSS.halfHeight
        ) {
            shots.free(shot);
            effect('spark', shot.x, shot.y);
            // under steady fire it flashes now and then, rather than staying white
            if (boss.flash < -FLASH_GAP) boss.flash = FLASH_TIME;
            boss.hp--;
            sounds.hit();
            continue;
        }

        for (const enemy of enemies.items) {
            if (!enemy.active || !within(shot.x - enemy.x, shot.y - enemy.y, enemy.type.radius + 3)) continue;
            shots.free(shot);
            if (--enemy.hp <= 0) {
                destroyEnemy(enemy);
            } else {
                effect('spark', shot.x, shot.y);
                if (enemy.flash < -FLASH_GAP) enemy.flash = FLASH_TIME;
                sounds.hit();
            }
            break;
        }
    }

    // the raiders' shots
    for (const pool of [orbs, needles]) {
        for (const shot of pool.items) {
            if (!shot.active) continue;
            shot.x += shot.vx * dt;
            shot.y += shot.vy * dt;
            if (shot.x < -8 || shot.x > WIDTH + 8 || shot.y < -8 || shot.y > HEIGHT + 8) {
                pool.free(shot);
                continue;
            }
            place(shot.entity, shot.x, shot.y);
            if (player.alive && player.shield < 0 && within(shot.x - player.x, shot.y - player.y, PLAYER_RADIUS + 2)) {
                pool.free(shot);
                losePlayer();
            }
        }
    }
};

/**
 * @param {number} dt - The time step.
 */
const updateEnemies = (dt) => {
    // the raiders due by now, while the game is on
    const due = state === 'play' ? stageTime : -Infinity;
    while (arrival < ARRIVALS.length && ARRIVALS[arrival].at <= due) {
        const { type, path, x, side, index } = ARRIVALS[arrival++];
        const enemy = enemies.spawn();
        if (!enemy) continue;
        const sprite = sheet.sprite([...sheet.frames(type.frames), `${type.frames}-flash`]);
        Object.assign(enemy, {
            type,
            path,
            x,
            x0: x,
            y: HEIGHT + 18,
            vx: 0,
            vy: 0,
            side,
            index,
            age: 0,
            flash: 0,
            cooldown: 0.6
        });
        enemy.hp = Math.ceil(type.hp * (1 + world.loop * 0.5));
        enemy.entity.sprite.sprite = sprite;
        enemy.shadow.sprite.sprite = sprite;
        enemy.shadow.enabled = !type.sea;
        enemy.entity.setLocalPosition(x, enemy.y, type.sea ? Z.boat : Z.enemy);
    }

    for (const enemy of enemies.items) {
        if (!enemy.active) continue;
        const { type } = enemy;
        enemy.age += dt;
        enemy.cooldown -= dt;
        enemy.flash -= dt;
        PATHS[enemy.path](enemy, dt, world);
        if (player.alive) type.shoot(enemy, dt, world);

        // gone off the screen
        if (enemy.age > 1 && (enemy.x < -24 || enemy.x > WIDTH + 24 || enemy.y < -24 || enemy.y > HEIGHT + 40)) {
            freeEnemy(enemy);
            continue;
        }

        // its frames, then its white one
        const frames = enemy.entity.sprite.sprite.frameKeys.length - 1;
        enemy.entity.sprite.frame = enemy.flash > 0 ? frames : Math.floor(enemy.age * 10) % frames;
        place(enemy.entity, enemy.x, enemy.y);
        place(enemy.shadow, enemy.x + SHADOW_X, enemy.y + SHADOW_Y);

        // flown into
        if (
            !type.sea &&
            player.alive &&
            player.shield < 0 &&
            within(enemy.x - player.x, enemy.y - player.y, type.radius + PLAYER_RADIUS + 2)
        ) {
            losePlayer();
            if (--enemy.hp <= 0) destroyEnemy(enemy);
        }
    }
};

/**
 * @param {number} dt - The time step.
 */
const updateBossFight = (dt) => {
    if (boss.state === 'away') {
        // it is announced once the raiders are through
        if (state === 'play' && stageTime > BOSS_AT) {
            boss.state = 'warning';
            boss.timer = 2.6;
            announce('WARNING!', 2.6);
            sounds.alarm();
        }
        return;
    }

    boss.timer -= dt;
    if (boss.state === 'warning') {
        if (boss.timer < 0) {
            boss.state = 'fight';
            boss.hpMax = boss.hp = Math.ceil(BOSS.hp * (1 + world.loop * 0.4));
            boss.x = WIDTH / 2;
            boss.y = HEIGHT + 40;
            boss.age = boss.attack = boss.burst = 0;
            boss.cooldown = 1.5;
            boss.entity.enabled = boss.shadow.enabled = barBack.enabled = barFill.enabled = true;
        }
        return;
    }

    if (boss.state === 'fight') {
        updateBoss(boss, dt, player.alive ? world : { ...world, orb() {}, needle() {} });
        if (
            player.alive &&
            player.shield < 0 &&
            Math.abs(player.x - boss.x) < BOSS.halfWidth &&
            Math.abs(player.y - boss.y) < BOSS.halfHeight
        ) {
            losePlayer();
        }
        if (boss.hp <= 0) {
            boss.state = 'sinking';
            boss.timer = 2.2;
            orbs.freeAll();
            needles.freeAll();
            barBack.enabled = barFill.enabled = false;
        }
    } else {
        // going up: explosions along it, then one flash
        boss.y -= 8 * dt;
        if (Math.random() < dt * 14) {
            effect(Math.random() < 0.5 ? 'blast' : 'boom', boss.x + random(-56, 56), boss.y + random(-14, 14));
            sounds.blast();
            shake = Math.max(shake, 3);
        }
        if (boss.timer < 0) {
            boss.state = 'away';
            boss.entity.enabled = boss.shadow.enabled = false;
            flash.enabled = true;
            flash.sprite.opacity = 1;
            shake = 9;
            award(BOSS.score * (1 + world.loop));
            drop('life', boss.x, boss.y);
            // the stage starts again, harder
            world.loop++;
            stageTime = -5;
            arrival = 0;
            announce(`STAGE ${world.loop + 1}`, 3);
            return;
        }
    }

    boss.flash -= dt;
    boss.entity.sprite.frame = boss.flash > 0 ? 1 : 0;
    place(boss.entity, boss.x, boss.y);
    place(boss.shadow, boss.x + SHADOW_X * 2, boss.y + SHADOW_Y * 2);

    const width = Math.max(0, (BAR_WIDTH * boss.hp) / boss.hpMax);
    barFill.setLocalScale(width / 2, 2, 1);
    place(barFill, WIDTH / 2 - BAR_WIDTH / 2 + width / 2, HEIGHT - 18);
};

/**
 * @param {number} dt - The time step.
 */
const updatePickups = (dt) => {
    for (const pickup of pickups.items) {
        if (!pickup.active) continue;
        pickup.age += dt;
        pickup.y -= 28 * dt;
        if (pickup.y < -10) {
            pickups.free(pickup);
            continue;
        }
        place(pickup.entity, pickup.x + Math.sin(pickup.age * 2.5) * 6, pickup.y);
        if (player.alive && within(pickup.x - player.x, pickup.y - player.y, 14)) {
            pickups.free(pickup);
            sounds.pickup();
            if (pickup.kind === 'life') {
                player.lives = Math.min(lifeIcons.length, player.lives + 1);
            } else if (player.power < GUNS.length) {
                player.power++;
            } else {
                award(1000);
            }
        }
    }
};

/**
 * @param {number} dt - The time step.
 */
const updateHud = (dt) => {
    scoreLabel.text = pad(score);
    bestLabel.text = `HI ${pad(best)}`;
    lifeIcons.forEach((icon, i) => {
        icon.enabled = state !== 'title' && i < player.lives;
    });

    const title = state === 'title';
    titleLabel.visible = title;
    titleLabel.text = 'STORM PETREL';
    hintLabel.visible = state !== 'play' && Math.floor(time * 2.5) % 2 === 0;
    hintLabel.text = 'PRESS SPACE OR TAP';

    messageTime -= dt;
    messageLabel.visible = !title && messageTime > 0 && (message !== 'WARNING!' || Math.floor(time * 6) % 2 === 0);
    messageLabel.text = message;
    messageLabel.color = message === 'WARNING!' || message === 'GAME OVER' ? PINK : Color.WHITE;

    // the flash fades
    if (flash.enabled) {
        flash.sprite.opacity = Math.max(0, flash.sprite.opacity - dt * 2.2);
        flash.enabled = flash.sprite.opacity > 0;
    }
};

let scroll = 0;
app.on('update', (frameDt) => {
    const dt = Math.min(frameDt, 1 / 30);
    time += dt;

    // the sea slides down a tile and starts again, and the islands go with it, pixel for pixel
    const scrolled = Math.floor(time * SCROLL_SPEED + SCROLL_START);
    place(sea, WIDTH / 2, HEIGHT / 2 + SEA_TILE / 2 - (scrolled % SEA_TILE));
    world.scrolled = scrolled - scroll;
    scroll = scrolled;
    drift(islands, world.scrolled, 220);
    drift(clouds, 58 * dt, 420);

    if (state === 'play') {
        stageTime += dt;
    } else if (pointer.pressed || keyboard.wasPressed(KEY_SPACE) || keyboard.wasPressed(KEY_ENTER)) {
        // from the title, or a moment after the game is over
        if (state === 'title' || player.respawn < -1) startGame();
    }

    if (state !== 'title') {
        updatePlayer(dt);
        updateEnemies(dt);
        updateBossFight(dt);
        updateShots(dt);
        updatePickups(dt);
    }
    updateHud(dt);

    // the screen shakes by whole pixels, and settles
    shake = Math.max(0, shake - dt * 18);
    camera.setPosition(
        WIDTH / 2 + Math.round(random(-shake, shake)),
        HEIGHT / 2 + Math.round(random(-shake, shake)),
        50
    );

    pointer.dx = pointer.dy = 0;
    pointer.pressed = false;
});

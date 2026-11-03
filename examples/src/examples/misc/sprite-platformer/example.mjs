// @config
//
// A little platformer drawn from one **TexturePacker** sprite sheet. The texture atlas loads the
// sheet's JSON, with each frame's pivot and the platform's 9-slice borders, and the frame names
// give the slime and coins their animation clips. Collect all twelve coins.
//
// `←` `→` Hop · `Space` Jump

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    KEY_A,
    KEY_D,
    KEY_LEFT,
    KEY_RIGHT,
    KEY_SPACE,
    KEY_UP,
    KEY_W,
    Keyboard,
    PROJECTION_ORTHOGRAPHIC,
    RESOLUTION_AUTO,
    SPRITETYPE_ANIMATED,
    SPRITETYPE_SIMPLE,
    SPRITE_RENDERMODE_SIMPLE,
    SPRITE_RENDERMODE_TILED,
    Sprite,
    SpriteComponentSystem,
    TextureAtlasHandler,
    TextureHandler,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// The sprite sheet as TexturePacker's PlayCanvas exporter writes it: the JSON names its image,
// platformer.png, beside it. Pixel art is read pixel for pixel, with no filtering or mipmaps.
const sheet = new Asset(
    'platformer',
    'textureatlas',
    { url: './assets/sprites/platformer.json' },
    {
        srgb: true,
        mipmaps: false,
        minfilter: 'nearest',
        magfilter: 'nearest'
    }
);

const device = await createGraphicsDevice(canvas, { deviceTypes: [deviceType] });
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.keyboard = new Keyboard(window);
createOptions.componentSystems = [CameraComponentSystem, SpriteComponentSystem];
createOptions.resourceHandlers = [TextureHandler, TextureAtlasHandler];

const app = new AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

await new Promise((resolve) => {
    new AssetListLoader([sheet], app.assets).load(resolve);
});
app.start();

const atlas = sheet.resource;
const PIXELS_PER_UNIT = 16;

/**
 * @param {string[]} frameKeys - The frames of the sprite, by name.
 * @param {number} [renderMode] - Tiled sprites repeat their frame to fill their width and height.
 * @returns {Sprite} A sprite of the frames.
 */
const sprite = (frameKeys, renderMode = SPRITE_RENDERMODE_SIMPLE) =>
    new Sprite(device, {
        atlas,
        frameKeys,
        pixelsPerUnit: PIXELS_PER_UNIT,
        renderMode
    });

/**
 * @param {string} name - The entity name.
 * @param {number[]} position - The x, y and z position.
 * @param {object} data - The sprite component data.
 * @param {Entity} [parent] - The parent entity.
 * @returns {Entity} An entity with a sprite component.
 */
const spawn = (name, [x, y, z], data, parent = app.root) => {
    const entity = new Entity(name);
    entity.addComponent('sprite', { type: SPRITETYPE_SIMPLE, ...data });
    entity.setLocalPosition(x, y, z);
    parent.addChild(entity);
    return entity;
};

/**
 * Animation clips from the frame names: the slime's hop clip plays slime-hop-0, slime-hop-1 and
 * so on, in the sheet's order.
 *
 * @param {string} prefix - The start of the frame names.
 * @param {[string, number, boolean][]} list - The name, frames per second and looping of each clip.
 * @returns {{ name: string, fps: number, loop: boolean, sprite: Sprite }[]} The clips.
 */
const clips = (prefix, list) =>
    list.map(([name, fps, loop]) => ({
        name,
        fps,
        loop,
        sprite: sprite(Object.keys(atlas.frames).filter((key) => key.startsWith(`${prefix}-${name}-`)))
    }));

/**
 * @param {string} name - The entity name.
 * @param {number[]} position - The x, y and z position.
 * @param {ReturnType<typeof clips>} clipList - The clips, the first of which plays to begin with.
 * @returns {Entity} An entity with an animated sprite component.
 */
const animated = (name, position, clipList) => {
    const entity = spawn(name, position, { type: SPRITETYPE_ANIMATED });
    for (const { sprite: clipSprite, ...clip } of clipList) {
        entity.sprite.addClip(clip).sprite = clipSprite;
    }
    entity.sprite.autoPlayClip = clipList[0].name;
    return entity;
};

const camera = new Entity('camera');
camera.addComponent('camera', {
    projection: PROJECTION_ORTHOGRAPHIC,
    clearColor: new Color().fromString('#161a3c')
});
camera.setPosition(0, 3, 10);
app.root.addChild(camera);

// The backdrop, back to front. Each layer follows the camera by its parallax fraction, so the
// farther it is, the less it seems to move. Clouds drift too.
const layers = [
    { key: 'sky', at: [0, 1, -10], size: [96, 10], parallax: 1 },
    { key: 'night', at: [0, 11, -10], size: [96, 30], parallax: 1 },
    { key: 'stars', at: [0, 5, -9.5], size: [96, 30], parallax: 0.92 },
    { key: 'moon', at: [5.5, 6.25, -9], parallax: 0.94 },
    { key: 'mountains', at: [0, 0.75, -8], size: [96, 3], parallax: 0.75 },
    { key: 'cloud-0', at: [-14, 5.5, -7], parallax: 0.6, drift: 0.35, opacity: 0.9 },
    { key: 'cloud-1', at: [-3, 6.5, -7], parallax: 0.6, drift: 0.25, opacity: 0.8 },
    { key: 'cloud-0', at: [9, 5, -7], parallax: 0.6, drift: 0.3, opacity: 0.9 },
    { key: 'cloud-1', at: [21, 6.75, -7], parallax: 0.6, drift: 0.2, opacity: 0.8 },
    { key: 'hills', at: [0, -0.25, -6], size: [96, 2.5], parallax: 0.45 }
].map((layer) => ({
    ...layer,
    entity: spawn(layer.key, layer.at, {
        sprite: sprite([layer.key], layer.size ? SPRITE_RENDERMODE_TILED : SPRITE_RENDERMODE_SIMPLE),
        width: layer.size?.[0],
        height: layer.size?.[1],
        opacity: layer.opacity ?? 1
    })
}));

// The ground: a strip of grass over a deep block of dirt, both tiling their frame
spawn('grass', [0, 0, 0], { sprite: sprite(['grass'], SPRITE_RENDERMODE_TILED), width: 96, height: 1 });
spawn('dirt', [0, -1, 0], { sprite: sprite(['dirt'], SPRITE_RENDERMODE_TILED), width: 96, height: 12 });

// Platforms: one sprite at any width. Its 9-slice borders keep the ends whole as the middle tiles.
const platformSprite = sprite(['platform'], SPRITE_RENDERMODE_TILED);
const platforms = [
    [-14, 2, 3.75],
    [-9.5, 4, 2.75],
    [-3.5, 2.25, 4.75],
    [2, 4.25, 3.75],
    [7, 6, 2.75],
    [12.5, 2.5, 4.75],
    [19, 2, 2.75]
].map(([x, top, width]) => {
    spawn('platform', [x, top, -1], { sprite: platformSprite, width, height: 1 });
    return { x, top, half: width / 2 };
});

// Decorations: one sprite, showing a different one of its frames on each
const decorFrames = ['tuft', 'flower-red', 'flower-yellow', 'flower-blue', 'mushroom', 'rock'];
const decorSprite = sprite(decorFrames);
/** @type {[number, number, string][]} */
const decor = [
    [-22, 0, 'tuft'],
    [-20.5, 0, 'flower-red'],
    [-17, 0, 'rock'],
    [-14.9, 2, 'tuft'],
    [-11.5, 0, 'mushroom'],
    [-8, 0, 'flower-blue'],
    [-7.4, 0, 'tuft'],
    [-1, 0, 'flower-yellow'],
    [2.9, 4.25, 'flower-blue'],
    [3.5, 0, 'rock'],
    [6, 0, 'flower-red'],
    [9.5, 0, 'tuft'],
    [10.2, 0, 'flower-yellow'],
    [14.4, 2.5, 'mushroom'],
    [16.5, 0, 'tuft'],
    [21.5, 0, 'flower-blue'],
    [22.5, 0, 'rock']
];
for (const [x, y, frame] of decor) {
    spawn('decor', [x, y, -0.5], { sprite: decorSprite, frame: decorFrames.indexOf(frame) });
}

// Coins spin until the slime touches one, which plays its one-shot collect clip and goes
const coinClips = clips('coin', [
    ['spin', 10, true],
    ['collect', 15, false]
]);
const coins = [
    [-19, 0.75],
    [-14, 2.75],
    [-9.5, 4.75],
    [-6.5, 0.75],
    [-4.5, 3],
    [-2.5, 3],
    [2, 5],
    [4.75, 0.75],
    [7, 6.75],
    [11.5, 3.25],
    [13.5, 3.25],
    [19, 2.75]
].map(([x, y]) => {
    const entity = animated('coin', [x, y, 0.5], coinClips);
    entity.sprite.on('end', (clip) => {
        if (clip.name === 'collect') entity.enabled = false;
    });
    return { entity, x, y, collected: false };
});

// The coin count: a row of coin icons at the top of the view, lit from the left as coins are
// collected
const iconSprite = sprite(['coin-spin-0']);
const icons = coins.map(() => spawn('icon', [0, 0, -1], { sprite: iconSprite, opacity: 0.3 }, camera));

const shadow = spawn('shadow', [-18, 0, 0.9], { sprite: sprite(['shadow']), opacity: 0.35 });
const slime = animated(
    'slime',
    [-18, 0, 1],
    clips('slime', [
        ['idle', 8, true],
        ['hop', 12, true],
        ['jump', 12, false],
        ['fall', 8, true],
        ['land', 12, false]
    ])
);

// Input: the arrow keys or A and D hop, and Space, W or the up arrow jump. A touch screen gets
// buttons along the bottom instead.
const keyboard = /** @type {Keyboard} */ (app.keyboard);
const keys = { left: [KEY_LEFT, KEY_A], right: [KEY_RIGHT, KEY_D], jump: [KEY_SPACE, KEY_UP, KEY_W] };
const touch = { left: false, right: false, jump: false };
const held = (action) => touch[action] || keys[action].some((key) => keyboard.isPressed(key));

if (window.matchMedia('(pointer: coarse)').matches) {
    const buttons = [
        ['left', '◀', 'left: 20px'],
        ['right', '▶', 'left: 100px'],
        ['jump', '▲', 'right: 20px']
    ];
    for (const [action, label, side] of buttons) {
        const button = document.createElement('button');
        button.textContent = label;
        button.style.cssText = `position: absolute; bottom: 20px; ${side}; width: 64px; height: 64px;
            border: 2px solid #fff3d080; border-radius: 50%; background: #161a3c8c; color: #fff3d0;
            font: 26px system-ui; touch-action: none;`;
        button.addEventListener('pointerdown', (event) => {
            touch[action] = true;
            button.setPointerCapture(event.pointerId);
        });
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
            button.addEventListener(type, () => {
                // a jump is taken when the update sees it, so only a held direction lets go
                if (action !== 'jump') touch[action] = false;
            });
        }
        document.body.appendChild(button);
        app.on('destroy', () => button.remove());
    }
}

// The view shows at least 160 atlas pixels each way, with each atlas pixel a whole number of
// screen pixels, keeping every sprite pixel the same size
let viewWidth = 0;
let viewHeight = 0;
const fitView = () => {
    const { width, height } = device;
    if (width === viewWidth && height === viewHeight) return;
    viewWidth = width;
    viewHeight = height;
    const zoom = Math.max(1, Math.floor(Math.min(width, height) / 160));
    camera.camera.orthoHeight = height / (2 * PIXELS_PER_UNIT * zoom);
    icons.forEach((icon, i) => {
        icon.setLocalPosition((i - (icons.length - 1) / 2) * 0.8, camera.camera.orthoHeight - 0.75, -1);
    });
};

const WORLD_EDGE = 23;
const RUN_SPEED = 6;
const GRAVITY = 38;
const JUMP_SPEED = 14;
const FOOT = 0.3;

// The top of the highest surface under x, at or below y
const supportBelow = (x, y) =>
    platforms.reduce((support, p) => {
        const under = Math.abs(x - p.x) <= p.half + FOOT && p.top <= y + 1e-3;
        return under && p.top > support ? p.top : support;
    }, 0);

const position = slime.getPosition().clone();
let vy = 0;
let grounded = true;
let lastGrounded = 0;
let landTimer = 0;
let cameraX = position.x;
let collected = 0;
let respawnAt = Infinity;
let jumpRequested = -Infinity;
let time = 0;

app.on('update', (frameDt) => {
    const dt = Math.min(frameDt, 1 / 30);
    time += dt;
    fitView();

    // Hop
    const direction = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
    if (direction !== 0) slime.sprite.flipX = direction < 0;
    position.x = Math.max(-WORLD_EDGE, Math.min(WORLD_EDGE, position.x + direction * RUN_SPEED * dt));

    // Jump, forgiving a press a moment before landing or after running off an edge
    if (touch.jump || keys.jump.some((key) => keyboard.wasPressed(key))) {
        jumpRequested = time;
        touch.jump = false;
    }
    if (grounded) lastGrounded = time;
    if (time - jumpRequested <= 0.12 && time - lastGrounded <= 0.08) {
        vy = JUMP_SPEED;
        grounded = false;
        jumpRequested = lastGrounded = -Infinity;
    }

    // Fall, landing on the ground or on a platform from above
    const wasGrounded = grounded;
    const support = supportBelow(position.x, position.y);
    vy -= GRAVITY * dt;
    position.y += vy * dt;
    grounded = vy <= 0 && position.y <= support;
    if (grounded) {
        position.y = support;
        vy = 0;
        if (!wasGrounded) landTimer = 2 / 12;
    }
    landTimer = Math.max(0, landTimer - dt);
    slime.setPosition(position);

    // The clip for what the slime is doing
    let clip = direction !== 0 ? 'hop' : 'idle';
    if (!grounded) clip = vy > 0 ? 'jump' : 'fall';
    else if (landTimer > 0) clip = 'land';
    if (slime.sprite.currentClip.name !== clip) slime.sprite.play(clip);

    // The shadow stays on the surface below, shrinking and fading with height
    const ground = supportBelow(position.x, position.y);
    const lift = Math.min(1, (position.y - ground) / 4);
    shadow.setPosition(position.x, ground, 0.9);
    shadow.setLocalScale(1 - 0.5 * lift, 1 - 0.5 * lift, 1);
    shadow.sprite.opacity = 0.35 * (1 - 0.7 * lift);

    // Coins, all back a moment after the last is collected
    for (const coin of coins) {
        if (!coin.collected && Math.abs(coin.x - position.x) < 0.65 && Math.abs(coin.y - position.y - 0.5) < 0.8) {
            coin.collected = true;
            coin.entity.sprite.play('collect');
            icons[collected].sprite.opacity = 1;
            if (++collected === coins.length) respawnAt = time + 1.5;
        }
    }
    if (time >= respawnAt) {
        for (const coin of coins) {
            coin.collected = false;
            coin.entity.enabled = true;
        }
        for (const icon of icons) {
            icon.sprite.opacity = 0.3;
        }
        collected = 0;
        respawnAt = Infinity;
    }

    // The camera follows along the world, never past its ends, with the ground a quarter of the
    // way up the view
    const { orthoHeight } = camera.camera;
    const reach = Math.max(0, WORLD_EDGE + 1 - (orthoHeight * viewWidth) / viewHeight);
    cameraX += (position.x - cameraX) * (1 - Math.exp(-6 * dt));
    cameraX = Math.max(-reach, Math.min(reach, cameraX));
    camera.setPosition(cameraX, orthoHeight * 0.5, 10);

    for (const layer of layers) {
        const [x, y, z] = layer.at;
        const drifted = layer.drift ? ((((x + layer.drift * time + 30) % 60) + 60) % 60) - 30 : x;
        layer.entity.setPosition(drifted + cameraX * layer.parallax, y, z);
    }
});

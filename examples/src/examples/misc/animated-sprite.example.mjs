// @config DESCRIPTION Animated 2D sprite using SpriteComponent. Arrow keys walk, Space jumps, Z rolls, X attacks.
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    caveman: new pc.Asset('caveman', 'texture', {
        url: `${rootPath}/static/assets/sprites/caveman.png`
    }, { srgb: true }),
    tileset: new pc.Asset('tileset', 'texture', {
        url: `${rootPath}/static/assets/sprites/prehistoric-tileset.png`
    }, { srgb: true })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.keyboard = new pc.Keyboard(window);

createOptions.componentSystems = [
    pc.CameraComponentSystem,
    pc.SpriteComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // create an orthographic camera centered on the origin
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.4, 0.55, 0.7),
        projection: pc.PROJECTION_ORTHOGRAPHIC,
        orthoHeight: 1.5
    });
    camera.setPosition(0, 0.5, 5);
    app.root.addChild(camera);

    // world units per source pixel; controls the on-screen size of every sprite
    const PIXELS_PER_UNIT = 100;

    /**
     * Configure a texture for crisp pixel-art rendering.
     *
     * @param {pc.Texture} t - The texture to configure.
     */
    const configurePixelArt = (t) => {
        t.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        t.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
        t.minFilter = pc.FILTER_NEAREST;
        t.magFilter = pc.FILTER_NEAREST;
    };

    /**
     * Build a sprite asset that references one or more frames from an atlas.
     *
     * @param {string} name - Name of the sprite asset.
     * @param {pc.TextureAtlas} spriteAtlas - The atlas containing the frames.
     * @param {string[]} frameKeys - Frame keys to include, in playback order.
     * @returns {pc.Asset} The created sprite asset, already added to `app.assets`.
     */
    const createSpriteAsset = (name, spriteAtlas, frameKeys) => {
        const sprite = new pc.Sprite(app.graphicsDevice, {
            atlas: spriteAtlas,
            frameKeys: frameKeys,
            pixelsPerUnit: PIXELS_PER_UNIT,
            renderMode: pc.SPRITE_RENDERMODE_SIMPLE
        });

        const spriteAsset = new pc.Asset(name, 'sprite', { url: '' });
        spriteAsset.resource = sprite;
        spriteAsset.loaded = true;
        app.assets.add(spriteAsset);
        return spriteAsset;
    };

    // build the caveman atlas: a regular 6x7 grid covering the whole spritesheet,
    // with frame rects computed at runtime from the texture dimensions
    const cavemanTexture = /** @type {pc.Texture} */ (assets.caveman.resource);
    configurePixelArt(cavemanTexture);

    const COLS = 6;
    const ROWS = 7;
    const cellW = cavemanTexture.width / COLS;
    const cellH = cavemanTexture.height / ROWS;

    // each cell has a few pixels of empty space below the character's feet;
    // shift the pivot up by that amount so y = 0 places the feet exactly on
    // the ground line
    const FEET_OFFSET_PX = 6;
    const feetPivotY = FEET_OFFSET_PX / cellH;

    const cavemanAtlas = new pc.TextureAtlas();
    cavemanAtlas.texture = cavemanTexture;
    cavemanAtlas.frames = {};
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            // TextureAtlas rects use a bottom-left origin, so flip the row
            const x = c * cellW;
            const y = (ROWS - 1 - r) * cellH;
            const index = r * COLS + c;
            cavemanAtlas.frames[String(index)] = {
                rect: new pc.Vec4(x, y, cellW, cellH),
                pivot: new pc.Vec2(0.5, feetPivotY),
                border: new pc.Vec4(0, 0, 0, 0)
            };
        }
    }

    // create the caveman entity and add animation clips from contiguous frame
    // ranges in the spritesheet; walk faces right and is flipped via entity scale for left
    const caveman = new pc.Entity('caveman');
    caveman.addComponent('sprite', {
        type: pc.SPRITETYPE_ANIMATED
    });
    const clipDefs = [
        { name: 'idle', start: 0, count: 6, fps: 6, loop: true },
        { name: 'walk', start: 6, count: 8, fps: 10, loop: true },
        { name: 'jump', start: 14, count: 6, fps: 10, loop: false },
        { name: 'roll', start: 20, count: 5, fps: 14, loop: false },
        { name: 'attack', start: 25, count: 4, fps: 12, loop: false }
    ];
    for (const def of clipDefs) {
        const frameKeys = Array.from({ length: def.count }, (_, i) => String(def.start + i));
        const spriteAsset = createSpriteAsset(`caveman-${def.name}`, cavemanAtlas, frameKeys);
        caveman.sprite.addClip({
            name: def.name,
            fps: def.fps,
            loop: def.loop,
            spriteAsset: spriteAsset.id
        });
    }
    caveman.sprite.autoPlayClip = 'idle';
    app.root.addChild(caveman);

    // build a sprite for a single 48x48 grass-topped ground tile from the
    // tileset, and spawn a row of them under the caveman's feet
    const tilesetTexture = /** @type {pc.Texture} */ (assets.tileset.resource);
    configurePixelArt(tilesetTexture);

    const TILE_PX = 48;
    const tilesetAtlas = new pc.TextureAtlas();
    tilesetAtlas.texture = tilesetTexture;
    tilesetAtlas.frames = {
        ground: {
            // rect uses the atlas's bottom-left origin (same convention as
            // the caveman atlas above)
            rect: new pc.Vec4(704, 256, TILE_PX, TILE_PX),
            // origin at top-center so y = 0 places the tile's surface on the ground line
            pivot: new pc.Vec2(0.5, 1),
            border: new pc.Vec4(0, 0, 0, 0)
        }
    };
    const groundSpriteAsset = createSpriteAsset('ground', tilesetAtlas, ['ground']);

    const tileWorld = TILE_PX / PIXELS_PER_UNIT;
    const tileSpan = 10;
    for (let i = -tileSpan; i <= tileSpan; i++) {
        const tile = new pc.Entity(`ground-${i}`);
        tile.addComponent('sprite', {
            type: pc.SPRITETYPE_SIMPLE,
            spriteAsset: groundSpriteAsset.id
        });
        tile.setPosition(i * tileWorld, 0, 0);
        app.root.addChild(tile);
    }

    // simple platformer-style state, integrated each frame
    const groundY = 0;
    const moveSpeed = 1.5;
    const rollSpeed = 3.5;
    const jumpSpeed = 3.5;
    const gravity = -9.0;

    let velocityY = 0;
    let grounded = true;
    let facing = 1;
    let attacking = false;
    let rolling = false;
    let currentClip = 'idle';

    // roll and attack are one-shot, non-looping clips; clear the flag when
    // they end so the state machine can return to idle/walk
    caveman.sprite.on('end', (clip) => {
        if (clip.name === 'attack') {
            attacking = false;
        } else if (clip.name === 'roll') {
            rolling = false;
        }
    });

    const keyboard = /** @type {pc.Keyboard} */ (app.keyboard);

    app.on('update', (/** @type {number} */ dt) => {
        // horizontal input
        const left = keyboard.isPressed(pc.KEY_LEFT);
        const right = keyboard.isPressed(pc.KEY_RIGHT);
        const dir = (right ? 1 : 0) - (left ? 1 : 0);

        // input handling: locked out while attacking, and partially while rolling
        if (rolling) {
            // keep moving forward in the facing direction during the roll
            caveman.translateLocal(facing * rollSpeed * dt, 0, 0);
        } else if (!attacking) {
            if (dir !== 0) {
                facing = dir;
                caveman.translateLocal(dir * moveSpeed * dt, 0, 0);
            }

            // jump input (only when grounded)
            if (grounded && keyboard.isPressed(pc.KEY_SPACE)) {
                velocityY = jumpSpeed;
                grounded = false;
            }

            // roll input (only when grounded, single-shot per key press)
            if (grounded && keyboard.wasPressed(pc.KEY_Z)) {
                rolling = true;
                caveman.sprite.play('roll');
                currentClip = 'roll';
            }

            // attack input (only when grounded, single-shot per key press)
            if (grounded && keyboard.wasPressed(pc.KEY_X)) {
                attacking = true;
                caveman.sprite.play('attack');
                currentClip = 'attack';
            }
        }

        // flip horizontally to face the movement direction
        caveman.setLocalScale(facing, 1, 1);

        // integrate vertical motion and clamp to ground
        if (!grounded) {
            velocityY += gravity * dt;
            const pos = caveman.getLocalPosition();
            let newY = pos.y + velocityY * dt;
            if (newY <= groundY) {
                newY = groundY;
                velocityY = 0;
                grounded = true;
            }
            caveman.setLocalPosition(pos.x, newY, pos.z);
        }

        // pick the appropriate clip based on the current state; attack and
        // roll take priority and lock the clip until their 'end' event fires
        if (!attacking && !rolling) {
            let nextClip;
            if (!grounded) {
                nextClip = 'jump';
            } else if (dir !== 0) {
                nextClip = 'walk';
            } else {
                nextClip = 'idle';
            }

            if (nextClip !== currentClip) {
                caveman.sprite.play(nextClip);
                currentClip = nextClip;
            }
        }
    });
});

export { app };

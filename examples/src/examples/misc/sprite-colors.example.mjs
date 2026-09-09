// @config
//
// A living sea of 100 sprites. Each jellyfish changes color, opacity, transform and animation frame independently.

import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    Asset,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    PIXELFORMAT_SRGBA8,
    PROJECTION_ORTHOGRAPHIC,
    RESOLUTION_AUTO,
    SPRITETYPE_ANIMATED,
    SPRITETYPE_SIMPLE,
    SPRITE_RENDERMODE_SIMPLE,
    Sprite,
    SpriteComponentSystem,
    Texture,
    TextureAtlas,
    Vec2,
    Vec4,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
const device = await createGraphicsDevice(canvas, { deviceTypes: [deviceType] });
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const options = new AppOptions();
options.graphicsDevice = device;
options.componentSystems = [CameraComponentSystem, SpriteComponentSystem];

const app = new AppBase(canvas);
app.init(options);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const camera = new Entity('camera');
camera.addComponent('camera', {
    projection: PROJECTION_ORTHOGRAPHIC,
    orthoHeight: 6,
    clearColor: new Color(0.015, 0.025, 0.06)
});
camera.setPosition(0, 0, 10);
app.root.addChild(camera);

// Author the white animation once: every swimmer shares these meshes and this atlas.
// Color belongs to the SpriteComponent, so changing it never modifies shared artwork.
const frameWidth = 128;
const frameHeight = 192;
const frameCount = 12;
const columns = 6;
const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = columns * frameWidth;
atlasCanvas.height = frameHeight * 2 + 256;
const ctx = atlasCanvas.getContext('2d');

for (let frame = 0; frame < frameCount; frame++) {
    ctx.save();
    ctx.translate((frame % columns) * frameWidth, Math.floor(frame / columns) * frameHeight);
    const phase = (frame / frameCount) * Math.PI * 2;
    const pulse = Math.sin(phase);
    const radius = 40 + pulse * 4;
    const rimY = 66 + pulse * 3;

    // Soft light surrounds the bell, while the thin rim keeps its silhouette readable.
    const halo = ctx.createRadialGradient(64, 51, 4, 64, 57, 61);
    halo.addColorStop(0, 'rgba(255,255,255,0.18)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(2, 0, 124, 125);

    // Long tentacles undulate with different phases, anchored beneath the bell.
    for (let strand = 0; strand < 9; strand++) {
        const startX = 64 + (strand - 4) * 7;
        const length = 55 + 42 * (0.5 + 0.5 * Math.sin(strand * 2.4));
        const tail = ctx.createLinearGradient(0, rimY, 0, rimY + length);
        tail.addColorStop(0, 'rgba(255,255,255,0.8)');
        tail.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = tail;
        ctx.lineWidth = strand % 2 ? 1.3 : 2.8;
        ctx.beginPath();
        ctx.moveTo(startX, rimY);
        for (let step = 1; step <= 24; step++) {
            const t = step / 24;
            const x = startX + Math.sin(t * 8 - phase + strand * 0.7) * t * 11;
            ctx.lineTo(x, rimY + t * length);
        }
        ctx.stroke();
    }

    const bell = ctx.createLinearGradient(0, 22, 0, rimY + 9);
    bell.addColorStop(0, 'rgba(255,255,255,0.85)');
    bell.addColorStop(0.45, 'rgba(255,255,255,0.3)');
    bell.addColorStop(1, 'rgba(255,255,255,0.65)');
    ctx.fillStyle = bell;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(64 - radius, rimY);
    ctx.bezierCurveTo(64 - radius, 12 - pulse * 3, 64 + radius, 12 - pulse * 3, 64 + radius, rimY);
    ctx.bezierCurveTo(88, rimY + 10, 40, rimY + 10, 64 - radius, rimY);
    ctx.fill();
    ctx.stroke();

    // Radial ribs and four luminous organs add structure inside the translucent bell.
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    for (let rib = -2; rib <= 2; rib++) {
        ctx.beginPath();
        ctx.moveTo(64, 25);
        ctx.quadraticCurveTo(64 + rib * 9, 37, 64 + rib * 15, rimY);
        ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let organ = 0; organ < 4; organ++) {
        const angle = organ * Math.PI * 0.5 + phase * 0.08;
        ctx.beginPath();
        ctx.ellipse(64 + Math.cos(angle) * 9, 51 + Math.sin(angle) * 5, 4, 2.5, angle, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// The backdrop occupies its own frame in the same atlas, keeping the example self-contained.
const backdropY = frameHeight * 2;
ctx.save();
ctx.translate(0, backdropY);
ctx.fillStyle = '#030916';
ctx.fillRect(0, 0, atlasCanvas.width, 256);
const water = ctx.createRadialGradient(420, 0, 10, 380, 20, 470);
water.addColorStop(0, '#15344c');
water.addColorStop(0.45, '#0a2036');
water.addColorStop(1, '#030916');
ctx.fillStyle = water;
ctx.fillRect(0, 0, atlasCanvas.width, 256);
for (let i = 0; i < 220; i++) {
    ctx.fillStyle = `rgba(160,215,255,${0.06 + (i % 5) * 0.025})`;
    ctx.beginPath();
    ctx.arc((i * 137.51) % atlasCanvas.width, (i * 71.37) % 256, i % 7 === 0 ? 0.7 : 0.3, 0, Math.PI * 2);
    ctx.fill();
}
ctx.restore();

const texture = new Texture(device, {
    name: 'jellyfish-atlas',
    width: atlasCanvas.width,
    height: atlasCanvas.height,
    format: PIXELFORMAT_SRGBA8,
    mipmaps: false,
    minFilter: FILTER_LINEAR,
    magFilter: FILTER_LINEAR,
    addressU: ADDRESS_CLAMP_TO_EDGE,
    addressV: ADDRESS_CLAMP_TO_EDGE
});
texture.setSource(atlasCanvas);
const atlas = new TextureAtlas();
atlas.texture = texture;
atlas.frames = {};
for (let frame = 0; frame < frameCount; frame++) {
    atlas.frames[String(frame)] = {
        rect: new Vec4(
            (frame % columns) * frameWidth,
            atlasCanvas.height - (Math.floor(frame / columns) + 1) * frameHeight,
            frameWidth,
            frameHeight
        ),
        pivot: new Vec2(0.5, 0.5),
        border: new Vec4()
    };
}
atlas.frames.backdrop = {
    rect: new Vec4(1, 1, atlasCanvas.width - 2, 254),
    pivot: new Vec2(0.5, 0.5),
    border: new Vec4()
};

const sprite = new Sprite(device, {
    atlas,
    frameKeys: Array.from({ length: frameCount }, (_, i) => String(i)),
    pixelsPerUnit: 128,
    renderMode: SPRITE_RENDERMODE_SIMPLE
});
const spriteAsset = new Asset('jellyfish', 'sprite', { url: '' });
spriteAsset.resource = sprite;
spriteAsset.loaded = true;
app.assets.add(spriteAsset);

const backdropSprite = new Sprite(device, {
    atlas,
    frameKeys: ['backdrop'],
    pixelsPerUnit: 1,
    renderMode: SPRITE_RENDERMODE_SIMPLE
});
const backdrop = new Entity('water');
backdrop.addComponent('sprite', { type: SPRITETYPE_SIMPLE, drawOrder: -1 });
backdrop.sprite.sprite = backdropSprite;
backdrop.setPosition(0, 0, -1);
app.root.addChild(backdrop);

let halfWidth = 10;
let refresh = true;
const resize = () => {
    app.resizeCanvas();
    halfWidth = (camera.camera.orthoHeight * canvas.clientWidth) / canvas.clientHeight;
    backdrop.setLocalScale((halfWidth * 2) / (atlasCanvas.width - 2), 12 / 254, 1);
    refresh = true;
};
window.addEventListener('resize', resize);
resize();

const settings = { count: 100, motion: true, colors: true, opacity: true, animation: true, speed: 1 };
data.set('settings', settings);

const swimmers = [];
let seed = 12345;
const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
};
const color = new Color();
const palette = [
    new Color(0.18, 0.85, 0.95),
    new Color(0.35, 0.5, 1),
    new Color(0.78, 0.3, 0.9),
    new Color(1, 0.4, 0.62),
    new Color(0.3, 0.95, 0.78)
];

/**
 * Sample a smoothly looping palette without allocating colors in the update loop.
 *
 * @param {number} phase - Position in the palette.
 * @returns {Color} The shared temporary color.
 */
const sampleColor = (phase) => {
    const index = Math.floor(phase) % palette.length;
    return color.lerp(palette[index], palette[(index + 1) % palette.length], phase % 1);
};

// A deterministic layout makes backend comparisons repeatable. Depth order stays fixed.
for (let i = 0; i < 250; i++) {
    const scale = 0.42 + random() * 0.75;
    const entity = new Entity(`jellyfish-${i}`);
    entity.addComponent('sprite', {
        type: SPRITETYPE_ANIMATED,
        color: sampleColor(i * 0.618),
        drawOrder: Math.floor(scale * 1000),
        clips: {
            swim: { name: 'swim', fps: 7 + (i % 5), loop: true, spriteAsset: spriteAsset.id }
        },
        autoPlayClip: 'swim'
    });
    entity.enabled = i < settings.count;
    app.root.addChild(entity);
    entity.sprite.currentClip.frame = i % frameCount;
    swimmers.push({
        entity,
        x: random(),
        y: random(),
        phase: random() * Math.PI * 2,
        scale
    });
}

let motionTime = 0;
let colorTime = 0;
let opacityTime = 0;

const settingsEvent = data.on('*:set', (/** @type {string} */ path) => {
    if (path.startsWith('settings.')) {
        Object.assign(settings, data.get('settings'));
        refresh = true;
        for (let i = 0; i < swimmers.length; i++) {
            swimmers[i].entity.enabled = i < settings.count;
            swimmers[i].entity.sprite.speed = settings.animation ? settings.speed : 0;
        }
    }
});

app.on('update', (/** @type {number} */ dt) => {
    const step = Math.min(dt, 0.05) * settings.speed;
    if (settings.motion) motionTime += step;
    if (settings.colors) colorTime += step;
    if (settings.opacity) opacityTime += step;

    for (let i = 0; i < settings.count; i++) {
        const swimmer = swimmers[i];
        const entity = swimmer.entity;
        const phase = swimmer.phase;
        if ((settings.motion && step > 0) || refresh) {
            const progress = (swimmer.y + motionTime * (0.014 + swimmer.scale * 0.008)) % 1;
            const x = (swimmer.x * 2 - 1) * Math.max(0.5, halfWidth - 0.7) + Math.sin(motionTime * 0.3 + phase) * 0.3;
            const y = progress * 14 - 7;
            const tilt = Math.sin(motionTime * 0.45 + phase) * 12;
            const scale = swimmer.scale * (1 + Math.sin(motionTime * 1.5 + phase) * 0.045);
            entity.setLocalPosition(x, y, 0);
            entity.setLocalEulerAngles(0, 0, tilt);
            entity.setLocalScale(scale, scale, 1);
        }
        if ((settings.colors && step > 0) || refresh) {
            entity.sprite.color = sampleColor(i * 0.618 + colorTime * 0.18);
        }
        if ((settings.opacity && step > 0) || refresh) {
            entity.sprite.opacity = 0.48 + 0.52 * (0.5 + 0.5 * Math.sin(opacityTime * 0.75 + phase));
        }
    }
    refresh = false;
});

app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    settingsEvent.unbind();
    sprite.destroy();
    backdropSprite.destroy();
    atlas.destroy();
});

app.start();

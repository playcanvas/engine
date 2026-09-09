// @config
//
// Independent image and text colors across shared materials. Pause to compare image modes,
// markup, bitmap fonts, masks and custom materials, in screen space or world space.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_PREMULTIPLIED,
    CameraComponentSystem,
    CanvasFont,
    Color,
    ELEMENTTYPE_IMAGE,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    FontHandler,
    PIXELFORMAT_SRGBA8,
    PROJECTION_ORTHOGRAPHIC,
    RESOLUTION_AUTO,
    SCALEMODE_BLEND,
    ScreenComponentSystem,
    Sprite,
    SPRITE_RENDERMODE_SIMPLE,
    SPRITE_RENDERMODE_SLICED,
    SPRITE_RENDERMODE_TILED,
    StandardMaterial,
    Texture,
    TextureAtlas,
    TextureHandler,
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
options.componentSystems = [CameraComponentSystem, ScreenComponentSystem, ElementComponentSystem];
options.resourceHandlers = [TextureHandler, FontHandler];
const app = new AppBase(canvas);
app.init(options);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const fontAsset = new Asset('courier', 'font', { url: './assets/fonts/courier.json' });
await new Promise((resolve) => {
    new AssetListLoader([fontAsset], app.assets).load(resolve);
});

const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0.025, 0.035, 0.065),
    projection: PROJECTION_ORTHOGRAPHIC,
    orthoHeight: 4.4
});
camera.setPosition(0, 0, 10);
app.root.addChild(camera);

const screen = new Entity('Color laboratory');
screen.addComponent('screen', {
    referenceResolution: new Vec2(1280, 900),
    scaleMode: SCALEMODE_BLEND,
    screenSpace: true
});
app.root.addChild(screen);

// One white atlas supplies all three image modes and an opaque alpha-shaped mask.
const artwork = document.createElement('canvas');
artwork.width = 128;
artwork.height = 64;
const ctx = artwork.getContext('2d');
ctx.fillStyle = '#fff';
ctx.beginPath();
ctx.roundRect(1, 1, 62, 62, 12);
ctx.fill();
ctx.fillStyle = '#c0c0c0';
for (let y = 16; y < 48; y += 8) {
    for (let x = 16; x < 48; x += 8) {
        if ((x + y) % 16 === 0) ctx.fillRect(x, y, 8, 8);
    }
}
ctx.fillStyle = '#fff';
ctx.beginPath();
ctx.arc(96, 32, 30, 0, Math.PI * 2);
ctx.fill();
const texture = new Texture(device, {
    name: 'element-colors-atlas',
    width: 128,
    height: 64,
    format: PIXELFORMAT_SRGBA8,
    mipmaps: false,
    minFilter: FILTER_LINEAR,
    magFilter: FILTER_LINEAR
});
texture.setSource(artwork);
const atlas = new TextureAtlas();
atlas.texture = texture;
atlas.frames = {
    tile: { rect: new Vec4(0, 0, 64, 64), pivot: new Vec2(0.5, 0.5), border: new Vec4(16, 16, 16, 16) },
    circle: { rect: new Vec4(64, 0, 64, 64), pivot: new Vec2(0.5, 0.5), border: new Vec4() }
};
const sprites = [SPRITE_RENDERMODE_SIMPLE, SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED].map(
    (renderMode) =>
        new Sprite(device, {
            atlas,
            frameKeys: ['tile'],
            pixelsPerUnit: 1,
            renderMode
        })
);
const circleSprite = new Sprite(device, { atlas, frameKeys: ['circle'], pixelsPerUnit: 1 });

// A small atlas deliberately exercises text spanning several bitmap font textures.
const bitmapFont = new CanvasFont(app, {
    color: new Color(1, 1, 1),
    fontName: 'monospace',
    fontSize: 40,
    width: 128,
    height: 128
});
bitmapFont.createTextures('BITMAP COLOR FLOW 0123456789 /');

const pale = new Color(0.86, 0.91, 1);
const muted = new Color(0.42, 0.52, 0.68);
const panelColor = new Color(0.065, 0.085, 0.135);
const palette = [
    new Color(0.22, 0.88, 0.87),
    new Color(0.4, 0.55, 1),
    new Color(0.85, 0.4, 0.94),
    new Color(1, 0.52, 0.36)
];
const tint = new Color();
const animated = [];

/**
 * Create an element centered on its parent.
 * @param {Entity} parent - Parent entity.
 * @param {string} name - Entity name.
 * @param {number} x - Horizontal position.
 * @param {number} y - Vertical position.
 * @param {object} properties - Element properties.
 * @returns {Entity} The element entity.
 */
const element = (parent, name, x, y, properties) => {
    const entity = new Entity(name);
    entity.addComponent('element', {
        type: ELEMENTTYPE_IMAGE,
        anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
        pivot: new Vec2(0.5, 0.5),
        ...properties
    });
    parent.addChild(entity);
    entity.setLocalPosition(x, y, 0);
    return entity;
};

/**
 * Create a label using the shared MSDF font.
 * @param {Entity} parent - Parent entity.
 * @param {string} text - Label text.
 * @param {number} x - Horizontal position.
 * @param {number} y - Vertical position.
 * @param {number} size - Font size.
 * @param {object} [properties] - Additional element properties.
 * @returns {Entity} The text entity.
 */
const label = (parent, text, x, y, size, properties = {}) =>
    element(parent, text, x, y, {
        type: ELEMENTTYPE_TEXT,
        fontAsset: fontAsset.id,
        fontSize: size,
        text,
        color: pale,
        ...properties
    });

/**
 * Track independently animated element properties without allocating in the update loop.
 * @param {Entity} entity - Element entity.
 * @param {number} phase - Palette and animation offset.
 * @returns {Entity} The element entity.
 */
const animate = (entity, phase) => {
    animated.push({ entity, phase });
    return entity;
};

/**
 * Create a section card.
 * @param {string} title - Card title.
 * @param {string} subtitle - Card caption.
 * @param {number} x - Horizontal position.
 * @param {number} y - Vertical position.
 * @returns {Entity} The card entity.
 */
const card = (title, subtitle, x, y) => {
    const panel = element(screen, title, x, y, { width: 340, height: 248, color: panelColor });
    label(panel, title, 0, 96, 19);
    label(panel, subtitle, 0, -101, 12, { color: muted });
    return panel;
};

const title = label(screen, 'CHROMATIC / UI', -285, 312, 42);
const subtitle = label(screen, 'One palette. Independent elements.', -308, 274, 17, { color: muted });
const footer = label(screen, 'IMAGES  /  TYPE  /  TRANSPARENCY', 0, -337, 14, { color: muted });

const images = card('01 / IMAGE MODES', 'Same atlas, different geometry', -360, 111);
['SIMPLE', 'SLICED', 'TILED'].forEach((name, i) => {
    label(images, name, -109, 47 - i * 53, 13, { color: muted });
    animate(
        element(images, name, 37, 47 - i * 53, {
            width: 178,
            height: 39,
            sprite: sprites[i]
        }),
        i * 0.65
    );
});

const msdf = card('02 / MSDF + MARKUP', 'Matching rows share the same tint', 0, 111);
animate(label(msdf, 'COLOR FLOW', 0, 43, 34), 0.5);
animate(label(msdf, 'COLOR FLOW', 0, 5, 34, { enableMarkup: true }), 0.5);
animate(
    label(msdf, '[color="#ffc078"]TAG[/color] + BASE', 0, -38, 25, {
        enableMarkup: true,
        outlineColor: new Color(0.15, 0.22, 0.35),
        outlineThickness: 0.3,
        shadowColor: new Color(0.02, 0.025, 0.06, 0.8),
        shadowOffset: new Vec2(0.15, -0.15)
    }),
    1.5
);

const bitmap = card('03 / BITMAP FONT', `CanvasFont / ${bitmapFont.textures.length} atlas pages`, 360, 111);
['BITMAP / 0123', 'COLOR / 4567', 'FLOW / 8989'].forEach((text, i) => {
    animate(
        element(bitmap, text, 0, 42 - i * 45, {
            type: ELEMENTTYPE_TEXT,
            font: bitmapFont,
            fontSize: 28,
            text
        }),
        0.7 + i * 0.55
    );
});

const masks = card('04 / MASKED SPECTRUM', 'Rectangle mask + nested alpha mask', -360, -158);
const rectMask = element(masks, 'Rectangle mask', 0, -2, { width: 288, height: 145, mask: true });
const roundMask = element(rectMask, 'Circle mask', -73, 0, {
    width: 134,
    height: 134,
    sprite: circleSprite,
    mask: true
});
const maskedGroups = [roundMask, rectMask];
for (let group = 0; group < 2; group++) {
    const parent = maskedGroups[group];
    for (let i = 0; i < 18; i++) {
        animate(
            element(
                parent,
                `Band ${group}-${i}`,
                (group ? 72 : 0) + ((i % 6) - 2.5) * 23,
                (Math.floor(i / 6) - 1) * 53,
                {
                    width: 20,
                    height: 49
                }
            ),
            i * 0.14 + group
        );
    }
}
// A sibling after the nested mask makes an incorrect unmask immediately visible.
label(masks, 'CLIPPED', 74, -3, 18, { color: Color.WHITE });

const materials = card('05 / MATERIAL SWITCH', 'Left: material color. Right: element color.', 0, -158);
const customMaterial = new StandardMaterial();
customMaterial.diffuse.set(0, 0, 0);
customMaterial.emissive.set(1, 0.62, 0.3);
customMaterial.opacity = 0.7;
customMaterial.useLighting = false;
customMaterial.useTonemap = false;
customMaterial.useFog = false;
customMaterial.useSkybox = false;
customMaterial.blendType = BLEND_PREMULTIPLIED;
customMaterial.depthWrite = false;
customMaterial.depthTest = false;
customMaterial.update();
const reference = element(materials, 'Material reference', -75, 10, {
    width: 108,
    height: 92,
    material: customMaterial
});
const candidate = animate(
    element(materials, 'Element tint', 75, 10, { width: 108, height: 92, material: customMaterial }),
    1.2
);
label(materials, 'REFERENCE', -75, -57, 12, { color: muted });
label(materials, 'ANIMATED', 75, -57, 12, { color: muted });

const grid = card('06 / SHARED MATERIALS', 'Each tile and label changes independently', 360, -158);
for (let i = 0; i < 15; i++) {
    const x = ((i % 5) - 2) * 56;
    const y = 43 - Math.floor(i / 5) * 51;
    const tile = animate(element(grid, `Tile ${i}`, x, y, { width: 47, height: 42, sprite: sprites[1] }), i * 0.27);
    animate(label(tile, String(i + 1).padStart(2, '0'), 0, 0, 18), i * 0.27 + 1.8);
}

const settings = {
    animate: true,
    colors: true,
    opacity: true,
    hue: 0,
    alpha: 1,
    world: false,
    masks: true,
    custom: true
};
data.set('settings', settings);
let time = 0;
let refresh = true;

const resize = () => {
    app.resizeCanvas();
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const narrow = aspect < 1.1;
    const width = narrow ? 800 : 1280;
    const height = narrow ? 1160 : 900;
    screen.screen.referenceResolution = new Vec2(width, height);
    screen.screen.scaleBlend = aspect < width / height ? 0 : 1;
    if (settings.world) screen.screen.resolution = new Vec2(width, height);
    const columns = narrow ? 2 : 3;
    [images, msdf, bitmap, masks, materials, grid].forEach((panel, i) => {
        panel.setLocalPosition(
            ((i % columns) - (columns - 1) / 2) * 360,
            (narrow ? 220 : 111) - Math.floor(i / columns) * 269,
            0
        );
    });
    title.setLocalPosition(narrow ? -135 : -285, narrow ? 425 : 312, 0);
    title.element.fontSize = narrow ? 30 : 42;
    subtitle.setLocalPosition(narrow ? -135 : -308, narrow ? 393 : 274, 0);
    subtitle.element.fontSize = narrow ? 12 : 17;
    footer.setLocalPosition(0, narrow ? -490 : -337, 0);
    camera.camera.orthoHeight = Math.max(height * 0.005, (width * 0.005) / aspect);
};
window.addEventListener('resize', resize);
resize();

const settingsEvent = data.on('*:set', (/** @type {string} */ path) => {
    if (!path.startsWith('settings.')) return;
    Object.assign(settings, data.get('settings'));
    refresh = true;
    if (path === 'settings.world') {
        screen.screen.screenSpace = !settings.world;
        screen.setLocalScale(settings.world ? 0.01 : 1, settings.world ? 0.01 : 1, settings.world ? 0.01 : 1);
        screen.setLocalEulerAngles(settings.world ? -8 : 0, settings.world ? 12 : 0, 0);
        customMaterial.depthTest = settings.world;
        resize();
    }
    if (path === 'settings.masks') {
        rectMask.element.mask = settings.masks;
        roundMask.element.mask = settings.masks;
        rectMask.element.opacity = settings.masks ? 1 : 0;
        roundMask.element.opacity = settings.masks ? 1 : 0;
    }
    if (path === 'settings.custom') {
        reference.element.material = settings.custom ? customMaterial : null;
        candidate.element.material = settings.custom ? customMaterial : null;
        // Force the public setters to reapply tint after the material switch, even when paused.
        candidate.element.color = Color.BLACK;
        candidate.element.opacity = candidate.element.opacity === 0 ? 1 : 0;
    }
});

app.on('update', (/** @type {number} */ dt) => {
    if (settings.animate) time += Math.min(dt, 0.05);
    if (!settings.animate && !refresh) return;
    for (let i = 0; i < animated.length; i++) {
        const { entity, phase } = animated[i];
        const p = (phase + settings.hue * palette.length + (settings.colors ? time * 0.24 : 0)) % palette.length;
        const index = Math.floor(p);
        tint.lerp(palette[index], palette[(index + 1) % palette.length], p - index);
        entity.element.color = tint;
        entity.element.opacity =
            settings.alpha * (settings.opacity ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 1.2 + phase)) : 1);
    }
    refresh = false;
});

app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    settingsEvent.unbind();
    bitmapFont.destroy();
    sprites.forEach((sprite) => sprite.destroy());
    circleSprite.destroy();
    atlas.destroy();
    customMaterial.destroy();
});
app.start();

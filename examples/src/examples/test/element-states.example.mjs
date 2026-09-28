// @config
//
// Hidden test for element states the user interface examples don't exercise. Switch the states in
// the controls, and pause to drag the scroll view.
//
// @flag HIDDEN

import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    CanvasFont,
    Color,
    ELEMENTTYPE_GROUP,
    ELEMENTTYPE_IMAGE,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    FILTER_NEAREST,
    FITTING_BOTH,
    FITTING_NONE,
    FITTING_SHRINK,
    FITTING_STRETCH,
    FontHandler,
    LayoutChildComponentSystem,
    LayoutGroupComponentSystem,
    Mouse,
    ORIENTATION_HORIZONTAL,
    ORIENTATION_VERTICAL,
    PIXELFORMAT_RGBA8,
    PIXELFORMAT_SRGBA8,
    RESOLUTION_AUTO,
    SCALEMODE_BLEND,
    SCROLLBAR_VISIBILITY_SHOW_ALWAYS,
    SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED,
    SCROLL_MODE_BOUNCE,
    SCROLL_MODE_CLAMP,
    SCROLL_MODE_INFINITE,
    ScreenComponentSystem,
    ScrollViewComponentSystem,
    ScrollbarComponentSystem,
    Sprite,
    SPRITE_RENDERMODE_SIMPLE,
    SPRITE_RENDERMODE_SLICED,
    SPRITE_RENDERMODE_TILED,
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

// Dragging the scroll view and its scrollbars with the mouse needs a mouse device, created after
// the element input
const options = new AppOptions();
options.graphicsDevice = device;
options.elementInput = new ElementInput(canvas);
options.mouse = new Mouse(canvas);
options.componentSystems = [
    CameraComponentSystem,
    ScreenComponentSystem,
    ElementComponentSystem,
    LayoutGroupComponentSystem,
    LayoutChildComponentSystem,
    ScrollViewComponentSystem,
    ScrollbarComponentSystem
];
options.resourceHandlers = [TextureHandler, FontHandler];
const app = new AppBase(canvas);
app.init(options);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const fontAsset = new Asset('font', 'font', { url: './assets/fonts/roboto-regular.json' });
await new Promise((resolve) => {
    new AssetListLoader([fontAsset], app.assets).load(resolve);
});

const camera = new Entity('Camera');
camera.addComponent('camera', { clearColor: new Color(0.025, 0.035, 0.065) });
app.root.addChild(camera);

const screen = new Entity('Screen');
screen.addComponent('screen', {
    referenceResolution: new Vec2(1280, 900),
    scaleMode: SCALEMODE_BLEND,
    screenSpace: true
});
app.root.addChild(screen);

const SPRITE_MODES = {
    simple: SPRITE_RENDERMODE_SIMPLE,
    sliced: SPRITE_RENDERMODE_SLICED,
    tiled: SPRITE_RENDERMODE_TILED
};
const SCROLL_MODES = { clamp: SCROLL_MODE_CLAMP, bounce: SCROLL_MODE_BOUNCE, infinite: SCROLL_MODE_INFINITE };
const VISIBILITIES = {
    always: SCROLLBAR_VISIBILITY_SHOW_ALWAYS,
    required: SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED
};
const FITTINGS = { none: FITTING_NONE, stretch: FITTING_STRETCH, shrink: FITTING_SHRINK, both: FITTING_BOTH };

// The columns and rows of scroll view cells for each content size
const CONTENT = { large: [10, 8], narrow: [4, 8], small: [4, 3] };

const settings = {
    animate: true,
    sprite: 'tiled',
    scrollMode: 'bounce',
    scrollbars: 'required',
    content: 'large',
    widthFitting: 'both',
    heightFitting: 'both',
    wrap: true,
    masks: true
};
data.set('settings', settings);

const pale = new Color(0.86, 0.91, 1);
const muted = new Color(0.42, 0.52, 0.68);
const panelColor = new Color(0.065, 0.085, 0.135);
const wellColor = new Color(0.03, 0.04, 0.075);
const palette = [
    new Color(0.22, 0.88, 0.87),
    new Color(0.4, 0.55, 1),
    new Color(0.85, 0.4, 0.94),
    new Color(1, 0.52, 0.36)
];

/**
 * A color from the palette, blending between its entries.
 *
 * @param {number} t - The position in the palette, wrapping around.
 * @returns {Color} The color.
 */
const paletteColor = (t) => {
    const p = ((t % palette.length) + palette.length) % palette.length;
    const index = Math.floor(p);
    return new Color().lerp(palette[index], palette[(index + 1) % palette.length], p - index);
};

/**
 * Create an element, centered on its parent unless the properties say otherwise. Elements with
 * split anchors are placed by their margins, so they are given no position.
 *
 * @param {Entity} parent - Parent entity.
 * @param {string} name - Entity name.
 * @param {object} properties - Element properties.
 * @param {number} [x] - Horizontal position.
 * @param {number} [y] - Vertical position.
 * @returns {Entity} The element entity.
 */
const element = (parent, name, properties, x, y) => {
    const entity = new Entity(name);
    entity.addComponent('element', {
        type: ELEMENTTYPE_IMAGE,
        anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
        pivot: new Vec2(0.5, 0.5),
        ...properties
    });
    parent.addChild(entity);
    if (x !== undefined) {
        entity.setLocalPosition(x, y, 0);
    }
    return entity;
};

/**
 * Create a label using the MSDF font.
 *
 * @param {Entity} parent - Parent entity.
 * @param {string} text - Label text.
 * @param {number} x - Horizontal position.
 * @param {number} y - Vertical position.
 * @param {number} size - Font size.
 * @param {object} [properties] - Additional element properties.
 * @returns {Entity} The text entity.
 */
const label = (parent, text, x, y, size, properties = {}) =>
    element(
        parent,
        text,
        {
            type: ELEMENTTYPE_TEXT,
            fontAsset: fontAsset.id,
            fontSize: size,
            text,
            color: pale,
            ...properties
        },
        x,
        y
    );

/**
 * Create a section card.
 *
 * @param {string} title - Card title.
 * @param {string} subtitle - Card caption.
 * @returns {{ panel: Entity, caption: Entity }} The card and its caption.
 */
const card = (title, subtitle) => {
    const panel = element(screen, title, { width: 340, height: 248, color: panelColor }, 0, 0);
    label(panel, title, 0, 100, 19);
    const caption = label(panel, subtitle, 0, -104, 12, { color: muted });
    return { panel, caption };
};

const title = label(screen, 'ELEMENT STATES', 0, 0, 42, { pivot: new Vec2(0, 0.5) });
const subtitle = label(screen, 'Sprites, scrolling, layout, fitting, masks and emoji.', 0, 0, 17, {
    pivot: new Vec2(0, 0.5),
    color: muted
});

// --- 01 / Sprite modes ---------------------------------------------------------------------------
//
// One sprite shared by two images switches its render mode while the larger image resizes. Simple
// stretches the whole frame, sliced keeps its corners, and tiled repeats its edges and center,
// with partial tiles at the ends.

// A 64 x 64 frame with 16 pixel borders: orange corners, blue edges with a notch in the middle,
// and a checkered center, so that each render mode is easy to tell apart. Nearest filtering keeps
// the tiles crisp at their seams.
const frameArt = document.createElement('canvas');
frameArt.width = 64;
frameArt.height = 64;
const frameCtx = frameArt.getContext('2d');
frameCtx.fillStyle = '#4f7de0';
frameCtx.fillRect(0, 0, 64, 64);
frameCtx.fillStyle = '#1d3170';
frameCtx.fillRect(28, 0, 8, 16);
frameCtx.fillRect(28, 48, 8, 16);
frameCtx.fillRect(0, 28, 16, 8);
frameCtx.fillRect(48, 28, 16, 8);
frameCtx.fillStyle = '#ff9a3c';
[0, 48].forEach((x) => [0, 48].forEach((y) => frameCtx.fillRect(x, y, 16, 16)));
for (let y = 16; y < 48; y += 8) {
    for (let x = 16; x < 48; x += 8) {
        frameCtx.fillStyle = (x + y) % 16 === 0 ? '#e8edf7' : '#6b7896';
        frameCtx.fillRect(x, y, 8, 8);
    }
}
const frameTexture = new Texture(device, {
    name: 'element-states-frame',
    width: 64,
    height: 64,
    format: PIXELFORMAT_SRGBA8,
    mipmaps: false,
    minFilter: FILTER_NEAREST,
    magFilter: FILTER_NEAREST,
    addressU: ADDRESS_CLAMP_TO_EDGE,
    addressV: ADDRESS_CLAMP_TO_EDGE
});
frameTexture.setSource(frameArt);
const atlas = new TextureAtlas();
atlas.texture = frameTexture;
atlas.frames = {
    frame: { rect: new Vec4(0, 0, 64, 64), pivot: new Vec2(0.5, 0.5), border: new Vec4(16, 16, 16, 16) }
};
const sprite = new Sprite(device, {
    atlas,
    frameKeys: ['frame'],
    pixelsPerUnit: 1,
    renderMode: SPRITE_MODES[settings.sprite]
});

const sprites = card('01 / SPRITE MODES', '');
element(sprites.panel, 'Static image', { width: 72, height: 72, sprite }, -112, -4);
const spriteImage = element(sprites.panel, 'Resizing image', { width: 150, height: 95, sprite }, 42, -4);

// --- 02 / Scroll view ----------------------------------------------------------------------------
//
// A scroll view on both axes with both scrollbars, whose content can be larger than the viewport,
// narrower or smaller. The scroll is pushed past an end and let go: clamp stops at the end, bounce
// springs back, and infinite stays where it was left.

const scroll = card('02 / SCROLL VIEW', 'Both axes, both scrollbars');
const BAR = 12;
const scrollView = element(scroll.panel, 'Scroll view', { type: ELEMENTTYPE_GROUP, width: 300, height: 160 }, 0, -4);
element(scrollView, 'Viewport background', {
    anchor: new Vec4(0, 0, 1, 1),
    margin: new Vec4(0, BAR, BAR, 0),
    color: wellColor
});

// A mask is only drawn into the stencil buffer, so the viewport's color comes from the image above
const viewport = element(scrollView, 'Viewport', {
    anchor: new Vec4(0, 0, 1, 1),
    margin: new Vec4(0, BAR, BAR, 0),
    mask: true
});

// The content hangs from the top-left corner of the viewport, and is dragged directly
const content = element(
    viewport,
    'Content',
    { type: ELEMENTTYPE_GROUP, anchor: new Vec4(0, 1, 0, 1), pivot: new Vec2(0, 1), useInput: true },
    0,
    0
);
const [maxColumns, maxRows] = CONTENT.large;
const cells = [];
for (let row = 0; row < maxRows; row++) {
    for (let column = 0; column < maxColumns; column++) {
        const cell = element(
            content,
            `Cell ${row}-${column}`,
            {
                anchor: new Vec4(0, 1, 0, 1),
                pivot: new Vec2(0, 1),
                width: 56,
                height: 36,
                color: paletteColor((row + column) * 0.35)
            },
            4 + column * 60,
            -4 - row * 40
        );
        label(cell, `${row * maxColumns + column + 1}`, 0, 0, 16, { color: wellColor });
        cells.push({ cell, row, column });
    }
}

/**
 * Show the cells of a content size, and size the content to fit them.
 *
 * @param {string} size - The content size, a key of CONTENT.
 */
const setContent = (size) => {
    const [columns, rows] = CONTENT[size];
    cells.forEach(({ cell, row, column }) => {
        cell.enabled = row < rows && column < columns;
    });
    content.element.width = 4 + columns * 60;
    content.element.height = 4 + rows * 40;
};
setContent(settings.content);

/**
 * Create a scrollbar along the bottom or right edge of the scroll view, with a draggable handle.
 *
 * @param {number} orientation - ORIENTATION_HORIZONTAL or ORIENTATION_VERTICAL.
 * @returns {Entity} The scrollbar entity.
 */
const createScrollbar = (orientation) => {
    const horizontal = orientation === ORIENTATION_HORIZONTAL;
    const scrollbar = element(scrollView, horizontal ? 'Horizontal scrollbar' : 'Vertical scrollbar', {
        anchor: horizontal ? new Vec4(0, 0, 1, 0) : new Vec4(1, 0, 1, 1),
        pivot: horizontal ? new Vec2(0, 0) : new Vec2(1, 1),
        margin: horizontal ? new Vec4(0, 0, BAR, -BAR) : new Vec4(-BAR, BAR, 0, 0),
        color: new Color(0.13, 0.16, 0.24)
    });
    const handle = element(scrollbar, 'Handle', {
        anchor: horizontal ? new Vec4(0, 0, 0, 1) : new Vec4(0, 1, 1, 1),
        pivot: horizontal ? new Vec2(0, 0) : new Vec2(1, 1),
        margin: new Vec4(0, 0, 0, 0),
        color: muted,
        useInput: true
    });
    scrollbar.addComponent('scrollbar', { orientation, handleEntity: handle });
    return scrollbar;
};

scrollView.addComponent('scrollview', {
    viewportEntity: viewport,
    contentEntity: content,
    horizontal: true,
    vertical: true,
    horizontalScrollbarEntity: createScrollbar(ORIENTATION_HORIZONTAL),
    verticalScrollbarEntity: createScrollbar(ORIENTATION_VERTICAL),
    horizontalScrollbarVisibility: VISIBILITIES[settings.scrollbars],
    verticalScrollbarVisibility: VISIBILITIES[settings.scrollbars],
    scrollMode: SCROLL_MODES[settings.scrollMode],
    bounceAmount: 0.1,
    friction: 0.05,
    useMouseWheel: true,
    mouseWheelSensitivity: new Vec2(1, 1)
});
// Scroll values past the ends of the content, pushed to in turn and then let go
const SCROLL_TARGETS = [
    [1.3, 0.2],
    [1.3, 1.3],
    [-0.3, 1.3],
    [-0.3, -0.3]
];
const SCROLL_PUSH = 0.8;
const SCROLL_CYCLE = 2.6;
const scrollStart = new Vec2();
const scrollValue = new Vec2();
let scrollTarget = -1;
let scrollTime = SCROLL_CYCLE;

// --- 03 / Layout fitting -------------------------------------------------------------------------
//
// A wrapping layout group that resizes, in every fitting mode, over children whose labels auto fit
// them. Stretch and shrink read the current size of a child as its ideal size, so they keep what
// they did: picking a mode restores the ideal sizes.

const layout = card('03 / LAYOUT FITTING', 'A resizing group; labels auto fit the children');
const groupBounds = element(
    layout.panel,
    'Group bounds',
    { width: 240, height: 105, color: pale, opacity: 0.08 },
    0,
    -4
);
const group = element(layout.panel, 'Layout group', { type: ELEMENTTYPE_GROUP, width: 240, height: 105 }, 0, -4);
group.addComponent('layoutgroup', {
    orientation: ORIENTATION_HORIZONTAL,
    alignment: new Vec2(0, 1),
    spacing: new Vec2(6, 6),
    widthFitting: FITTINGS[settings.widthFitting],
    heightFitting: FITTINGS[settings.heightFitting],
    wrap: settings.wrap
});

// Each child stretches by its own proportion, between its minimum and maximum sizes
const IDEAL = new Vec2(64, 36);
const tiles = [1, 2, 1, 3, 1, 2, 1].map((proportion, i) => {
    const tile = element(group, `Tile ${i + 1}`, { width: IDEAL.x, height: IDEAL.y, color: paletteColor(i * 0.5) });
    tile.addComponent('layoutchild', {
        minWidth: 24,
        maxWidth: 120,
        minHeight: 16,
        maxHeight: 64,
        fitWidthProportion: proportion,
        fitHeightProportion: 1
    });
    element(tile, 'Label', {
        type: ELEMENTTYPE_TEXT,
        fontAsset: fontAsset.id,
        text: `${i + 1}×${proportion}`,
        color: wellColor,
        anchor: new Vec4(0, 0, 1, 1),
        margin: new Vec4(2, 2, 2, 2),
        autoWidth: false,
        autoHeight: false,
        autoFitWidth: true,
        autoFitHeight: true,
        minFontSize: 6,
        maxFontSize: 30
    });
    return tile;
});

const restoreIdealSizes = () => {
    tiles.forEach((tile) => {
        tile.element.width = IDEAL.x;
        tile.element.height = IDEAL.y;
    });
};

// --- 04 / Auto fit -------------------------------------------------------------------------------
//
// Text that auto fits a resizing parent, on both axes, the width only, and the height only with
// wrapped lines.

// While fitting, the line height is scaled by the font size relative to the maximum font size, so
// it is set for the maximum font size
const autoFit = card('04 / AUTO FIT', 'Text fills a parent that resizes');
const fits = [
    ['BOTH', { text: 'Both', autoFitWidth: true, autoFitHeight: true }],
    ['WIDTH', { text: 'Width', autoFitWidth: true, autoFitHeight: false, fontSize: 60 }],
    ['HEIGHT + WRAP', { text: 'Fits its height', autoFitWidth: false, autoFitHeight: true, wrapLines: true }]
].map(([name, properties], i) => {
    const x = (i - 1) * 108;
    const box = element(
        autoFit.panel,
        `${name} box`,
        { width: 90, height: 100, color: new Color(0.12, 0.15, 0.23) },
        x,
        8
    );
    element(box, `${name} text`, {
        type: ELEMENTTYPE_TEXT,
        fontAsset: fontAsset.id,
        color: pale,
        anchor: new Vec4(0, 0, 1, 1),
        margin: new Vec4(4, 4, 4, 4),
        autoWidth: false,
        autoHeight: false,
        minFontSize: 8,
        maxFontSize: 60,
        lineHeight: 66,
        ...properties
    });
    label(autoFit.panel, String(name), x, -84, 11, { color: muted });
    return { box, phase: i * 1.7 };
});

// --- 05 / Masks ----------------------------------------------------------------------------------
//
// A resizing rectangle mask, and a resizing mask shaped by the alpha of a texture rather than a
// sprite. The white bar drawn after them must stay whole.

const masks = card('05 / MASK RESIZE', 'Rectangle + texture alpha mask; the bar stays whole');

// The shape of the second mask comes from the alpha of this texture: a mask discards every pixel
// that isn't fully opaque, so the star has a hard edge
const starArt = document.createElement('canvas');
starArt.width = 128;
starArt.height = 128;
const starCtx = starArt.getContext('2d');
starCtx.fillStyle = '#fff';
starCtx.beginPath();
for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const radius = i % 2 ? 26 : 62;
    starCtx.lineTo(64 + Math.cos(angle) * radius, 64 + Math.sin(angle) * radius);
}
starCtx.fill();
const starTexture = new Texture(device, {
    name: 'element-states-star',
    width: 128,
    height: 128,
    format: PIXELFORMAT_RGBA8,
    mipmaps: false,
    minFilter: FILTER_LINEAR,
    magFilter: FILTER_LINEAR
});
starTexture.setSource(starArt);

const rectMask = element(masks.panel, 'Rectangle mask', { width: 105, height: 105, mask: true }, -78, 4);
const squares = element(rectMask, 'Squares', { type: ELEMENTTYPE_GROUP, width: 160, height: 160 }, 0, 0);
for (let i = 0; i < 25; i++) {
    element(
        squares,
        `Square ${i}`,
        { width: 28, height: 28, color: paletteColor(i * 0.3) },
        ((i % 5) - 2) * 32,
        (Math.floor(i / 5) - 2) * 32
    );
}

const starMask = element(
    masks.panel,
    'Texture mask',
    { width: 110, height: 110, texture: starTexture, mask: true },
    78,
    4
);
const stripes = element(starMask, 'Stripes', { type: ELEMENTTYPE_GROUP, width: 160, height: 160 }, 0, 0);
for (let i = 0; i < 10; i++) {
    element(stripes, `Stripe ${i}`, { width: 160, height: 12, color: paletteColor(i * 0.4 + 1) }, 0, (i - 4.5) * 16);
}

// Drawn after both masks, so an unmask that goes wrong clips it
element(masks.panel, 'Unclipped bar', { width: 300, height: 8, color: Color.WHITE }, 0, -62);

const setMasks = () => {
    [rectMask, starMask].forEach((mask) => {
        mask.element.mask = settings.masks;
        // an unmasked image is drawn, so keep it faint to show where the mask would be
        mask.element.opacity = settings.masks ? 1 : 0.12;
    });
};

// --- 06 / Complex emoji --------------------------------------------------------------------------
//
// CanvasFont emoji made of several code points: flags, skin tones, keycaps and ZWJ sequences, each
// drawn as one glyph, and the atlas pages they were drawn into.

const emojiLines = ['Flags 🇺🇸🇩🇪🇯🇵🇧🇷', 'Skin 👋🏻👋🏽👋🏿', 'Keys 3️⃣#️⃣*️⃣', 'ZWJ 👨‍👩‍👧👁️‍🗨️🏴‍☠️'];
const emojiFont = new CanvasFont(app, {
    color: new Color(1, 1, 1),
    fontName: 'Arial',
    fontSize: 48,
    width: 256,
    height: 256
});
emojiFont.createTextures(emojiLines.join(''));

const emoji = card('06 / COMPLEX EMOJI', `CanvasFont / ${emojiFont.textures.length} atlas pages`);
emojiLines.forEach((text, i) => {
    element(
        emoji.panel,
        text,
        { type: ELEMENTTYPE_TEXT, font: emojiFont, fontSize: 22, text, color: pale },
        0,
        66 - i * 28
    );
});
emojiFont.textures.forEach((page, i, pages) => {
    const x = (i - (pages.length - 1) / 2) * 44;
    element(emoji.panel, `Page ${i}`, { width: 40, height: 40, color: wellColor }, x, -62);
    element(emoji.panel, `Page ${i} texture`, { width: 40, height: 40, texture: page }, x, -62);
});

// --- Settings, layout and animation --------------------------------------------------------------

const applySprite = () => {
    sprite.renderMode = SPRITE_MODES[settings.sprite];
    sprites.caption.element.text = `One sprite, render mode ${settings.sprite.toUpperCase()}`;
};
applySprite();
setMasks();

const settingsEvent = data.on('*:set', (/** @type {string} */ path) => {
    if (!path.startsWith('settings.')) return;
    Object.assign(settings, data.get('settings'));
    const name = path.slice('settings.'.length);
    if (name === 'sprite') {
        applySprite();
    } else if (name === 'scrollMode') {
        scrollView.scrollview.scrollMode = SCROLL_MODES[settings.scrollMode];
    } else if (name === 'scrollbars') {
        scrollView.scrollview.horizontalScrollbarVisibility = VISIBILITIES[settings.scrollbars];
        scrollView.scrollview.verticalScrollbarVisibility = VISIBILITIES[settings.scrollbars];
    } else if (name === 'content') {
        setContent(settings.content);
    } else if (name === 'widthFitting' || name === 'heightFitting' || name === 'wrap') {
        group.layoutgroup.widthFitting = FITTINGS[settings.widthFitting];
        group.layoutgroup.heightFitting = FITTINGS[settings.heightFitting];
        group.layoutgroup.wrap = settings.wrap;
        restoreIdealSizes();
    } else if (name === 'masks') {
        setMasks();
    }
});

const panels = [sprites, scroll, layout, autoFit, masks, emoji].map(({ panel }) => panel);
const resize = () => {
    app.resizeCanvas();
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const narrow = aspect < 1.1;
    const width = narrow ? 800 : 1280;
    const height = narrow ? 1160 : 900;
    screen.screen.referenceResolution = new Vec2(width, height);
    screen.screen.scaleBlend = aspect < width / height ? 0 : 1;
    const columns = narrow ? 2 : 3;
    panels.forEach((panel, i) => {
        panel.setLocalPosition(
            ((i % columns) - (columns - 1) / 2) * 360,
            (narrow ? 220 : 111) - Math.floor(i / columns) * 269,
            0
        );
    });
    const left = -((columns - 1) / 2) * 360 - 170;
    title.setLocalPosition(left, narrow ? 425 : 312, 0);
    title.element.fontSize = narrow ? 30 : 42;
    subtitle.setLocalPosition(left, narrow ? 393 : 274, 0);
    subtitle.element.fontSize = narrow ? 12 : 17;
};
window.addEventListener('resize', resize);
resize();

let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    if (!settings.animate) return;
    const step = Math.min(dt, 0.05);
    time += step;

    spriteImage.element.width = 150 + 70 * Math.sin(time * 0.9);
    spriteImage.element.height = 95 + 55 * Math.sin(time * 0.7);

    // Push the scroll to the next target past an end, on the axes whose content is larger than the
    // viewport, then let go and leave the rest of the cycle to the scroll mode
    scrollTime += step;
    if (scrollTime >= SCROLL_CYCLE) {
        scrollTime = 0;
        scrollTarget = (scrollTarget + 1) % SCROLL_TARGETS.length;
        scrollStart.copy(scrollView.scrollview.scroll);
    }
    if (scrollTime < SCROLL_PUSH) {
        const t = scrollTime / SCROLL_PUSH;
        const ease = t * t * (3 - 2 * t);
        const [x, y] = SCROLL_TARGETS[scrollTarget];
        const scrollsX = content.element.width > viewport.element.calculatedWidth;
        const scrollsY = content.element.height > viewport.element.calculatedHeight;
        scrollValue.set(
            scrollsX ? scrollStart.x + (x - scrollStart.x) * ease : 0,
            scrollsY ? scrollStart.y + (y - scrollStart.y) * ease : 0
        );
        scrollView.scrollview.scroll = scrollValue;
    }

    const groupWidth = 240 + 70 * Math.sin(time * 0.6);
    const groupHeight = 105 + 45 * Math.sin(time * 0.45);
    group.element.width = groupWidth;
    group.element.height = groupHeight;
    groupBounds.element.width = groupWidth;
    groupBounds.element.height = groupHeight;

    fits.forEach(({ box, phase }) => {
        box.element.width = 85 + 15 * Math.sin(time * 0.8 + phase);
        box.element.height = 95 + 45 * Math.sin(time * 0.6 + phase);
    });

    rectMask.element.width = 105 + 35 * Math.sin(time * 0.9);
    rectMask.element.height = 105 + 45 * Math.sin(time * 0.7);
    const starSize = 110 + 40 * Math.sin(time * 1.3);
    starMask.element.width = starSize;
    starMask.element.height = starSize;
    squares.setLocalPosition(20 * Math.sin(time * 0.5), 20 * Math.cos(time * 0.4), 0);
    stripes.setLocalPosition(0, 30 * Math.sin(time * 0.6), 0);
});

app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    settingsEvent.unbind();
    emojiFont.destroy();
    sprite.destroy();
    atlas.destroy();
    starTexture.destroy();
});
app.start();

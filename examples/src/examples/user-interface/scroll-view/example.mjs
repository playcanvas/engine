// @config
//
// A leaderboard of 50 players in a **scroll view**: drag it, or turn the mouse wheel, and it
// bounces at its ends. A layout group stacks the rows, and its reflow event sizes the content to
// fit them. The bar at the bottom shows your rank while your row is out of view: tap it to jump.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ELEMENTTYPE_GROUP,
    ELEMENTTYPE_IMAGE,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    FITTING_STRETCH,
    FontHandler,
    LayoutChildComponentSystem,
    LayoutGroupComponentSystem,
    Mouse,
    ORIENTATION_VERTICAL,
    RESOLUTION_AUTO,
    SCALEMODE_BLEND,
    SCROLL_MODE_BOUNCE,
    SPRITE_RENDERMODE_SLICED,
    ScreenComponentSystem,
    ScrollViewComponentSystem,
    ScrollbarComponentSystem,
    Sprite,
    TextureAtlasHandler,
    TextureHandler,
    Vec2,
    createGraphicsDevice
} from 'playcanvas';

import { uiAtlasData } from 'examples/assets/ui/ui-atlas.mjs';
import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    font: new Asset('font', 'font', { url: './assets/fonts/roboto-regular.json' }),
    bold: new Asset('bold', 'font', { url: './assets/fonts/roboto-bold.json' }),
    ui: new Asset('ui', 'textureatlas', { url: './assets/ui/ui-atlas.png' }, uiAtlasData)
};

const device = await createGraphicsDevice(canvas, { deviceTypes: [deviceType] });
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

// Dragging with the mouse needs a mouse device, created after the element input
const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.elementInput = new ElementInput(canvas);
createOptions.mouse = new Mouse(canvas);
createOptions.componentSystems = [
    CameraComponentSystem,
    ScreenComponentSystem,
    ElementComponentSystem,
    LayoutGroupComponentSystem,
    LayoutChildComponentSystem,
    ScrollViewComponentSystem,
    ScrollbarComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, TextureAtlasHandler, FontHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Fill the window, and keep the canvas resolution the same as its size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

const ORANGE = new Color(1, 0.55, 0.2);
const PANEL = new Color(0.16, 0.18, 0.23);
const ROW = new Color(0.21, 0.24, 0.3);
const LIGHT = new Color(0.95, 0.96, 0.98);
const MUTED = new Color(0.6, 0.64, 0.72);
const MEDALS = [new Color(1, 0.8, 0.3), new Color(0.8, 0.84, 0.9), new Color(0.85, 0.55, 0.35)];

const camera = new Entity('camera');
camera.addComponent('camera', { clearColor: new Color(0.1, 0.11, 0.13) });
app.root.addChild(camera);

const screen = new Entity('screen');
screen.addComponent('screen', {
    screenSpace: true,
    referenceResolution: [1280, 720],
    scaleMode: SCALEMODE_BLEND,
    scaleBlend: 0.5
});
app.root.addChild(screen);

const atlas = assets.ui.resource;
const sliced = (/** @type {string} */ frame, /** @type {number} */ pixelsPerUnit) => {
    return new Sprite(device, { atlas, frameKeys: [frame], pixelsPerUnit, renderMode: SPRITE_RENDERMODE_SLICED });
};
const panel = sliced('panel', 2);
const track = sliced('track', 4);
const avatars = new Sprite(device, { atlas, frameKeys: ['avatar-1', 'avatar-2', 'avatar-3', 'avatar-4'] });
app.on('destroy', () => [panel, track, avatars].forEach((sprite) => sprite.destroy()));

/**
 * Create an image or text element, centered on its parent unless the properties say otherwise.
 *
 * @param {Entity} parent - The parent entity.
 * @param {string} name - The entity name.
 * @param {object} properties - Properties of the element component.
 * @returns {Entity} The entity.
 */
const createElement = (parent, name, properties) => {
    const entity = new Entity(name);
    entity.addComponent('element', {
        type: ELEMENTTYPE_IMAGE,
        anchor: [0.5, 0.5, 0.5, 0.5],
        pivot: [0.5, 0.5],
        fontAsset: assets.font.id,
        color: LIGHT,
        ...properties
    });
    parent.addChild(entity);
    return entity;
};

const title = createElement(screen, 'title', {
    type: ELEMENTTYPE_TEXT,
    fontAsset: assets.bold.id,
    text: 'Leaderboard'
});

// The scroll view, on a panel, and its viewport: a mask that shows the content only inside it.
// The viewport leaves room on the right for the scrollbar
const scrollView = createElement(screen, 'scroll view', { sprite: panel, color: PANEL, width: 560, height: 540 });
const viewport = createElement(scrollView, 'viewport', {
    sprite: panel,
    anchor: [0, 0, 1, 1],
    margin: [8, 8, 32, 8],
    mask: true
});

// The content hangs from the top edge of the viewport, as wide as the viewport. A layout group
// stacks the rows in it, and each layout makes the content as tall as its rows and padding
const content = createElement(viewport, 'content', {
    type: ELEMENTTYPE_GROUP,
    anchor: [0, 1, 1, 1],
    pivot: [0, 1],
    margin: [0, 0, 0, 0],
    useInput: true
});
content.addComponent('layoutgroup', {
    orientation: ORIENTATION_VERTICAL,
    spacing: [0, 10],
    padding: [10, 10, 10, 10],
    widthFitting: FITTING_STRETCH
});
content.layoutgroup.on('reflow', ({ bounds }) => {
    content.element.height = bounds.w + 20;
});

// A scrollbar along the right edge, and its handle, which the scroll view sizes and moves
const scrollbar = createElement(scrollView, 'scrollbar', {
    sprite: track,
    color: ROW,
    anchor: [1, 0, 1, 1],
    pivot: [1, 1],
    margin: [0, 12, 12, 12],
    width: 12
});
const handle = createElement(scrollbar, 'handle', {
    sprite: track,
    color: MUTED,
    anchor: [0, 1, 1, 1],
    pivot: [1, 1],
    margin: [0, 0, 0, 0],
    useInput: true
});
scrollbar.addComponent('scrollbar', {
    orientation: ORIENTATION_VERTICAL,
    handleEntity: handle
});
scrollView.addComponent('scrollview', {
    viewportEntity: viewport,
    contentEntity: content,
    verticalScrollbarEntity: scrollbar,
    horizontal: false,
    vertical: true,
    scrollMode: SCROLL_MODE_BOUNCE,
    bounceAmount: 0.1,
    friction: 0.05
});

/**
 * Create a leaderboard row: rank, avatar, name and score.
 *
 * @param {Entity} parent - The parent entity.
 * @param {number} rank - The rank, from 1.
 * @param {string} name - The player's name.
 * @param {number} score - The player's score.
 * @param {object} [properties] - More properties of the row's element.
 * @returns {Entity} The row entity.
 */
const createRow = (parent, rank, name, score, properties) => {
    const mine = name === 'You';
    const row = createElement(parent, `rank ${rank}`, {
        sprite: panel,
        color: mine ? ORANGE : ROW,
        height: 64,
        ...properties
    });
    const text = { type: ELEMENTTYPE_TEXT, fontAsset: assets.bold.id, fontSize: 24, color: mine ? PANEL : LIGHT };
    const left = { anchor: [0, 0.5, 0, 0.5], pivot: [0, 0.5] };
    const color = mine ? PANEL : (MEDALS[rank - 1] ?? MUTED);
    createElement(row, 'rank', { ...text, ...left, text: `${rank}`, color }).setLocalPosition(20, 0, 0);
    createElement(row, 'avatar', {
        ...left,
        sprite: avatars,
        spriteFrame: rank % 4,
        width: 44,
        height: 44
    }).setLocalPosition(72, 0, 0);
    createElement(row, 'name', { ...text, ...left, text: name, fontAsset: assets.font.id }).setLocalPosition(132, 0, 0);
    const right = { anchor: [1, 0.5, 1, 0.5], pivot: [1, 0.5] };
    createElement(row, 'score', { ...text, ...right, text: score.toLocaleString('en-US') }).setLocalPosition(-20, 0, 0);
    return row;
};

// 50 players, with you in 37th place. Each tag is a unique pairing of the two lists of words
const words = [
    ['Swift', 'Silent', 'Iron', 'Lucky', 'Crimson', 'Frost', 'Shadow', 'Golden', 'Wild', 'Brave'],
    ['Fox', 'Raven', 'Wolf', 'Tiger', 'Falcon', 'Viper', 'Bear', 'Hawk', 'Lynx', 'Otter']
];
const ME = 36;
const players = Array.from({ length: 50 }, (_, i) => {
    const name = i === ME ? 'You' : words[0][i % 10] + words[1][(i * 3 + Math.floor(i / 10)) % 10];
    return { name, score: 24800 - i * 410 - ((i * 37) % 90) };
});
players.forEach(({ name, score }, i) => createRow(content, i + 1, name, score));

// Your rank, pinned to the bottom of the scroll view. It shows while your row is out of view,
// which the scroll view's set:scroll event tells whenever the content moves
const pin = createRow(scrollView, ME + 1, 'You', players[ME].score, {
    anchor: [0.5, 0, 0.5, 0],
    pivot: [0.5, 0],
    useInput: true
});
const top = 10 + ME * 74;
scrollView.scrollview.on('set:scroll', (scroll) => {
    const visible = viewport.element.calculatedHeight;
    const offset = scroll.y * (content.element.calculatedHeight - visible);
    pin.enabled = top < offset || top + 64 > offset + visible;
});

// Tapping the pin scrolls your row into the middle of the view. The scroll position goes from 0 at
// the top of the content to 1 at the bottom
pin.element.on('click', () => {
    const visible = viewport.element.calculatedHeight;
    const y = (top + 32 - visible / 2) / (content.element.calculatedHeight - visible);
    scrollView.scrollview.scroll = new Vec2(0, Math.min(Math.max(y, 0), 1));
});

// A wide list on landscape canvases, and a tall one on portrait canvases
const layout = () => {
    const portrait = device.height > device.width;
    const reference = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
    screen.screen.referenceResolution = reference;
    screen.screen.scaleBlend = device.width / reference.x > device.height / reference.y ? 1 : 0;
    scrollView.element.width = portrait ? 500 : 560;
    scrollView.element.height = portrait ? 760 : 540;
    scrollView.setLocalPosition(0, portrait ? -40 : -30, 0);
    title.setLocalPosition(0, portrait ? 390 : 290, 0);

    // The pin is as wide as the rows, and centered on them
    pin.element.width = scrollView.element.width - 60;
    pin.setLocalPosition(-12, 18, 0);
};
device.on('resizecanvas', layout);
layout();

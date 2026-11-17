// @config
//
// A player profile card that uses **masks** three ways. The cover photo pans inside a rectangle
// mask, a shaped mask clips the avatar to a circle, and the card's own rounded mask clips both,
// so the masks nest.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ELEMENTTYPE_IMAGE,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    RESOLUTION_AUTO,
    SCALEMODE_BLEND,
    SPRITE_RENDERMODE_SLICED,
    ScreenComponentSystem,
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
    ui: new Asset('ui', 'textureatlas', { url: './assets/ui/ui-atlas.png' }, uiAtlasData),
    landscape: new Asset('landscape', 'texture', { url: './assets/ui/landscape.png' }, { srgb: true })
};

const device = await createGraphicsDevice(canvas, { deviceTypes: [deviceType] });
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [CameraComponentSystem, ScreenComponentSystem, ElementComponentSystem];
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

const PANEL = new Color(0.16, 0.18, 0.23);
const LIGHT = new Color(0.95, 0.96, 0.98);
const MUTED = new Color(0.6, 0.64, 0.72);

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

// Use a portrait reference resolution on portrait canvases, and scale to whichever axis has
// less room, so the whole card stays on screen
const layout = () => {
    const portrait = device.height > device.width;
    const reference = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
    screen.screen.referenceResolution = reference;
    screen.screen.scaleBlend = device.width / reference.x > device.height / reference.y ? 1 : 0;
};
device.on('resizecanvas', layout);
layout();

const atlas = assets.ui.resource;
const rounded = new Sprite(device, {
    atlas,
    frameKeys: ['panel'],
    pixelsPerUnit: 2,
    renderMode: SPRITE_RENDERMODE_SLICED
});
const circle = new Sprite(device, { atlas, frameKeys: ['circle'] });
const portrait = new Sprite(device, { atlas, frameKeys: ['avatar-2'] });
app.on('destroy', () => [rounded, circle, portrait].forEach((sprite) => sprite.destroy()));

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

// The card is a mask, so its rounded shape clips everything below it. A mask is not drawn
// itself, so the card's color comes from an image that fills it
const card = createElement(screen, 'card', { sprite: rounded, width: 360, height: 470, mask: true });
createElement(card, 'background', { color: PANEL, anchor: [0, 0, 1, 1], margin: [0, 0, 0, 0] });

// The cover is a rectangle mask across the top of the card, over a larger photo that pans inside
// it. The photo is clipped by both masks, so its top corners follow the rounded card
const cover = createElement(card, 'cover', { anchor: [0, 1, 1, 1], pivot: [0.5, 1], mask: true });
cover.element.left = 0;
cover.element.right = 0;
cover.element.height = 200;
const photo = createElement(cover, 'photo', { textureAsset: assets.landscape.id, width: 400, height: 400 });

// The avatar is a shaped mask: the transparent corners of the circle sprite clip the square
// picture below it into a circle. A ring behind it cuts it out of the cover
createElement(card, 'ring', { sprite: circle, color: PANEL, width: 132, height: 132 }).setLocalPosition(0, 35, 0);
const avatar = createElement(card, 'avatar', { sprite: circle, width: 116, height: 116, mask: true });
avatar.setLocalPosition(0, 35, 0);
createElement(avatar, 'picture', { sprite: portrait, width: 116, height: 116 });
createElement(card, 'online', {
    sprite: circle,
    color: new Color(0.3, 0.85, 0.45),
    width: 24,
    height: 24
}).setLocalPosition(40, -5, 0);

createElement(card, 'name', {
    type: ELEMENTTYPE_TEXT,
    fontAsset: assets.bold.id,
    text: 'Aria Nightfall',
    fontSize: 34
}).setLocalPosition(0, -70, 0);
createElement(card, 'class', {
    type: ELEMENTTYPE_TEXT,
    text: 'Level 42 · Ranger',
    fontSize: 24,
    color: MUTED
}).setLocalPosition(0, -108, 0);

[
    ['318', 'Wins'],
    ['#12', 'Rank'],
    ['96h', 'Played']
].forEach(([value, label], i) => {
    const x = (i - 1) * 110;
    createElement(card, label, {
        type: ELEMENTTYPE_TEXT,
        fontAsset: assets.bold.id,
        text: value,
        fontSize: 30
    }).setLocalPosition(x, -168, 0);
    createElement(card, `${label} label`, {
        type: ELEMENTTYPE_TEXT,
        text: label,
        fontSize: 20,
        color: MUTED
    }).setLocalPosition(x, -200, 0);
});

// Drift the photo, so the cover shows a different part of it
let time = 0;
app.on('update', (dt) => {
    time += dt;
    photo.setLocalPosition(Math.sin(time * 0.4) * 20, Math.sin(time * 0.25) * 90, 0);
});

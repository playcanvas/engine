// @config
//
// A level select screen whose art comes in four shapes. The cards **Cover** their squares, cropped by
// a mask, and each card's pivot picks the part that stays in view. The preview shows the whole
// picture with **Contain**, and the map shows part of a texture with **rect**. Tap a card.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    ButtonComponentSystem,
    CameraComponentSystem,
    Color,
    ELEMENTTYPE_IMAGE,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    FITMODE_CONTAIN,
    FITMODE_COVER,
    FontHandler,
    RESOLUTION_AUTO,
    SCALEMODE_BLEND,
    SPRITE_RENDERMODE_SLICED,
    ScreenComponentSystem,
    Sprite,
    TextureAtlasHandler,
    TextureHandler,
    Vec2,
    Vec4,
    createGraphicsDevice
} from 'playcanvas';

import { uiAtlasData } from 'examples/assets/ui/ui-atlas.mjs';
import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// The levels: the name, the art, the pivot the art is placed at when it covers a card, and where
// the level is on the world map, in fractions of the map from its bottom-left corner
const LEVELS = [
    { name: 'Sunken Crypt', url: './assets/ui/level-crypt.png', pivot: [0.5, 0], map: [0.71, 0.31] },
    { name: 'Emerald Forest', url: './assets/ui/level-forest.png', pivot: [0.8, 0.5], map: [0.27, 0.37] },
    { name: 'Dune Sea', url: './assets/ui/level-desert.png', pivot: [0.7, 0.5], map: [0.7, 0.68] },
    { name: 'Frost Peak', url: './assets/ui/level-peak.png', pivot: [0.5, 0.5], map: [0.34, 0.68] }
];

const assets = {
    bold: new Asset('bold', 'font', { url: './assets/fonts/roboto-bold.json' }),
    ui: new Asset('ui', 'textureatlas', { url: './assets/ui/ui-atlas.png' }, uiAtlasData),
    map: new Asset('map', 'texture', { url: './assets/ui/world-map.png' }, { srgb: true })
};
const art = LEVELS.map(({ name, url }) => new Asset(name, 'texture', { url }, { srgb: true }));

const device = await createGraphicsDevice(canvas, { deviceTypes: [deviceType] });
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.elementInput = new ElementInput(canvas);
createOptions.componentSystems = [
    CameraComponentSystem,
    ScreenComponentSystem,
    ElementComponentSystem,
    ButtonComponentSystem
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
    new AssetListLoader([...Object.values(assets), ...art], app.assets).load(resolve);
});

app.start();

const ORANGE = new Color(1, 0.55, 0.2);
const PANEL = new Color(0.16, 0.18, 0.23);
const LIGHT = new Color(0.95, 0.96, 0.98);

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
const panel = new Sprite(device, {
    atlas,
    frameKeys: ['panel'],
    pixelsPerUnit: 2,
    renderMode: SPRITE_RENDERMODE_SLICED
});
const outline = new Sprite(device, {
    atlas,
    frameKeys: ['panel-outline'],
    pixelsPerUnit: 2,
    renderMode: SPRITE_RENDERMODE_SLICED
});
const circle = new Sprite(device, { atlas, frameKeys: ['circle'] });
app.on('destroy', () => [panel, outline, circle].forEach((sprite) => sprite.destroy()));

/**
 * Create an element, centered on its parent unless the properties say otherwise.
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
        fontAsset: assets.bold.id,
        color: LIGHT,
        ...properties
    });
    parent.addChild(entity);
    return entity;
};
const fill = { anchor: [0, 0, 1, 1], margin: [0, 0, 0, 0] };

const title = createElement(screen, 'title', { type: ELEMENTTYPE_TEXT, text: 'Choose a level', fontSize: 40 });

// The preview: the whole of the level's art, contained in a 16:9 frame, whatever its shape
const preview = createElement(screen, 'preview', { sprite: panel, color: PANEL, width: 560, height: 315 });
const picture = createElement(preview, 'picture', { ...fill, margin: [12, 12, 12, 12], fitMode: FITMODE_CONTAIN });
const caption = createElement(preview, 'caption', {
    type: ELEMENTTYPE_TEXT,
    fontSize: 32,
    anchor: [0, 0, 0, 0],
    pivot: [0, 1]
});
caption.setLocalPosition(4, -16, 0);

// The map: a round mask over the world map, which shows the part of it around the level. The map
// is 4:3, so a part 0.3 of its width and 0.4 of its height is square
const inset = createElement(preview, 'inset', {
    sprite: circle,
    width: 150,
    height: 150,
    anchor: [1, 0, 1, 0],
    mask: true
});
const map = createElement(inset, 'map', { ...fill, texture: assets.map.resource });
createElement(inset, 'you', { sprite: circle, color: ORANGE, width: 18, height: 18 });

// The cards: each level's art covers a square, and the card, a mask, crops what overflows. The art
// is placed at its pivot: the crypt keeps its door in view, and the dunes their pyramid
const cards = LEVELS.map((level, i) => {
    const card = createElement(screen, level.name, {
        sprite: panel,
        width: 170,
        height: 170,
        mask: true,
        useInput: true
    });
    const cover = createElement(card, 'art', {
        ...fill,
        texture: art[i].resource,
        fitMode: FITMODE_COVER,
        pivot: level.pivot
    });

    // A mask isn't drawn, so the button tints the art in it
    card.addComponent('button', {
        imageEntity: cover,
        hoverTint: new Color(0.8, 0.82, 0.86),
        pressedTint: new Color(0.6, 0.62, 0.66)
    });
    return card;
});

// The ring around the chosen card is drawn over the cards, so it is not cropped by their masks
const ring = createElement(screen, 'ring', { sprite: outline, color: ORANGE, width: 186, height: 186 });

// Choosing a level shows its art and name, and moves the map to the level and the ring to its card
let chosen = 0;
const choose = (/** @type {number} */ i) => {
    chosen = i;
    const level = LEVELS[i];
    picture.element.texture = art[i].resource;
    caption.element.text = level.name;
    map.element.rect = new Vec4(level.map[0] - 0.15, level.map[1] - 0.2, 0.3, 0.4);
    ring.setLocalPosition(cards[i].getLocalPosition());
};
cards.forEach((card, i) => card.button.on('click', () => choose(i)));
// The cards in a row under the preview on landscape canvases, and in a square on portrait ones
const layout = () => {
    const portrait = device.height > device.width;
    const reference = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
    screen.screen.referenceResolution = reference;
    screen.screen.scaleBlend = device.width / reference.x > device.height / reference.y ? 1 : 0;
    title.setLocalPosition(0, portrait ? 390 : 305, 0);
    preview.element.width = portrait ? 500 : 560;
    preview.element.height = portrait ? 281 : 315;
    preview.setLocalPosition(0, portrait ? 190 : 100, 0);
    inset.setLocalPosition(portrait ? -85 : -20, portrait ? 85 : 20, 0);
    cards.forEach((card, i) => {
        const x = portrait ? ((i % 2) - 0.5) * 200 : (i - 1.5) * 200;
        card.setLocalPosition(x, portrait ? -130 - Math.floor(i / 2) * 200 : -235, 0);
    });
    choose(chosen);
};
device.on('resizecanvas', layout);
layout();

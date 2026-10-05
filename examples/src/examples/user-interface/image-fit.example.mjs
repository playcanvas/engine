// @config
//
// A level select screen whose art comes in four shapes. The cards **Cover** their squares, cropped by
// a mask, and each card's pivot picks the part that stays in view. The preview shows the whole
// picture with **Contain**. The map shows part of the world map with **rect**, the part around the
// level, and glides to the next one. Tap a card.

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
    { name: 'Sunken Crypt', url: './assets/ui/level-crypt.png', pivot: [0.5, 0], map: new Vec2(0.71, 0.3) },
    { name: 'Emerald Forest', url: './assets/ui/level-forest.png', pivot: [0.8, 0.5], map: new Vec2(0.27, 0.37) },
    { name: 'Dune Sea', url: './assets/ui/level-desert.png', pivot: [0.7, 0.5], map: new Vec2(0.7, 0.7) },
    { name: 'Frost Peak', url: './assets/ui/level-peak.png', pivot: [0.5, 0.5], map: new Vec2(0.3, 0.7) }
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
const pin = new Sprite(device, { atlas, frameKeys: ['icon-pin'] });
app.on('destroy', () => [panel, outline, pin].forEach((sprite) => sprite.destroy()));

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
const preview = createElement(screen, 'preview', { sprite: panel, color: PANEL });
const picture = createElement(preview, 'picture', { ...fill, margin: [12, 12, 12, 12], fitMode: FITMODE_CONTAIN });
const caption = createElement(preview, 'caption', {
    type: ELEMENTTYPE_TEXT,
    fontSize: 32,
    anchor: [0, 0, 0, 0],
    pivot: [0, 1]
});
caption.setLocalPosition(4, -16, 0);

// The map: a square of the world map, with a pin in the middle that marks the level. The pin's
// pivot is its tip, near the bottom of the icon
const mapPanel = createElement(screen, 'map', { sprite: panel, color: PANEL, width: 270, height: 270 });
const worldMap = createElement(mapPanel, 'world map', {
    ...fill,
    margin: [12, 12, 12, 12],
    texture: assets.map.resource
});
createElement(worldMap, 'pin', { sprite: pin, color: ORANGE, width: 44, height: 44, pivot: [0.5, 0.08] });

// The cards: each level's art covers a square, and the card, a mask, crops what overflows. The art
// is placed at its pivot: the crypt keeps its door in view, and the dunes their pyramid
const cards = LEVELS.map((level, i) => {
    const card = createElement(screen, level.name, { sprite: panel, mask: true, useInput: true });
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
const ring = createElement(screen, 'ring', { sprite: outline, color: ORANGE });

// Choosing a level shows its art and name, and moves the ring to its card
let chosen = 0;
const choose = (/** @type {number} */ i) => {
    chosen = i;
    picture.element.texture = art[i].resource;
    caption.element.text = LEVELS[i].name;
    ring.setLocalPosition(cards[i].getLocalPosition());
};
cards.forEach((card, i) => card.button.on('click', () => choose(i)));

// The map shows the part of the world map around the chosen level: 0.375 of its width and 0.5 of
// its height, which is square as the map is 4:3. Each frame the part moves some of the way to the
// level, so the map glides from one to the next
const view = LEVELS[chosen].map.clone();
const rect = new Vec4(0, 0, 0.375, 0.5);
app.on('update', (dt) => {
    view.lerp(view, LEVELS[chosen].map, Math.min(1, dt * 8));
    rect.x = view.x - rect.z / 2;
    rect.y = view.y - rect.w / 2;
    worldMap.element.rect = rect;
});

// The preview and the map side by side over a row of cards on landscape canvases, and one under
// the other on portrait ones, over smaller cards
const layout = () => {
    const portrait = device.height > device.width;
    const reference = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
    screen.screen.referenceResolution = reference;
    screen.screen.scaleBlend = device.width / reference.x > device.height / reference.y ? 1 : 0;
    title.setLocalPosition(0, portrait ? 396 : 300, 0);
    preview.element.width = portrait ? 500 : 480;
    preview.element.height = portrait ? 281 : 270;
    preview.setLocalPosition(portrait ? 0 : -145, portrait ? 210 : 115, 0);
    mapPanel.setLocalPosition(portrait ? 0 : 250, portrait ? -136 : 115, 0);
    const size = portrait ? 113 : 170;
    cards.forEach((card, i) => {
        card.element.width = size;
        card.element.height = size;
        card.setLocalPosition((i - 1.5) * (portrait ? 129 : 200), portrait ? -360 : -230, 0);
    });
    ring.element.width = size + 16;
    ring.element.height = size + 16;
    choose(chosen);
};
device.on('resizecanvas', layout);
layout();

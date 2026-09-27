// @config
//
// A backpack screen built from three **layout groups**, set up like the manual's example layouts:
// the item's details are a vertical list, the bag is a grid whose last row is centered, and the
// actions are a toolbar that shares its width. Tap an item, then loot, sort or drop, to try them.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    ButtonComponentSystem,
    CameraComponentSystem,
    Color,
    ELEMENTTYPE_GROUP,
    ELEMENTTYPE_IMAGE,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    FITTING_NONE,
    FITTING_STRETCH,
    FontHandler,
    LayoutChildComponentSystem,
    LayoutGroupComponentSystem,
    ORIENTATION_HORIZONTAL,
    ORIENTATION_VERTICAL,
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
    ui: new Asset('ui', 'textureatlas', { url: './assets/ui/ui-atlas.png' }, uiAtlasData)
};

const device = await createGraphicsDevice(canvas, { deviceTypes: [deviceType] });
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.elementInput = new ElementInput(canvas);
createOptions.componentSystems = [
    CameraComponentSystem,
    ScreenComponentSystem,
    ElementComponentSystem,
    ButtonComponentSystem,
    LayoutGroupComponentSystem,
    LayoutChildComponentSystem
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
const SLOT = new Color(0.22, 0.25, 0.31);
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

// The items that can be in the bag, each with an icon in the UI kit and the lines of its details
const ITEMS = {
    sword: { name: 'Iron Sword', color: [0.8, 0.9, 1], stats: ['+12 attack', 'Weighs 3 kg', 'Sells for 40 gold'] },
    potion: { name: 'Health Potion', color: [1, 0.35, 0.4], stats: ['Heals 50 health', 'Sells for 15 gold'] },
    shield: { name: 'Oak Shield', color: [0.8, 0.6, 0.4], stats: ['+8 defense', 'Weighs 5 kg', 'Sells for 30 gold'] },
    gem: { name: 'Ruby', color: [1, 0.3, 0.45], stats: ['Sells for 120 gold'] },
    key: { name: 'Crypt Key', color: [1, 0.8, 0.3], stats: ['Opens the crypt'] },
    flame: { name: 'Fire Scroll', color: [1, 0.55, 0.2], stats: ['Deals 30 damage', 'One use', 'Sells for 60 gold'] },
    heart: { name: 'Heart Crystal', color: [1, 0.45, 0.6], stats: ['+20 health', 'Sells for 80 gold'] }
};
const kinds = Object.keys(ITEMS);

const atlas = assets.ui.resource;
const sliced = (/** @type {string} */ frame) => {
    return new Sprite(device, { atlas, frameKeys: [frame], pixelsPerUnit: 2, renderMode: SPRITE_RENDERMODE_SLICED });
};
const panel = sliced('panel');
const outline = sliced('panel-outline');
const icons = new Sprite(device, { atlas, frameKeys: kinds.map((kind) => `icon-${kind}`) });
app.on('destroy', () => [panel, outline, icons].forEach((sprite) => sprite.destroy()));

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

// The details of the chosen item: a vertical list, on its panel, that stretches each row to the
// width of the panel, less its padding
const details = createElement(screen, 'details', { sprite: panel, color: PANEL, width: 300, height: 400 });
details.addComponent('layoutgroup', {
    orientation: ORIENTATION_VERTICAL,
    alignment: [0, 1],
    padding: [10, 10, 10, 10],
    spacing: [0, 10],
    widthFitting: FITTING_STRETCH,
    heightFitting: FITTING_NONE,
    wrap: false
});

// A row for the name, and one for each line of the item with the most details. The list lays out
// only the rows that are enabled
const rows = [0, 1, 2, 3].map((i) => {
    const row = createElement(details, `row ${i}`, { sprite: panel, color: SLOT, height: 60 });
    const text = createElement(row, 'text', {
        type: ELEMENTTYPE_TEXT,
        fontAsset: i === 0 ? assets.bold.id : assets.font.id,
        fontSize: 24,
        color: i === 0 ? ORANGE : LIGHT,
        anchor: [0, 0.5, 0, 0.5],
        pivot: [0, 0.5]
    });
    text.setLocalPosition(16, 0, 0);
    return row;
});

// The bag: a grid of 100 x 100 slots in a group 320 units wide, so three fit on each row, and an
// alignment that centers each row, including a last row that is not full
const bag = createElement(screen, 'bag', { sprite: panel, color: PANEL, width: 360, height: 400 });
const title = createElement(bag, 'title', { type: ELEMENTTYPE_TEXT, fontAsset: assets.bold.id, text: 'Backpack' });
title.setLocalPosition(0, 164, 0);
const grid = createElement(bag, 'grid', { type: ELEMENTTYPE_GROUP, width: 320, height: 320 });
grid.setLocalPosition(0, -30, 0);
grid.addComponent('layoutgroup', {
    orientation: ORIENTATION_HORIZONTAL,
    alignment: [0.5, 1],
    padding: [0, 0, 0, 0],
    spacing: [10, 10],
    widthFitting: FITTING_NONE,
    heightFitting: FITTING_NONE,
    wrap: true
});

// The toolbar: a row, on its panel, that shares the width of the panel between its buttons and
// gives them its height, less its padding
const toolbar = createElement(screen, 'toolbar', { sprite: panel, color: PANEL, width: 690, height: 80 });
toolbar.addComponent('layoutgroup', {
    orientation: ORIENTATION_HORIZONTAL,
    alignment: [0, 0.5],
    padding: [10, 10, 10, 10],
    spacing: [10, 0],
    widthFitting: FITTING_STRETCH,
    heightFitting: FITTING_STRETCH,
    wrap: false
});

/**
 * Create a toolbar button. It starts 100 units wide, and the toolbar stretches it.
 *
 * @param {string} text - The label.
 * @param {Color} color - The color of the button.
 * @returns {Entity} The button entity.
 */
const createButton = (text, color) => {
    const button = createElement(toolbar, text, { sprite: panel, color, width: 100, height: 60, useInput: true });
    button.addComponent('button', {
        imageEntity: button,
        hoverTint: new Color(color.r * 0.8 + 0.2, color.g * 0.8 + 0.2, color.b * 0.8 + 0.2),
        pressedTint: new Color(color.r * 0.7, color.g * 0.7, color.b * 0.7),
        inactiveTint: new Color(0.3, 0.32, 0.37)
    });
    createElement(button, 'label', { type: ELEMENTTYPE_TEXT, fontAsset: assets.bold.id, text, fontSize: 26 });
    return button;
};
const loot = createButton('Loot', ORANGE);
const sort = createButton('Sort', new Color(0.26, 0.29, 0.36));
const drop = createButton('Drop', new Color(0.75, 0.25, 0.22));

// A maximum width stops the drop button from growing as wide as the others
drop.addComponent('layoutchild', {
    maxWidth: 120
});

// Show the chosen item's name and details, a row each. The drop button shows only while there is
// an item to drop, and the toolbar shares its width between the buttons that are enabled
let chosen = null;
const choose = (/** @type {Entity|null} */ slot) => {
    if (chosen) {
        chosen.findByName('ring').enabled = false;
    }
    chosen = slot;
    const item = slot ? ITEMS[slot.name] : null;
    const lines = item ? [item.name, ...item.stats] : ['Tap an item'];
    rows.forEach((row, i) => {
        row.enabled = i < lines.length;
        row.findByName('text').element.text = lines[i] ?? '';
    });
    if (slot) {
        slot.findByName('ring').enabled = true;
    }
    drop.enabled = !!slot;
};

// Add an item to the bag. The grid places its slot after the others
const add = (/** @type {string} */ kind) => {
    const slot = createElement(grid, kind, { sprite: panel, color: SLOT, width: 100, height: 100, useInput: true });
    const color = new Color(...ITEMS[kind].color);
    createElement(slot, 'icon', { sprite: icons, spriteFrame: kinds.indexOf(kind), color, width: 64, height: 64 });
    createElement(slot, 'ring', { sprite: outline, color: ORANGE, width: 100, height: 100 }).enabled = false;
    slot.element.on('click', () => choose(slot));
    loot.button.active = grid.children.length < 9;
    return slot;
};
// The bag starts with the first five kinds of item
kinds.slice(0, 5).forEach(add);
choose(grid.children[0]);

// Loot adds the next kind of item. Sort adds the slots again in the order of their names, which is
// the order the grid follows. Drop removes the chosen item
let looted = grid.children.length;
loot.button.on('click', () => choose(add(kinds[looted++ % kinds.length])));
sort.button.on('click', () => {
    const sorted = grid.children.slice().sort((a, b) => ITEMS[a.name].name.localeCompare(ITEMS[b.name].name));
    sorted.forEach((slot) => grid.addChild(slot));
});
drop.button.on('click', () => {
    const slot = chosen;
    choose(null);
    slot.destroy();
    loot.button.active = true;
});

// Side by side on landscape canvases, and stacked on portrait ones
const layout = () => {
    const portrait = device.height > device.width;
    const reference = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
    screen.screen.referenceResolution = reference;
    screen.screen.scaleBlend = device.width / reference.x > device.height / reference.y ? 1 : 0;
    details.element.width = portrait ? 360 : 300;
    details.element.height = portrait ? 290 : 400;
    details.setLocalPosition(portrait ? 0 : -195, portrait ? 260 : 50, 0);
    bag.setLocalPosition(portrait ? 0 : 165, portrait ? -105 : 50, 0);
    toolbar.element.width = portrait ? 360 : 690;
    toolbar.setLocalPosition(0, portrait ? -365 : -210, 0);
};
device.on('resizecanvas', layout);
layout();

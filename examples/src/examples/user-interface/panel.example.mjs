// @config
//
// A quest dialog, achievement toasts and a quest log, all drawn from small sprites: **sliced**
// panels keep their corners as they stretch to any size, like the toasts that fit their text, and
// the **tiled** paper of the log repeats its lines as the log grows. Accept a quest to try it.

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
    FontHandler,
    RESOLUTION_AUTO,
    SCALEMODE_BLEND,
    SPRITE_RENDERMODE_SIMPLE,
    SPRITE_RENDERMODE_SLICED,
    SPRITE_RENDERMODE_TILED,
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
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

const ORANGE = new Color(1, 0.55, 0.2);
const PANEL = new Color(0.16, 0.18, 0.23);
const INK = new Color(0.12, 0.13, 0.16);
const LIGHT = new Color(0.95, 0.96, 0.98);
const MUTED = new Color(0.6, 0.64, 0.72);
const SLATE = new Color(0.26, 0.29, 0.36);

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

// Sprites from the UI kit's texture atlas. Its panel frame is 128 x 128 pixels with 32 pixel
// borders, so at 2 pixels per unit the corners stay 16 units wide, whatever the size of the panel
const atlas = assets.ui.resource;
const createSprite = (/** @type {string} */ frame, /** @type {number} */ renderMode) => {
    return new Sprite(device, { atlas, frameKeys: [frame], pixelsPerUnit: 2, renderMode });
};
const panelSprite = createSprite('panel', SPRITE_RENDERMODE_SLICED);
const shadowSprite = createSprite('shadow', SPRITE_RENDERMODE_SLICED);
const paperSprite = createSprite('paper', SPRITE_RENDERMODE_TILED);
const starSprite = createSprite('icon-star', SPRITE_RENDERMODE_SIMPLE);
app.on('destroy', () => [panelSprite, shadowSprite, paperSprite, starSprite].forEach((s) => s.destroy()));

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

// The dialog: one sliced sprite, stretched to 400 x 240, over a soft sliced shadow
const shadow = createElement(screen, 'shadow', { sprite: shadowSprite, color: Color.BLACK, width: 448, height: 288 });
const dialog = createElement(screen, 'dialog', { sprite: panelSprite, color: PANEL, width: 400, height: 240 });

// Its title and description, anchored to the top-left corner of the dialog
const topLeft = {
    type: ELEMENTTYPE_TEXT,
    anchor: [0, 1, 0, 1],
    pivot: [0, 1],
    width: 352,
    autoWidth: false,
    alignment: [0, 1]
};
const title = createElement(dialog, 'title', { ...topLeft, fontAsset: assets.bold.id, fontSize: 28 });
const body = createElement(dialog, 'body', { ...topLeft, fontSize: 22, lineHeight: 28, color: MUTED, wrapLines: true });
title.setLocalPosition(24, -22, 0);
body.setLocalPosition(24, -66, 0);

/**
 * Create one of the dialog's buttons, a sliced sprite as well.
 *
 * @param {string} label - The button text.
 * @param {number} x - The horizontal position.
 * @param {Color[]} colors - The color, hover tint and pressed tint of the button.
 * @returns {Entity} The button entity.
 */
const createButton = (label, x, [color, hoverTint, pressedTint]) => {
    const button = createElement(dialog, label, {
        sprite: panelSprite,
        color,
        anchor: [0.5, 0, 0.5, 0],
        pivot: [0.5, 0],
        width: 164,
        height: 52,
        useInput: true
    });
    button.setLocalPosition(x, 22, 0);
    button.addComponent('button', { imageEntity: button, hoverTint, pressedTint });
    createElement(button, 'label', { type: ELEMENTTYPE_TEXT, fontAsset: assets.bold.id, text: label, fontSize: 24 });
    return button;
};
const decline = createButton('Decline', -90, [SLATE, new Color(0.33, 0.37, 0.45), new Color(0.2, 0.22, 0.28)]);
const accept = createButton('Accept', 90, [ORANGE, new Color(1, 0.7, 0.45), new Color(0.8, 0.4, 0.1)]);
accept.findByName('label').element.color = INK;

// A toast, sized to its message: only the middle of the sliced panel grows
const toast = createElement(screen, 'toast', {
    sprite: panelSprite,
    color: PANEL,
    anchor: [0.5, 1, 0.5, 1],
    pivot: [0.5, 1],
    height: 64
});
createElement(toast, 'icon', {
    sprite: starSprite,
    color: ORANGE,
    anchor: [0, 0.5, 0, 0.5],
    width: 32,
    height: 32
}).setLocalPosition(38, 0, 0);
const message = createElement(toast, 'message', {
    type: ELEMENTTYPE_TEXT,
    fontSize: 24,
    anchor: [0, 0.5, 0, 0.5],
    pivot: [0, 0.5]
});
message.setLocalPosition(66, 0, 0);
let toastTime = Infinity;

// The quest log: ruled paper whose tiled middle repeats as the log grows
const log = createElement(screen, 'quest log', {
    sprite: paperSprite,
    color: Color.WHITE,
    pivot: [0.5, 1],
    width: 300,
    height: 96
});
createElement(log, 'heading', {
    type: ELEMENTTYPE_TEXT,
    fontAsset: assets.bold.id,
    text: 'Quest Log',
    fontSize: 26,
    color: INK,
    anchor: [0.5, 1, 0.5, 1],
    pivot: [0.5, 1]
}).setLocalPosition(0, -18, 0);
const entries = [];

// Write a quest in the log, which grows by a line, keeping the last five
const logQuest = (/** @type {string} */ name) => {
    if (entries.length === 5) {
        entries.shift().destroy();
    }
    entries.push(
        createElement(log, name, {
            type: ELEMENTTYPE_TEXT,
            text: `• ${name}`,
            fontSize: 22,
            color: INK,
            anchor: [0, 1, 0, 1],
            pivot: [0, 0.5]
        })
    );
    entries.forEach((entry, i) => entry.setLocalPosition(28, -80 - i * 32, 0));
    log.element.height = 96 + entries.length * 32;
};
logQuest('The Blacksmith’s Hammer');

const quests = [
    ['A Lost Heirloom', 'The innkeeper lost her ring near the old mill. Will you look for it?'],
    ['Wolves at the Gate', 'Wolves prowl the east road. Drive them off before nightfall.'],
    ['The Silent Bell', 'The chapel bell has not rung for a week. Find out why.']
];
let quest = -1;

const nextQuest = () => {
    quest = (quest + 1) % quests.length;
    title.element.text = quests[quest][0];
    body.element.text = quests[quest][1];
};

accept.button.on('click', () => {
    const name = quests[quest][0];
    logQuest(name);

    message.element.text = `Quest accepted: ${name}`;
    toast.element.width = message.element.width + 96;
    toastTime = 0;

    nextQuest();
});
decline.button.on('click', nextQuest);

// Slide the toast down from the top of the screen, and back up after a couple of seconds
app.on('update', (dt) => {
    toastTime += dt;
    const shown = Math.min(toastTime / 0.3, 1, Math.max((2.8 - toastTime) / 0.3, 0));
    toast.setLocalPosition(0, 80 - 104 * (1 - (1 - shown) ** 3), 0);
});

// Side by side on landscape canvases, and stacked on portrait ones
const layout = () => {
    const portrait = device.height > device.width;
    const reference = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
    screen.screen.referenceResolution = reference;
    screen.screen.scaleBlend = device.width / reference.x > device.height / reference.y ? 1 : 0;
    dialog.setLocalPosition(portrait ? 0 : -150, portrait ? 190 : 0, 0);
    shadow.setLocalPosition(dialog.getLocalPosition().x, dialog.getLocalPosition().y - 8, 0);
    log.setLocalPosition(portrait ? 0 : 230, portrait ? 30 : 120, 0);
};
device.on('resizecanvas', layout);
layout();

nextQuest();

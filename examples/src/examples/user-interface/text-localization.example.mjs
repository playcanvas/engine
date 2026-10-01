// @config
//
// A shop card in four languages. Text elements with a localization **key** show the message of
// the current locale. A message with a number picks its plural form with `getPluralText`, the
// price is formatted for the locale, and *Français* asks for fr-CA, which falls back to fr-FR.

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

import localization from './localization.json';

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

// The localization data is already here, so it is added directly rather than loaded
app.i18n.addData(localization);

const ORANGE = new Color(1, 0.55, 0.2);
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

const atlas = assets.ui.resource;
const sprite = (/** @type {string} */ frame) => {
    return new Sprite(device, { atlas, frameKeys: [frame], pixelsPerUnit: 2, renderMode: SPRITE_RENDERMODE_SLICED });
};
const panel = sprite('panel');
const outline = sprite('panel-outline');
const coin = new Sprite(device, { atlas, frameKeys: ['icon-coin'] });
app.on('destroy', () => [panel, outline, coin].forEach((s) => s.destroy()));

/**
 * Create an element centered on its parent.
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

const card = createElement(screen, 'card', {
    sprite: panel,
    color: new Color(0.16, 0.18, 0.23),
    width: 500,
    height: 400
});
card.setLocalPosition(0, 70, 0);
const icon = createElement(card, 'coin', { sprite: coin, color: new Color(1, 0.8, 0.3), width: 64, height: 64 });
icon.setLocalPosition(-190, 50, 0);

// Localized text: each element shows the message of its key, in the current locale
const text = { type: ELEMENTTYPE_TEXT, anchor: [0, 1, 0, 1], pivot: [0, 1] };
const title = createElement(card, 'title', { ...text, fontAsset: assets.bold.id, key: 'title', fontSize: 36 });
const item = createElement(card, 'item', { ...text, fontAsset: assets.bold.id, key: 'item', fontSize: 28 });
const description = createElement(card, 'description', { ...text, key: 'description', fontSize: 22, color: MUTED });
title.setLocalPosition(32, -28, 0);
item.setLocalPosition(112, -110, 0);
description.setLocalPosition(112, -150, 0);

// Text with a number, and the number itself, are formatted in a script
const price = createElement(card, 'price', { ...text, fontAsset: assets.bold.id, fontSize: 26, color: ORANGE });
const purse = createElement(card, 'purse', { type: ELEMENTTYPE_TEXT, fontSize: 24, color: MUTED });
price.setLocalPosition(112, -190, 0);
purse.setLocalPosition(0, -150, 0);

/**
 * Create a button with a text element. The label is either a localization key or a plain text.
 *
 * @param {Entity} parent - The parent entity.
 * @param {object} label - The key or the text of the label.
 * @param {number} width - The width of the button.
 * @param {Color} color - The color of the button.
 * @returns {Entity} The button entity.
 */
const createButton = (parent, label, width, color) => {
    const button = createElement(parent, 'button', { sprite: panel, color, width, height: 60, useInput: true });
    button.addComponent('button', {
        imageEntity: button,
        hoverTint: new Color(color.r * 0.8 + 0.2, color.g * 0.8 + 0.2, color.b * 0.8 + 0.2),
        pressedTint: new Color(color.r * 0.7, color.g * 0.7, color.b * 0.7)
    });
    createElement(button, 'chosen', { sprite: outline, color: ORANGE, anchor: [0, 0, 1, 1], margin: [0, 0, 0, 0] });
    createElement(button, 'label', { type: ELEMENTTYPE_TEXT, fontAsset: assets.bold.id, fontSize: 24, ...label });
    return button;
};

let coins = 1;
const buy = createButton(card, { key: 'buy', color: new Color(0.1, 0.1, 0.1) }, 200, ORANGE);
buy.setLocalPosition(0, -90, 0);
buy.findByName('chosen').enabled = false;

// The locales of the language buttons. There is no data for fr-CA, so it uses fr-FR
const languages = [
    ['English', 'en-US'],
    ['Français', 'fr-CA'],
    ['Español', 'es-ES'],
    ['Polski', 'pl-PL']
].map(([name, locale]) => {
    const button = createButton(screen, { text: name }, 150, new Color(0.2, 0.23, 0.29));
    button.button.on('click', () => {
        app.i18n.locale = locale;
    });
    return { button, locale };
});
const caption = createElement(screen, 'caption', { type: ELEMENTTYPE_TEXT, fontSize: 22, color: MUTED });

// Everything that isn't a localized text element is updated from the locale's change event
const currencies = { 'en-US': 'USD', 'fr-FR': 'EUR', 'es-ES': 'EUR', 'pl-PL': 'PLN' };
const refresh = () => {
    const locale = app.i18n.locale;
    const available = app.i18n.findAvailableLocale(locale);
    purse.element.text = app.i18n.getPluralText('coins', coins).replace('{number}', String(coins));
    price.element.text = new Intl.NumberFormat(locale, { style: 'currency', currency: currencies[available] }).format(
        0.99
    );
    caption.element.text = available === locale ? `Locale ${locale}` : `Locale ${locale}, using ${available}`;
    languages.forEach(({ button, locale: l }) => {
        button.findByName('chosen').enabled = l === locale;
    });
};
app.i18n.on('change', refresh);
refresh();

buy.button.on('click', () => {
    coins++;
    refresh();
});

// The language buttons in a row, on landscape canvases, and two rows on portrait ones
const layout = () => {
    const portrait = device.height > device.width;
    const reference = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
    screen.screen.referenceResolution = reference;
    screen.screen.scaleBlend = device.width / reference.x > device.height / reference.y ? 1 : 0;
    languages.forEach(({ button }, i) => {
        const x = portrait ? ((i % 2) - 0.5) * 170 : (i - 1.5) * 170;
        button.setLocalPosition(x, portrait ? -180 - Math.floor(i / 2) * 76 : -190, 0);
    });
    caption.setLocalPosition(0, portrait ? -350 : -260, 0);
};
device.on('resizecanvas', layout);
layout();

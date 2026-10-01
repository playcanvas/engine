// @config
//
// A game's settings, built from the common widgets: a **slider** made from a scrollbar, a
// **toggle** and a **radio group** made from buttons, a **progress bar** whose fill follows its
// anchor, and a **modal dialog** that asks before the settings are reset.

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
    FontHandler,
    Mouse,
    ORIENTATION_HORIZONTAL,
    RESOLUTION_AUTO,
    SCALEMODE_BLEND,
    SPRITE_RENDERMODE_SLICED,
    ScreenComponentSystem,
    ScrollbarComponentSystem,
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

const assets = {
    font: new Asset('font', 'font', { url: './assets/fonts/roboto-regular.json' }),
    bold: new Asset('bold', 'font', { url: './assets/fonts/roboto-bold.json' }),
    ui: new Asset('ui', 'textureatlas', { url: './assets/ui/ui-atlas.png' }, uiAtlasData)
};

const device = await createGraphicsDevice(canvas, { deviceTypes: [deviceType] });
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

// Dragging the slider with the mouse needs a mouse device, created after the element input
const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.elementInput = new ElementInput(canvas);
createOptions.mouse = new Mouse(canvas);
createOptions.componentSystems = [
    CameraComponentSystem,
    ScreenComponentSystem,
    ElementComponentSystem,
    ButtonComponentSystem,
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
const DARK = new Color(0.1, 0.11, 0.14);
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
const sliced = (/** @type {string} */ frame, /** @type {number} */ pixelsPerUnit) => {
    return new Sprite(device, { atlas, frameKeys: [frame], pixelsPerUnit, renderMode: SPRITE_RENDERMODE_SLICED });
};
const panel = sliced('panel', 2);
const track = sliced('track', 2);
const parts = new Sprite(device, { atlas, frameKeys: ['knob', 'checkbox', 'check', 'radio', 'radio-dot'] });
app.on('destroy', () => [panel, track, parts].forEach((sprite) => sprite.destroy()));

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
        fontAsset: assets.font.id,
        color: LIGHT,
        ...properties
    });
    parent.addChild(entity);
    return entity;
};
const left = { anchor: [0, 0.5, 0, 0.5], pivot: [0, 0.5] };
const right = { anchor: [1, 0.5, 1, 0.5], pivot: [1, 0.5] };
const stretch = { anchor: [0, 0, 1, 1], margin: [0, 0, 0, 0] };
const bold = { type: ELEMENTTYPE_TEXT, fontAsset: assets.bold.id };

// The settings panel, and its rows. Each row has its label anchored to its left edge and its
// widget to its right edge, so both follow the row's width, which follows the panel's
const settings = createElement(screen, 'settings', { sprite: panel, color: PANEL, width: 640, height: 580 });
createElement(settings, 'title', { ...bold, text: 'Settings', fontSize: 40 }).setLocalPosition(0, 236, 0);
const rows = [];
const row = (/** @type {string} */ name, /** @type {number} */ y) => {
    const entity = createElement(settings, name, { type: ELEMENTTYPE_GROUP, height: 60 });
    entity.setLocalPosition(0, y, 0);
    createElement(entity, 'label', { ...left, type: ELEMENTTYPE_TEXT, text: name, fontSize: 28 });
    rows.push(entity);
    return entity;
};

// A slider: a scrollbar whose handle is smaller than its track. Its value goes from 0 to 1
const volumeRow = row('Volume', 150);
const volume = createElement(volumeRow, 'volume', { ...right, sprite: track, color: DARK, height: 20 });
volume.setLocalPosition(-80, 0, 0);
const handle = createElement(volume, 'handle', { ...left, sprite: parts, spriteFrame: 0, height: 36, useInput: true });
volume.addComponent('scrollbar', { orientation: ORIENTATION_HORIZONTAL, handleEntity: handle });
const percent = createElement(volumeRow, 'percent', { ...right, type: ELEMENTTYPE_TEXT, fontSize: 26, color: MUTED });
volume.scrollbar.on('set:value', (value) => {
    percent.element.text = `${Math.round(value * 100)}%`;
});

/**
 * Create a button whose look shows its state: a box or a ring, and a mark in it while it is on.
 *
 * @param {Entity} parent - The parent entity.
 * @param {string} name - The entity name.
 * @param {number} frame - The frame of the box or ring. The mark is the next frame.
 * @param {object} [placement] - The anchor and pivot, if not centered.
 * @returns {Entity} The button entity.
 */
const createCheck = (parent, name, frame, placement) => {
    const box = { sprite: parts, spriteFrame: frame, color: MUTED, width: 40, height: 40, useInput: true };
    const button = createElement(parent, name, { ...box, ...placement });
    button.addComponent('button', { imageEntity: button, hoverTint: LIGHT, pressedTint: MUTED });
    createElement(button, 'check', { sprite: parts, spriteFrame: frame + 1, color: ORANGE, width: 40, height: 40 });
    return button;
};

// A toggle: a button whose check shows while music is on
let musicOn = true;
const musicToggle = createCheck(row('Music', 70), 'music toggle', 1, right);
musicToggle.button.on('click', () => {
    musicOn = !musicOn;
    musicToggle.findByName('check').enabled = musicOn;
});

// A radio group: a group element of such buttons, of which only one is on at a time. It is under
// its label, so that it fits narrow panels too
const difficulty = createElement(row('Difficulty', 10), 'difficulty', { ...left, type: ELEMENTTYPE_GROUP, width: 0 });
difficulty.setLocalPosition(0, -56, 0);
['Easy', 'Normal', 'Hard'].forEach((name, i) => {
    const option = createCheck(difficulty, name, 3);
    option.setLocalPosition(20 + i * 150, 0, 0);
    createElement(option, 'name', { ...left, type: ELEMENTTYPE_TEXT, text: name, fontSize: 24 }).setLocalPosition(
        48,
        0,
        0
    );
});
const options = difficulty.children;
for (const option of options) {
    option.button.on('click', () => {
        for (const other of options) {
            other.findByName('check').enabled = other === option;
        }
    });
}

// A progress bar: the fill's right anchor follows the value, so it takes that share of the track,
// and the track keeps a border inside the bar
const bar = createElement(row('Update 1.2', -126), 'bar', { ...right, sprite: track, color: DARK, height: 30 });
const fillTrack = createElement(bar, 'track', { ...stretch, type: ELEMENTTYPE_GROUP, margin: [4, 4, 4, 4] });
const fill = createElement(fillTrack, 'fill', { ...stretch, sprite: track, color: ORANGE });
const setProgress = (/** @type {number} */ value) => {
    fill.element.anchor = new Vec4(0, 0, value, 1);
};

// The dialog covers the rest of the screen, and is last in the hierarchy, so it is drawn on top
// and receives input first. Its backdrop catches every press that misses the panel
const dialog = createElement(screen, 'dialog', { ...stretch, type: ELEMENTTYPE_GROUP });
const backdrop = createElement(dialog, 'backdrop', {
    ...stretch,
    color: new Color(0, 0, 0),
    opacity: 0.6,
    useInput: true
});
const box = createElement(dialog, 'panel', { sprite: panel, color: PANEL, width: 440, height: 240, useInput: true });
createElement(box, 'question', { ...bold, text: 'Reset all settings?', fontSize: 32 }).setLocalPosition(0, 50, 0);

/**
 * Create a button with a label.
 *
 * @param {Entity} parent - The parent entity.
 * @param {string} text - The label.
 * @param {Color} color - The color of the button.
 * @param {number} x - The horizontal position.
 * @param {number} y - The vertical position.
 * @returns {Entity} The button entity.
 */
const createButton = (parent, text, color, x, y) => {
    const button = createElement(parent, text, { sprite: panel, color, width: 180, height: 64, useInput: true });
    button.setLocalPosition(x, y, 0);
    button.addComponent('button', {
        imageEntity: button,
        hoverTint: new Color(color.r * 0.8 + 0.2, color.g * 0.8 + 0.2, color.b * 0.8 + 0.2),
        pressedTint: new Color(color.r * 0.7, color.g * 0.7, color.b * 0.7)
    });
    createElement(button, 'label', { ...bold, text, fontSize: 26, color: color === ORANGE ? DARK : LIGHT });
    return button;
};
const SLATE = new Color(0.26, 0.29, 0.36);
const reset = createButton(settings, 'Reset', SLATE, 0, -220);
const cancel = createButton(box, 'Cancel', SLATE, -100, -50);
const confirm = createButton(box, 'Reset all', ORANGE, 100, -50);

// Put everything back as it was at the start: volume 80%, music on, and Normal difficulty
const applyDefaults = () => {
    volume.scrollbar.value = 0.8;
    musicOn = true;
    musicToggle.findByName('check').enabled = true;
    options.forEach((option, i) => {
        option.findByName('check').enabled = i === 1;
    });
};

const openDialog = () => {
    dialog.enabled = true;
};
const closeDialog = () => {
    dialog.enabled = false;
};
reset.button.on('click', openDialog);
cancel.button.on('click', closeDialog);
backdrop.element.on('click', closeDialog);
confirm.button.on('click', () => {
    applyDefaults();
    closeDialog();
});
closeDialog();

// After a tap, the browser sends emulated mouse events. A tap that closes the dialog would have
// its emulated click land on whatever is behind the button, so cancel touchend to stop them
const cancelEmulation = (/** @type {TouchEvent} */ event) => event.preventDefault();
canvas.addEventListener('touchend', cancelEmulation);
app.on('destroy', () => canvas.removeEventListener('touchend', cancelEmulation));

// An update downloads over six seconds, and starts again two seconds later
let time = 3;
app.on('update', (dt) => {
    time = (time + dt) % 8;
    setProgress(Math.min(time / 6, 1));
});

// A narrower panel on portrait canvases, which the rows follow. The slider's handle is a fraction
// of its track, so it is set for each length to keep the knob round
const layout = () => {
    const portrait = device.height > device.width;
    const reference = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
    screen.screen.referenceResolution = reference;
    screen.screen.scaleBlend = device.width / reference.x > device.height / reference.y ? 1 : 0;
    settings.element.width = portrait ? 490 : 640;
    for (const entity of rows) {
        entity.element.width = settings.element.width - 80;
    }
    volume.element.width = portrait ? 180 : 280;
    volume.scrollbar.handleSize = 36 / volume.element.width;
    bar.element.width = portrait ? 220 : 300;
};
device.on('resizecanvas', layout);
layout();
applyDefaults();

// @config
//
// An in-game chat window laid out with **anchors**. Its title bar, message log and input row are
// anchored to its edges, so they follow the window as it changes size, and the score keeps to the
// corner of the screen. Drag the grip in the window's corner to resize it, and send a message.

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
    createGraphicsDevice,
    math
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

const LIGHT = new Color(0.95, 0.96, 0.98);
const MUTED = new Color(0.6, 0.64, 0.72);
const DARK = new Color(0.1, 0.11, 0.14);

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
const icons = new Sprite(device, { atlas, frameKeys: ['icon-next', 'icon-grip'] });
app.on('destroy', () => [panel, icons].forEach((sprite) => sprite.destroy()));

/**
 * Create an element. Without an anchor and a pivot, an element is attached to the bottom-left
 * corner of its parent, so pass both.
 *
 * @param {Entity} parent - The parent entity.
 * @param {string} name - The entity name.
 * @param {object} properties - Properties of the element component.
 * @returns {Entity} The entity.
 */
const createElement = (parent, name, properties) => {
    const entity = new Entity(name);
    entity.addComponent('element', { type: ELEMENTTYPE_IMAGE, fontAsset: assets.font.id, color: LIGHT, ...properties });
    parent.addChild(entity);
    return entity;
};

// The game behind the interface: a picture that covers the whole screen, whatever its shape
createElement(screen, 'game', {
    texture: assets.landscape.resource,
    fitMode: FITMODE_COVER,
    anchor: [0, 0, 1, 1],
    margin: [0, 0, 0, 0]
});

// The score sits in the top-right corner of the screen, 20 units in from each edge
const score = createElement(screen, 'score', {
    type: ELEMENTTYPE_TEXT,
    fontAsset: assets.bold.id,
    text: '1250',
    fontSize: 48,
    anchor: [1, 1, 1, 1],
    pivot: [1, 1]
});
score.setLocalPosition(-20, -20, 0);

// The chat window hangs from its top-left corner, so it grows to the right and downwards
const chat = createElement(screen, 'chat', {
    sprite: panel,
    color: new Color(0.16, 0.18, 0.23),
    anchor: [0, 1, 0, 1],
    pivot: [0, 1],
    width: 460,
    height: 380
});

// The title bar is split across the top of the window, so its width follows the window's. Its
// title is anchored to its left end, and the number of players online to its right end
const bar = createElement(chat, 'title bar', { sprite: panel, color: DARK, anchor: [0, 1, 1, 1], pivot: [0.5, 1] });
bar.element.left = 0;
bar.element.right = 0;
bar.element.height = 56;
createElement(bar, 'title', {
    type: ELEMENTTYPE_TEXT,
    fontAsset: assets.bold.id,
    text: 'Party chat',
    fontSize: 26,
    anchor: [0, 0.5, 0, 0.5],
    pivot: [0, 0.5]
}).setLocalPosition(20, 0, 0);
createElement(bar, 'online', {
    type: ELEMENTTYPE_TEXT,
    text: '3 online',
    fontSize: 22,
    color: MUTED,
    anchor: [1, 0.5, 1, 0.5],
    pivot: [1, 0.5]
}).setLocalPosition(-20, 0, 0);

// The messages fill the window apart from a 20 unit margin, and leave room for the title bar and
// the input row. The log wraps to the width of the area, and the area, a mask, crops old lines
const area = createElement(chat, 'messages', {
    sprite: panel,
    anchor: [0, 0, 1, 1],
    margin: [20, 76, 20, 76],
    mask: true
});
createElement(area, 'background', { sprite: panel, color: DARK, anchor: [0, 0, 1, 1], margin: [0, 0, 0, 0] });
const log = createElement(area, 'log', {
    type: ELEMENTTYPE_TEXT,
    fontSize: 22,
    lineHeight: 30,
    anchor: [0, 0, 1, 1],
    margin: [14, 12, 14, 12],
    alignment: [0, 0],
    wrapLines: true,
    enableMarkup: true,
    text: [
        '[color="#7fc8ff"]Aria:[/color] Anyone up for the crypt run tonight?',
        '[color="#ffb37a"]Brom:[/color] Only if someone else carries the torches this time.',
        '[color="#9ae08a"]Cai:[/color] Meet at the gate in five. Bring potions!'
    ].join('\n')
});

// The input bar is split across the bottom of the window, like the title bar across its top. Its
// send button is anchored to its right end, next to the grip in the window's corner
const input = createElement(chat, 'input', { sprite: panel, color: DARK, anchor: [0, 0, 1, 0], pivot: [0.5, 0] });
input.element.left = 0;
input.element.right = 0;
input.element.height = 56;
const placeholder = createElement(input, 'placeholder', {
    type: ELEMENTTYPE_TEXT,
    text: 'Say something…',
    fontSize: 22,
    color: MUTED,
    anchor: [0, 0.5, 0, 0.5],
    pivot: [0, 0.5]
});
placeholder.setLocalPosition(20, 0, 0);
const send = createElement(input, 'send', {
    sprite: icons,
    spriteFrame: 0,
    color: new Color(1, 0.55, 0.2),
    anchor: [1, 0.5, 1, 0.5],
    pivot: [1, 0.5],
    width: 36,
    height: 36,
    useInput: true
});
send.setLocalPosition(-52, 0, 0);
send.addComponent('button', { imageEntity: send, hitPadding: [12, 12, 12, 12], hoverTint: new Color(1, 0.7, 0.45) });

const replies = ['On my way!', 'Wait for me at the bridge.', 'I have the torches, promise.'];
send.button.on('click', () => {
    log.element.text += `\n[color="#ffcc00"]You:[/color] ${replies[0]}`;
    replies.push(replies.shift());
});

// The grip is anchored to the window's bottom-right corner. Dragging it resizes the window: once a
// press starts on an element, that element receives the moves until the press ends
const grip = createElement(chat, 'grip', {
    sprite: icons,
    spriteFrame: 1,
    color: MUTED,
    anchor: [1, 0, 1, 0],
    pivot: [1, 0],
    width: 40,
    height: 40,
    useInput: true
});
// The window's size is limited by the screen's reference resolution, so that it stays on the screen
const resizeChat = (/** @type {number} */ width, /** @type {number} */ height) => {
    const { x, y } = screen.screen.referenceResolution;
    chat.element.width = math.clamp(width, 340, x - 80);
    chat.element.height = math.clamp(height, 280, y - 150);
};
let drag = null;
const press = (/** @type {{ x: number, y: number }} */ event) => {
    drag = { x: event.x, y: event.y, width: chat.element.width, height: chat.element.height };
};
const move = (/** @type {{ x: number, y: number }} */ event) => {
    if (drag) {
        // Events give the pointer in CSS pixels from the canvas's top-left corner. Convert the
        // distance it moved to screen units
        const units = canvas.width / canvas.clientWidth / screen.screen.scale;
        resizeChat(drag.width + (event.x - drag.x) * units, drag.height + (event.y - drag.y) * units);
    }
};
const release = () => {
    drag = null;
};
['mousedown', 'touchstart'].forEach((name) => grip.element.on(name, press));
['mousemove', 'touchmove'].forEach((name) => grip.element.on(name, move));
['mouseup', 'touchend', 'touchcancel'].forEach((name) => grip.element.on(name, release));

// Use a portrait reference resolution on portrait canvases, where the window sits below the score.
// A window sized in the other orientation can be too big for this one, so clamp its size again
const layout = () => {
    const portrait = device.height > device.width;
    const reference = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
    screen.screen.referenceResolution = reference;
    screen.screen.scaleBlend = device.width / reference.x > device.height / reference.y ? 1 : 0;
    resizeChat(chat.element.width, chat.element.height);
    chat.setLocalPosition(40, portrait ? -110 : -40, 0);
};
device.on('resizecanvas', layout);
layout();

// @config
//
// A party chat with emoji. A font asset holds one color per glyph, so the messages use a
// **CanvasFont**, which draws characters with the browser's fonts into textures, emoji included.
// Characters it hasn't drawn yet are added with `updateTextures`: try the reactions.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    ButtonComponentSystem,
    CameraComponentSystem,
    CanvasFont,
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

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
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

// The font of the messages. It is a bitmap font, so it is created at least as large as the text
// drawn with it, and the characters it needs are drawn into its textures before they are used
const emojiFont = new CanvasFont(app, {
    fontName: 'Arial',
    fontSize: 64,
    color: new Color(1, 1, 1),
    width: 256,
    height: 256
});
const messages = [
    ['Aria', 'Well done! 🎉'],
    ['Brom', 'That troll was huge 😱'],
    ['Cai', 'GG everyone 👏🔥']
];
emojiFont.createTextures(messages.map(([, text]) => text).join(''));
app.on('destroy', () => emojiFont.destroy());

const atlas = assets.ui.resource;
const panel = new Sprite(device, {
    atlas,
    frameKeys: ['panel'],
    pixelsPerUnit: 2,
    renderMode: SPRITE_RENDERMODE_SLICED
});
const circle = new Sprite(device, { atlas, frameKeys: ['circle'] });
app.on('destroy', () => [panel, circle].forEach((sprite) => sprite.destroy()));

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
        ...properties
    });
    parent.addChild(entity);
    return entity;
};

const chat = createElement(screen, 'chat', {
    sprite: panel,
    color: new Color(0.16, 0.18, 0.23),
    width: 560,
    height: 440
});
chat.setLocalPosition(0, 40, 0);
createElement(chat, 'heading', {
    type: ELEMENTTYPE_TEXT,
    fontAsset: assets.bold.id,
    text: 'Party chat',
    fontSize: 26,
    color: new Color(0.6, 0.64, 0.72),
    anchor: [0, 1, 0, 1],
    pivot: [0, 1]
}).setLocalPosition(28, -24, 0);

const colors = { Aria: [0.5, 0.78, 1], Brom: [1, 0.6, 0.4], Cai: [0.6, 0.9, 0.5], You: [1, 0.8, 0.3] };
const lines = [];

/**
 * Post a message: the sender's name in the font asset, and the message in the canvas font.
 *
 * @param {string} name - The sender.
 * @param {string} text - The message.
 */
const post = (name, text) => {
    const line = createElement(chat, `${name}: ${text}`, {
        type: ELEMENTTYPE_TEXT,
        anchor: [0, 1, 0, 1],
        pivot: [0, 1]
    });
    line.element.font = emojiFont;
    line.element.fontSize = 32;
    line.element.text = text;
    const sender = createElement(line, 'name', {
        type: ELEMENTTYPE_TEXT,
        fontAsset: assets.bold.id,
        text: name,
        fontSize: 22,
        color: new Color(...colors[name]),
        anchor: [0, 1, 0, 1],
        pivot: [0, 0]
    });
    sender.setLocalPosition(0, 4, 0);

    // keep the four latest messages
    lines.push(line);
    if (lines.length > 4) {
        lines.shift().destroy();
    }
    lines.forEach((l, i) => l.setLocalPosition(28, -100 - i * 80, 0));
};
messages.forEach(([name, text]) => post(name, text));

// Reactions post an emoji. They aren't in the messages above, so they are drawn into the font's
// textures with updateTextures before the buttons use them
const reactions = ['👍', '❤️', '😂', '🦄'];
emojiFont.updateTextures(reactions.join(''));
reactions.forEach((emoji, i) => {
    const button = createElement(screen, emoji, {
        sprite: circle,
        color: new Color(0.2, 0.23, 0.29),
        width: 76,
        height: 76,
        useInput: true
    });
    button.setLocalPosition((i - 1.5) * 96, -250, 0);
    button.addComponent('button', {
        imageEntity: button,
        hoverTint: new Color(0.28, 0.32, 0.4),
        pressedTint: new Color(0.14, 0.16, 0.2)
    });
    const label = createElement(button, 'emoji', { type: ELEMENTTYPE_TEXT, text: emoji });
    label.element.font = emojiFont;
    label.element.fontSize = 38;
    label.element.text = emoji;
    button.button.on('click', () => post('You', emoji));
});

// Use a portrait reference resolution on portrait canvases, and scale to whichever axis has
// less room, so the chat stays on screen
const layout = () => {
    const portrait = device.height > device.width;
    const reference = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
    screen.screen.referenceResolution = reference;
    screen.screen.scaleBlend = device.width / reference.x > device.height / reference.y ? 1 : 0;
    chat.element.width = portrait ? 500 : 560;
};
device.on('resizecanvas', layout);
layout();

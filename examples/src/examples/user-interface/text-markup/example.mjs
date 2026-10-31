// @config
//
// An adventure log whose lines are styled with **markup** tags: colored names and loot, outlined
// damage numbers and a shadowed critical hit. `\[` writes a bracket that doesn't start a tag, and
// a line with a tag that is never closed is drawn as written.

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
    ui: new Asset('ui', 'textureatlas', { url: './assets/ui/ui-atlas.png' }, uiAtlasData)
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

const LIGHT = new Color(0.9, 0.92, 0.95);
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

const log = new Entity('log');
log.addComponent('element', {
    type: ELEMENTTYPE_IMAGE,
    sprite: new Sprite(device, {
        atlas: assets.ui.resource,
        frameKeys: ['panel'],
        pixelsPerUnit: 2,
        renderMode: SPRITE_RENDERMODE_SLICED
    }),
    color: new Color(0.14, 0.16, 0.2),
    anchor: [0.5, 0.5, 0.5, 0.5],
    pivot: [0.5, 0.5]
});
screen.addChild(log);
app.on('destroy', () => log.element.sprite.destroy());

const entries = [];

/**
 * Add a line to the log. Lines wrap at the width of the log, and are stacked by `layout`.
 *
 * @param {string} name - The entity name.
 * @param {object} properties - Properties of the text element.
 */
const addLine = (name, properties) => {
    const line = new Entity(name);
    line.addComponent('element', {
        type: ELEMENTTYPE_TEXT,
        fontAsset: assets.font.id,
        fontSize: 26,
        lineHeight: 34,
        color: LIGHT,
        anchor: [0, 1, 0, 1],
        pivot: [0, 1],
        autoWidth: false,
        wrapLines: true,
        alignment: [0, 1],
        ...properties
    });
    log.addChild(line);
    entries.push(line);
};

addLine('heading', { fontAsset: assets.bold.id, text: 'Adventure Log', fontSize: 30, color: new Color(1, 0.55, 0.2) });

// Each line turns markup on. A tag styles the text up to its closing tag, and tags can be nested
[
    '[color="#9aa3b5"]You enter the Sunken Crypt.[/color]',
    'You found the [color="#ffcc00"]golden key[/color]!',
    '[color="#7fc8ff"]Aria[/color] hits the [color="#ff7a6e"]Cave Troll[/color] for ' +
        '[outline color="#c43c2c" thickness="0.8"]42[/outline] damage.',
    '[shadow color="#8a3000" offset="0.6"][color="#ffb347"]Critical hit![/color][/shadow] ' +
        'The [color="#ff7a6e"]Cave Troll[/color] is defeated.',
    '[color="#7fc8ff"]Brom[/color]: back in five, I am \\[AFK]'
].forEach((text, i) => addLine(`line ${i}`, { text, enableMarkup: true }));

// A tag that is never closed is a markup error: the engine logs a warning and draws the whole
// line as written, tags included
addLine('broken line', { text: '[color="#88e088"]Quest complete: Wolves at the Gate', enableMarkup: true });
addLine('note', {
    text: 'The line above never closes its color tag, so it is drawn as written.',
    fontSize: 20,
    color: MUTED
});

// A wide log on landscape canvases and a narrow one on portrait canvases. The lines wrap at its
// width, and are stacked one below the other by their heights
const layout = () => {
    const portrait = device.height > device.width;
    const reference = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
    screen.screen.referenceResolution = reference;
    screen.screen.scaleBlend = device.width / reference.x > device.height / reference.y ? 1 : 0;

    const width = portrait ? 500 : 820;
    let y = 26;
    for (const line of entries) {
        line.element.width = width - 64;
        line.setLocalPosition(32, -y, 0);
        y += line.element.height + 12;
    }
    log.element.width = width;
    log.element.height = y + 14;
};
device.on('resizecanvas', layout);
layout();

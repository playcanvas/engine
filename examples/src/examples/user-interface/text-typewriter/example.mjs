// @config
//
// An NPC's dialog box that reveals each line letter by letter. Changing a text element's
// **rangeEnd** draws part of its text without laying it out again. Tap the box to finish a line,
// and again to read the next one.

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
createOptions.elementInput = new ElementInput(canvas);
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
const portrait = new Sprite(device, { atlas, frameKeys: ['avatar-3'] });
const arrow = new Sprite(device, { atlas, frameKeys: ['icon-down'] });
app.on('destroy', () => [panel, portrait, arrow].forEach((sprite) => sprite.destroy()));

// The scene behind the dialog: a picture that covers the screen, whatever its shape
const backdrop = new Entity('backdrop');
backdrop.addComponent('element', {
    type: ELEMENTTYPE_IMAGE,
    textureAsset: assets.landscape.id,
    fitMode: FITMODE_COVER,
    color: new Color(0.7, 0.7, 0.7),
    anchor: [0, 0, 1, 1],
    margin: [0, 0, 0, 0]
});
screen.addChild(backdrop);

// The dialog box, at the bottom of the screen. It receives input, so it can be tapped
const box = new Entity('dialog box');
box.addComponent('element', {
    type: ELEMENTTYPE_IMAGE,
    sprite: panel,
    color: new Color(0.16, 0.18, 0.23),
    anchor: [0.5, 0, 0.5, 0],
    pivot: [0.5, 0],
    useInput: true
});
screen.addChild(box);

/**
 * Create an element in the dialog box.
 *
 * @param {string} name - The entity name.
 * @param {object} properties - Properties of the element component.
 * @returns {Entity} The entity.
 */
const createElement = (name, properties) => {
    const entity = new Entity(name);
    entity.addComponent('element', { fontAsset: assets.font.id, ...properties });
    box.addChild(entity);
    return entity;
};

const face = createElement('portrait', {
    type: ELEMENTTYPE_IMAGE,
    sprite: portrait,
    anchor: [0, 0.5, 0, 0.5],
    pivot: [0, 0.5],
    width: 130,
    height: 130
});
face.setLocalPosition(32, 0, 0);
const speaker = createElement('speaker', {
    type: ELEMENTTYPE_TEXT,
    fontAsset: assets.bold.id,
    text: 'Old Man',
    fontSize: 28,
    color: new Color(1, 0.55, 0.2),
    anchor: [0, 1, 0, 1],
    pivot: [0, 1]
});

// The line being read: it wraps within its width, and grows downwards from its top edge
const dialog = createElement('dialog', {
    type: ELEMENTTYPE_TEXT,
    fontSize: 30,
    lineHeight: 40,
    color: new Color(0.95, 0.96, 0.98),
    anchor: [0, 1, 0, 1],
    pivot: [0, 1],
    autoWidth: false,
    wrapLines: true,
    alignment: [0, 1]
});

// Shown when a line has been read to the end
const more = createElement('more', {
    type: ELEMENTTYPE_IMAGE,
    sprite: arrow,
    color: new Color(1, 0.55, 0.2),
    anchor: [1, 0, 1, 0],
    pivot: [1, 0],
    width: 32,
    height: 32
});

const lines = [
    'It is dangerous to go alone.',
    'Take this sword. It served me well for many years, and I have no more need of it.',
    'The cave to the north is full of bats. Keep your torch lit, and do not run.'
];
let line = -1;
let length = 0;
let shown = 0;

// Show the next line. Changing the text resets the range to the whole of the new text, which
// gives its length, and the reveal starts again from nothing
const nextLine = () => {
    line = (line + 1) % lines.length;
    dialog.element.text = lines[line];
    length = dialog.element.rangeEnd;
    shown = 0;
    dialog.element.rangeEnd = 0;
    more.enabled = false;
};

// A tap finishes the line, or moves on to the next one once it is finished
box.element.on('click', () => {
    if (shown < length) {
        shown = length;
    } else {
        nextLine();
    }
});

// Reveal 20 characters a second, and bob the arrow once the line is finished
let time = 0;
app.on('update', (dt) => {
    time += dt;
    shown = Math.min(shown + dt * 20, length);
    dialog.element.rangeEnd = Math.floor(shown);
    more.enabled = shown === length;
    more.setLocalPosition(-28, 22 + Math.abs(Math.sin(time * 5)) * 8, 0);
});

// The box spans most of a landscape canvas. Portrait canvases get a compact box without the
// portrait, which leaves room for the text
const layout = () => {
    const portrait = device.height > device.width;
    const reference = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
    screen.screen.referenceResolution = reference;
    screen.screen.scaleBlend = device.width / reference.x > device.height / reference.y ? 1 : 0;
    box.setLocalPosition(0, 40, 0);
    box.element.width = portrait ? 500 : 900;
    box.element.height = portrait ? 250 : 210;
    face.enabled = !portrait;
    const left = portrait ? 28 : 190;
    speaker.setLocalPosition(left, -26, 0);
    dialog.setLocalPosition(left, -66, 0);
    dialog.element.width = portrait ? 444 : 650;
};
device.on('resizecanvas', layout);
layout();

nextLine();

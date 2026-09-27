// @config
//
// A page of a codex with reader settings. **Justify** stretches every wrapped line to both edges
// of the text element by widening the gaps between its words, and **alignment** places the lines
// that aren't stretched, including the last one. Try the buttons above the page.

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
const INK = new Color(0.22, 0.18, 0.14);
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
const sprite = (/** @type {string} */ frame) => {
    return new Sprite(device, { atlas, frameKeys: [frame], pixelsPerUnit: 2, renderMode: SPRITE_RENDERMODE_SLICED });
};
const panel = sprite('panel');
const outline = sprite('panel-outline');
app.on('destroy', () => [panel, outline].forEach((s) => s.destroy()));

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
        ...properties
    });
    parent.addChild(entity);
    return entity;
};

// The page, and its chapter heading
const page = createElement(screen, 'page', { sprite: panel, color: new Color(0.96, 0.92, 0.84) });
createElement(page, 'heading', {
    type: ELEMENTTYPE_TEXT,
    fontAsset: assets.bold.id,
    text: 'The Fall of Eldermere',
    fontSize: 34,
    color: INK,
    anchor: [0.5, 1, 0.5, 1],
    pivot: [0.5, 1]
}).setLocalPosition(0, -34, 0);

// The chapter. Wrapping needs a width to wrap at, so auto width is off, and the text is kept at
// the top of the element, so that it doesn't move as the number of lines changes
const chapter = createElement(page, 'chapter', {
    type: ELEMENTTYPE_TEXT,
    text:
        'For three hundred years the towers of Eldermere watched over the valley, and no army ' +
        'reached its walls. Then came the winter the river froze, when the mountain clans ' +
        'crossed the ice by night. By morning the gates had fallen, and the great library burned ' +
        'for nine days. Of its scholars, only one escaped, carrying the last of the star charts.',
    fontSize: 24,
    lineHeight: 34,
    color: INK,
    autoWidth: false,
    autoHeight: false,
    wrapLines: true,
    justify: true,
    alignment: [0, 1],
    anchor: [0.5, 1, 0.5, 1],
    pivot: [0.5, 1]
});
chapter.setLocalPosition(0, -96, 0);

/**
 * Create a button of the settings bar, whose outline shows when its setting is chosen.
 *
 * @param {string} text - The label.
 * @returns {Entity} The button entity.
 */
const createButton = (text) => {
    const button = createElement(screen, text, {
        sprite: panel,
        color: new Color(0.2, 0.23, 0.29),
        height: 60,
        useInput: true
    });
    button.addComponent('button', {
        imageEntity: button,
        hoverTint: new Color(0.27, 0.31, 0.39),
        pressedTint: new Color(0.15, 0.17, 0.22)
    });
    createElement(button, 'chosen', { sprite: outline, color: ORANGE, anchor: [0, 0, 1, 1], margin: [0, 0, 0, 0] });
    createElement(button, 'label', { type: ELEMENTTYPE_TEXT, fontAsset: assets.bold.id, text, fontSize: 24 });
    return button;
};

const justify = createButton('Justify');
const alignments = [
    ['Left', 0],
    ['Center', 0.5],
    ['Right', 1]
].map(([text, x]) => ({ button: createButton(String(text)), x: Number(x) }));
const bar = [justify, ...alignments.map(({ button }) => button)];

// Apply the settings to the chapter, and show which are chosen
const settings = { justify: true, alignment: 0 };
const apply = () => {
    chapter.element.justify = settings.justify;
    chapter.element.alignment = new Vec2(settings.alignment, 1);

    const show = (/** @type {Entity} */ button, /** @type {boolean} */ chosen) => {
        button.findByName('chosen').enabled = chosen;
        button.findByName('label').element.color = chosen ? ORANGE : LIGHT;
    };
    show(justify, settings.justify);
    alignments.forEach(({ button, x }) => show(button, x === settings.alignment));
};

justify.button.on('click', () => {
    settings.justify = !settings.justify;
    apply();
});
alignments.forEach(({ button, x }) => {
    button.button.on('click', () => {
        settings.alignment = x;
        apply();
    });
});
apply();

// A wide page on landscape canvases, and a narrow one on portrait canvases, where the lines
// hold fewer words and the gaps that justifying widens are larger
const layout = () => {
    const portrait = device.height > device.width;
    const reference = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
    screen.screen.referenceResolution = reference;
    screen.screen.scaleBlend = device.width / reference.x > device.height / reference.y ? 1 : 0;

    page.element.width = portrait ? 500 : 680;
    page.element.height = portrait ? 430 : 380;
    page.setLocalPosition(0, portrait ? -40 : -30, 0);
    chapter.element.width = portrait ? 440 : 600;
    chapter.element.height = portrait ? 320 : 260;
    bar.forEach((button, i) => {
        button.element.width = portrait ? 112 : 150;
        button.setLocalPosition((i - 1.5) * (portrait ? 120 : 170), portrait ? 330 : 260, 0);
    });
};
device.on('resizecanvas', layout);
layout();

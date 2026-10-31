// @config
//
// A game's main menu built from **button** components. *Play* and *Continue* tint as they are
// hovered and pressed, and *Continue* stays inactive until there is a game to continue.
// *Options* and *Credits* show sprite frames instead, and the close button has a larger hit area.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BUTTON_TRANSITION_MODE_SPRITE_CHANGE,
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
const INK = new Color(0.1, 0.1, 0.1);
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

// Use a portrait reference resolution on portrait canvases, and scale to whichever axis has
// less room, so the whole menu stays on screen
const layout = () => {
    const portrait = device.height > device.width;
    const reference = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
    screen.screen.referenceResolution = reference;
    screen.screen.scaleBlend = device.width / reference.x > device.height / reference.y ? 1 : 0;
};
device.on('resizecanvas', layout);
layout();

// Sliced sprites from the UI kit. The atlas is drawn at 2 pixels per screen unit
const atlas = assets.ui.resource;
const rounded = new Sprite(device, {
    atlas,
    frameKeys: ['panel'],
    pixelsPerUnit: 2,
    renderMode: SPRITE_RENDERMODE_SLICED
});
// One sprite with a frame for each state of a sprite change button
const states = new Sprite(device, {
    atlas,
    frameKeys: ['button', 'button-hover', 'button-pressed', 'button-inactive'],
    pixelsPerUnit: 2,
    renderMode: SPRITE_RENDERMODE_SLICED
});
const cross = new Sprite(device, { atlas, frameKeys: ['icon-close'] });
app.on('destroy', () => [rounded, states, cross].forEach((sprite) => sprite.destroy()));

const title = new Entity('title');
title.addComponent('element', {
    type: ELEMENTTYPE_TEXT,
    fontAsset: assets.bold.id,
    text: 'STARFALL',
    fontSize: 80,
    spacing: 1.15,
    color: LIGHT,
    anchor: [0.5, 0.5, 0.5, 0.5],
    pivot: [0.5, 0.5]
});
title.setLocalPosition(0, 230, 0);
screen.addChild(title);

/**
 * Create a menu button: an image element that receives input, a button component that changes
 * the image as the button is hovered and pressed, and a label without input, so that clicks on
 * the label go to the button.
 *
 * @param {string} text - The label.
 * @param {number} y - The height of the button on the screen.
 * @param {object} image - Properties of the image element.
 * @param {object} data - Properties of the button component.
 * @returns {Entity} The button entity.
 */
const createButton = (text, y, image, data) => {
    const button = new Entity(text);
    button.addComponent('element', {
        type: ELEMENTTYPE_IMAGE,
        anchor: [0.5, 0.5, 0.5, 0.5],
        pivot: [0.5, 0.5],
        width: 260,
        height: 72,
        useInput: true,
        ...image
    });
    button.addComponent('button', { imageEntity: button, ...data });
    button.setLocalPosition(0, y, 0);
    screen.addChild(button);

    const label = new Entity('label');
    label.addComponent('element', {
        type: ELEMENTTYPE_TEXT,
        fontAsset: assets.bold.id,
        text,
        fontSize: 30,
        // dark text on the orange tint buttons, light text on the slate sprite frames
        color: data.transitionMode === BUTTON_TRANSITION_MODE_SPRITE_CHANGE ? LIGHT : INK,
        anchor: [0.5, 0.5, 0.5, 0.5],
        pivot: [0.5, 0.5]
    });
    button.addChild(label);

    // Sink the button slightly while it is pressed, and show a pointer while it is hovered
    button.button.on('pressedstart', () => button.setLocalScale(0.95, 0.95, 1));
    button.button.on('pressedend', () => button.setLocalScale(1, 1, 1));
    button.button.on('hoverstart', () => {
        canvas.style.cursor = 'pointer';
    });
    button.button.on('hoverend', () => {
        canvas.style.cursor = '';
    });
    return button;
};

// Tint buttons: the tints replace the image's color, so they are lighter and darker oranges
const tints = {
    hoverTint: new Color(1, 0.7, 0.45),
    pressedTint: new Color(0.8, 0.4, 0.1),
    inactiveTint: new Color(0.3, 0.32, 0.37),
    fadeDuration: 100
};
const play = createButton('Play', 100, { sprite: rounded, color: ORANGE }, tints);
const resume = createButton('Continue', 12, { sprite: rounded, color: ORANGE }, { ...tints, active: false });

// Sprite change buttons: each state shows another frame of the image's sprite
const frames = {
    transitionMode: BUTTON_TRANSITION_MODE_SPRITE_CHANGE,
    hoverSpriteFrame: 1,
    pressedSpriteFrame: 2,
    inactiveSpriteFrame: 3
};
const options = createButton('Options', -76, { sprite: states }, frames);
const credits = createButton('Credits', -164, { sprite: states }, frames);

// A small close button in the corner, whose hit area reaches 16 units beyond its image
const close = new Entity('close');
close.addComponent('element', {
    type: ELEMENTTYPE_IMAGE,
    anchor: [1, 1, 1, 1],
    pivot: [1, 1],
    width: 32,
    height: 32,
    sprite: cross,
    color: MUTED,
    useInput: true
});
close.addComponent('button', {
    imageEntity: close,
    hitPadding: [16, 16, 16, 16],
    hoverTint: LIGHT,
    pressedTint: ORANGE
});
close.setLocalPosition(-40, -40, 0);
screen.addChild(close);

const status = new Entity('status');
status.addComponent('element', {
    type: ELEMENTTYPE_TEXT,
    fontAsset: assets.font.id,
    text: 'Start a new game to unlock Continue',
    fontSize: 24,
    color: MUTED,
    anchor: [0.5, 0.5, 0.5, 0.5],
    pivot: [0.5, 0.5]
});
status.setLocalPosition(0, -264, 0);
screen.addChild(status);

const say = (/** @type {string} */ text) => {
    status.element.text = text;
};

play.button.on('click', () => {
    // there is a saved game now, so Continue becomes active
    resume.button.active = true;
    say('A new game begins');
});
resume.button.on('click', () => say('Continuing where you left off'));
options.button.on('click', () => say('Options'));
credits.button.on('click', () => say('Credits'));
close.button.on('click', () => say('Thanks for playing!'));

// @config
//
// A game over screen built from **text** elements: a title with an outline and a shadow, a
// stats table whose columns are aligned left and right, a tip that wraps to its width, and a
// countdown whose text is set only when its number changes.

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

// The title, with an outline and a soft shadow drawn by the font's shader
const title = new Entity('title');
title.addComponent('element', {
    type: ELEMENTTYPE_TEXT,
    fontAsset: assets.bold.id,
    text: 'Game Over',
    fontSize: 64,
    color: new Color(1, 0.55, 0.2),
    outlineColor: new Color(0.45, 0.14, 0),
    outlineThickness: 0.4,
    shadowColor: new Color(0, 0, 0, 0.8),
    shadowOffset: new Vec2(0.14, -0.22),
    anchor: [0.5, 0.5, 0.5, 0.5],
    pivot: [0.5, 0.5]
});
title.setLocalPosition(0, 240, 0);
screen.addChild(title);

/**
 * Create a text element centered on its parent.
 *
 * @param {Entity} parent - The parent entity.
 * @param {string} name - The entity name.
 * @param {object} properties - Properties of the element component.
 * @returns {Entity} The entity.
 */
const createText = (parent, name, properties) => {
    const entity = new Entity(name);
    entity.addComponent('element', {
        type: ELEMENTTYPE_TEXT,
        fontAsset: assets.font.id,
        color: LIGHT,
        anchor: [0.5, 0.5, 0.5, 0.5],
        pivot: [0.5, 0.5],
        ...properties
    });
    parent.addChild(entity);
    return entity;
};

// Spacing widens the gaps between the letters
createText(screen, 'subtitle', {
    text: 'YOUR QUEST ENDS HERE',
    fontSize: 22,
    spacing: 1.4,
    color: MUTED
}).setLocalPosition(0, 182, 0);

// The stats: two text elements of the same size and line height, one aligned to the left and
// one to the right, over a sliced panel
const panel = new Entity('stats');
panel.addComponent('element', {
    type: ELEMENTTYPE_IMAGE,
    sprite: new Sprite(device, {
        atlas: assets.ui.resource,
        frameKeys: ['panel'],
        pixelsPerUnit: 2,
        renderMode: SPRITE_RENDERMODE_SLICED
    }),
    color: new Color(0.16, 0.18, 0.23),
    anchor: [0.5, 0.5, 0.5, 0.5],
    pivot: [0.5, 0.5],
    width: 440,
    height: 210
});
panel.setLocalPosition(0, 30, 0);
screen.addChild(panel);
app.on('destroy', () => panel.element.sprite.destroy());

const column = { fontSize: 26, lineHeight: 44, width: 360, height: 176, autoWidth: false, autoHeight: false };
createText(panel, 'labels', {
    ...column,
    text: 'Score\nEnemies defeated\nTime survived\nBest score',
    color: MUTED,
    alignment: [0, 0.5]
});
createText(panel, 'values', {
    ...column,
    fontAsset: assets.bold.id,
    text: '12,480\n87\n14:32\n15,200',
    alignment: [1, 0.5]
});

// A tip that wraps at the width of its element, centered line by line
const tip = createText(screen, 'tip', {
    text: 'Tip: shields stop arrows but not fireballs. Step to the side as soon as a mage raises its staff.',
    fontSize: 24,
    lineHeight: 32,
    color: MUTED,
    width: 560,
    autoWidth: false,
    wrapLines: true,
    alignment: [0.5, 0.5]
});
tip.setLocalPosition(0, -140, 0);

const countdown = createText(screen, 'countdown', { fontAsset: assets.bold.id, fontSize: 28 });
countdown.setLocalPosition(0, -250, 0);

// Count down to the next run. Setting the text lays it out again, so it is set only when the
// number changes, while the pulse changes its opacity, which doesn't
let time = 0;
let shown = 0;
app.on('update', (dt) => {
    time += dt;
    const seconds = 5 - Math.floor(time % 5);
    if (seconds !== shown) {
        shown = seconds;
        countdown.element.text = `Restarting in ${seconds}`;
    }
    countdown.element.opacity = 0.55 + 0.45 * Math.cos(time * Math.PI * 2);
});

// Use a portrait reference resolution on portrait canvases, with a narrower tip, and scale to
// whichever axis has less room, so the whole screen stays in view
const layout = () => {
    const portrait = device.height > device.width;
    const reference = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
    screen.screen.referenceResolution = reference;
    screen.screen.scaleBlend = device.width / reference.x > device.height / reference.y ? 1 : 0;
    tip.element.width = portrait ? 460 : 560;
};
device.on('resizecanvas', layout);
layout();

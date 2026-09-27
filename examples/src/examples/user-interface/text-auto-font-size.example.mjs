// @config
//
// A multiplayer lobby whose name badges fit names of any length. Each badge is a text element
// with **auto fit** on, which shrinks its font until the name fits, between a maximum and a
// minimum size. Press *Join* to add players with longer names.

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

const PANEL = new Color(0.16, 0.18, 0.23);
const PLATE = new Color(0.1, 0.11, 0.14);
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
const avatars = [1, 2, 3, 4].map((i) => new Sprite(device, { atlas, frameKeys: [`avatar-${i}`] }));
app.on('destroy', () => [panel, outline, ...avatars].forEach((s) => s.destroy()));

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

const title = createElement(screen, 'title', {
    type: ELEMENTTYPE_TEXT,
    fontAsset: assets.bold.id,
    text: 'Lobby',
    fontSize: 44
});

/**
 * Create the card of a player slot, empty until a player joins.
 *
 * @param {number} index - The slot number.
 * @returns {{ card: Entity, badge: Entity, avatar: Entity }} The card, its name badge and avatar.
 */
const createSlot = (index) => {
    const card = createElement(screen, `slot ${index}`, { sprite: outline, color: MUTED, width: 232, height: 250 });
    const avatar = createElement(card, 'avatar', { sprite: avatars[index], width: 120, height: 120 });
    avatar.setLocalPosition(0, 36, 0);
    createElement(card, 'plate', { sprite: panel, color: PLATE, width: 216, height: 48 }).setLocalPosition(0, -80, 0);

    // Shrink a name to fit its 200 × 40 badge, down to 12 units if needed
    const badge = createElement(card, 'badge', {
        type: ELEMENTTYPE_TEXT,
        fontAsset: assets.bold.id,
        autoWidth: false,
        autoHeight: false,
        width: 200,
        height: 40,
        autoFitWidth: true,
        autoFitHeight: true,
        maxFontSize: 32,
        minFontSize: 12
    });
    badge.setLocalPosition(0, -80, 0);
    return { card, badge, avatar };
};
const slots = [0, 1, 2, 3].map(createSlot);

const names = ['Ada', 'Maximilian von Hohenberg', 'Grace', 'xX_DragonSlayer_2026_Xx'];
let players = 0;

// A player joins the next empty slot, which turns into a filled card
const join = () => {
    const { card, badge, avatar } = slots[players];
    card.element.sprite = panel;
    card.element.color = PANEL;
    avatar.enabled = true;
    badge.element.text = names[players];
    badge.element.color = LIGHT;
    players++;
};

// Empty slots show a muted placeholder
slots.forEach(({ badge, avatar }) => {
    avatar.enabled = false;
    badge.element.text = 'Waiting…';
    badge.element.color = MUTED;
});

const button = createElement(screen, 'join', {
    sprite: panel,
    color: new Color(1, 0.55, 0.2),
    width: 220,
    height: 64,
    useInput: true
});
button.addComponent('button', {
    imageEntity: button,
    hoverTint: new Color(1, 0.7, 0.45),
    pressedTint: new Color(0.8, 0.4, 0.1),
    inactiveTint: new Color(0.3, 0.32, 0.37)
});
const label = createElement(button, 'label', {
    type: ELEMENTTYPE_TEXT,
    fontAsset: assets.bold.id,
    text: 'Join',
    fontSize: 28,
    color: new Color(0.1, 0.1, 0.1)
});
button.button.on('click', () => {
    join();
    if (players === slots.length) {
        button.button.active = false;
        label.element.text = 'Lobby full';
    }
});

join();
join();

// Four cards in a row on landscape canvases, and two rows of two on portrait ones
const layout = () => {
    const portrait = device.height > device.width;
    const reference = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
    screen.screen.referenceResolution = reference;
    screen.screen.scaleBlend = device.width / reference.x > device.height / reference.y ? 1 : 0;
    slots.forEach(({ card }, i) => {
        if (portrait) {
            card.setLocalPosition((i % 2) * 252 - 126, 150 - Math.floor(i / 2) * 274, 0);
        } else {
            card.setLocalPosition(i * 252 - 378, 20, 0);
        }
    });
    title.setLocalPosition(0, portrait ? 340 : 270, 0);
    button.setLocalPosition(0, portrait ? -322 : -210, 0);
};
device.on('resizecanvas', layout);
layout();

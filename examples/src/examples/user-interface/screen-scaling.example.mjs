// @config
//
// A mobile game's HUD, designed at a 1280 x 720 **reference resolution**. The buttons change how its
// screen scales: **Blend** fits the reference to the canvas, where None keeps its units in pixels,
// and **Scale Blend** picks the axis to follow. The outline shows the reference area.

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
    SCALEMODE_NONE,
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
    font: new Asset('font', 'font', { url: './assets/fonts/roboto-bold.json' }),
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
const PANEL = new Color(0.16, 0.18, 0.23);
const LIGHT = new Color(0.95, 0.96, 0.98);
const MUTED = new Color(0.6, 0.64, 0.72);

const camera = new Entity('camera');
camera.addComponent('camera', { clearColor: new Color(0.2, 0.3, 0.26) });
app.root.addChild(camera);

const atlas = assets.ui.resource;
const sliced = (/** @type {string} */ frame) => {
    return new Sprite(device, { atlas, frameKeys: [frame], pixelsPerUnit: 2, renderMode: SPRITE_RENDERMODE_SLICED });
};
const panel = sliced('panel');
const outline = sliced('panel-outline');
const icons = new Sprite(device, { atlas, frameKeys: ['circle', 'knob'] });
app.on('destroy', () => [panel, outline, icons].forEach((sprite) => sprite.destroy()));

/**
 * Create an element. Pass its anchor and pivot: the corner or edge of the screen it belongs to.
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

// The HUD's screen, designed at 1280 x 720, and the reference area, centered on it
const hud = new Entity('hud');
hud.addComponent('screen', {
    screenSpace: true,
    scaleMode: SCALEMODE_BLEND,
    referenceResolution: [1280, 720],
    scaleBlend: 0.5
});
app.root.addChild(hud);
const center = { anchor: [0.5, 0.5, 0.5, 0.5], pivot: [0.5, 0.5] };
const reference = createElement(hud, 'reference', {
    ...center,
    sprite: outline,
    color: MUTED,
    width: 1280,
    height: 720
});
const note = { type: ELEMENTTYPE_TEXT, text: 'Reference area, 1280 × 720', fontSize: 22, color: MUTED };
createElement(reference, 'note', { ...note, anchor: [0.5, 1, 0.5, 1], pivot: [0.5, 1] }).setLocalPosition(0, -96, 0);

/**
 * Add a HUD element to a corner of the screen, 24 units in from its edges.
 *
 * @param {string} name - The entity name.
 * @param {number} x - The side: 0 for the left, 1 for the right.
 * @param {number} y - The side: 0 for the bottom, 1 for the top.
 * @param {object} properties - Properties of the element component.
 * @returns {Entity} The entity.
 */
const corner = (name, x, y, properties) => {
    const entity = createElement(hud, name, { anchor: [x, y, x, y], pivot: [x, y], ...properties });
    entity.setLocalPosition(x ? -24 : 24, y ? -24 : 24, 0);
    return entity;
};

// Health and coins along the top, a joystick and a minimap along the bottom
const health = corner('health', 0, 1, { sprite: panel, color: PANEL, width: 320, height: 56 });
createElement(health, 'bar', { ...center, sprite: panel, color: new Color(1, 0.35, 0.4), width: 288, height: 24 });
const coins = corner('coins', 1, 1, { sprite: panel, color: PANEL, width: 200, height: 56 });
createElement(coins, 'amount', { ...center, type: ELEMENTTYPE_TEXT, text: '1,250 coins', fontSize: 28 });
const stick = corner('joystick', 0, 0, { sprite: icons, spriteFrame: 0, color: PANEL, width: 200, height: 200 });
createElement(stick, 'knob', { ...center, sprite: icons, spriteFrame: 1, width: 80, height: 80 });
const map = corner('minimap', 1, 0, { sprite: panel, color: new Color(0.3, 0.45, 0.35), width: 200, height: 200 });
createElement(map, 'you', { ...center, sprite: icons, spriteFrame: 0, color: ORANGE, width: 20, height: 20 });

// The controls are on a second screen, drawn over the HUD's with a higher priority and always
// scaled with Blend, so they stay usable whatever the HUD's screen does
const controls = new Entity('controls');
controls.addComponent('screen', {
    screenSpace: true,
    scaleMode: SCALEMODE_BLEND,
    referenceResolution: [1280, 720],
    priority: 10
});
app.root.addChild(controls);
const readout = createElement(controls, 'readout', { ...center, type: ELEMENTTYPE_TEXT, fontSize: 24 });
const showReadout = () => {
    readout.element.text = `Canvas ${device.width} × ${device.height} pixels, HUD scale ${hud.screen.scale.toFixed(2)}`;
};

/**
 * Create a button that shows a setting, and moves it on to its next value when pressed.
 *
 * @param {string} name - The name of the setting.
 * @param {object} values - The value for each label.
 * @param {(value: *) => void} apply - Applies a value.
 * @returns {Entity} The button entity.
 */
const createToggle = (name, values, apply) => {
    const button = createElement(controls, name, {
        ...center,
        sprite: panel,
        color: ORANGE,
        width: 260,
        height: 64,
        useInput: true
    });
    button.addComponent('button', {
        imageEntity: button,
        hoverTint: new Color(1, 0.7, 0.45),
        pressedTint: new Color(0.8, 0.4, 0.1)
    });
    const label = createElement(button, 'label', {
        ...center,
        type: ELEMENTTYPE_TEXT,
        fontSize: 24,
        color: new Color(0.1, 0.1, 0.1)
    });
    const labels = Object.keys(values);
    let index = 0;
    const show = () => {
        label.element.text = `${name}: ${labels[index]}`;
        apply(values[labels[index]]);
        showReadout();
    };
    button.button.on('click', () => {
        index = (index + 1) % labels.length;
        show();
    });
    show();
    return button;
};

// Fit follows whichever axis has less room, so the whole reference area stays on screen
let blend = 'fit';
const fitReference = () => {
    const { resolution, referenceResolution } = hud.screen;
    const wider = resolution.x / referenceResolution.x > resolution.y / referenceResolution.y;
    hud.screen.scaleBlend = blend === 'fit' ? (wider ? 1 : 0) : blend;
};
const toggles = [
    createToggle('Scale mode', { Blend: SCALEMODE_BLEND, None: SCALEMODE_NONE }, (mode) => {
        hud.screen.scaleMode = mode;
    }),
    createToggle('Scale blend', { Fit: 'fit', '0 (width)': 0, 0.5: 0.5, '1 (height)': 1 }, (value) => {
        blend = value;
        fitReference();
    }),
    createToggle('Pixel ratio', { Device: Math.min(window.devicePixelRatio, 2), '1x': 1 }, (ratio) => {
        device.maxPixelRatio = ratio;
        app.resizeCanvas();
    })
];

// Lay the controls out along the bottom of the screen, or stacked on portrait canvases
const layout = () => {
    fitReference();
    const portrait = device.height > device.width;
    controls.screen.referenceResolution = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
    toggles.forEach((toggle, i) => {
        toggle.setLocalPosition(portrait ? 0 : (i - 1) * 280, portrait ? -40 - i * 80 : -80, 0);
    });
    readout.setLocalPosition(0, portrait ? 60 : 0, 0);
    showReadout();
};
device.on('resizecanvas', layout);
layout();

// @config
//
// A hangar door with an exit sign above it and a control panel beside it. Both are
// **world-space screens**: interfaces placed in the scene by their entity's transform, and sized
// in meters by its scale. Press the panel's buttons to open and close the door, and drag to look.

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
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF3_32F,
    SPRITE_RENDERMODE_SLICED,
    ScreenComponentSystem,
    ScriptComponentSystem,
    Sprite,
    StandardMaterial,
    TextureAtlasHandler,
    TextureHandler,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

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
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScreenComponentSystem,
    ElementComponentSystem,
    ButtonComponentSystem,
    ScriptComponentSystem
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

/**
 * Create a box of one color.
 *
 * @param {string} name - The entity name.
 * @param {number[]} color - The color.
 * @param {number[]} position - The position of its center, in meters.
 * @param {number[]} size - Its size, in meters.
 * @returns {Entity} The entity.
 */
const createBox = (name, color, position, size) => {
    const material = new StandardMaterial();
    material.diffuse = new Color(...color);
    material.gloss = 0.5;
    material.update();
    const box = new Entity(name);
    box.addComponent('render', { type: 'box', material });
    box.setPosition(...position);
    box.setLocalScale(...size);
    app.root.addChild(box);
    return box;
};

// The hangar: a floor, and a wall with an opening that the door slides up into
app.scene.ambientLight = new Color(0.25, 0.27, 0.32);
createBox('floor', [0.2, 0.22, 0.26], [0, -0.05, 0], [20, 0.1, 16]);
createBox('back wall', [0.5, 0.42, 0.35], [0, 3, -6], [20, 6, 0.2]);
createBox('wall left', [0.32, 0.34, 0.4], [-5.2, 3, -0.2], [8, 6, 0.4]);
createBox('wall right', [0.32, 0.34, 0.4], [5.2, 3, -0.2], [8, 6, 0.4]);
createBox('wall top', [0.32, 0.34, 0.4], [0, 4.5, -0.2], [2.4, 3, 0.4]);
const door = createBox('door', [0.85, 0.65, 0.25], [0, 1.5, -0.2], [2.4, 3, 0.2]);

const light = new Entity('light');
light.addComponent('light', {
    type: 'directional',
    castShadows: true,
    shadowType: SHADOW_PCF3_32F,
    shadowDistance: 20,
    shadowBias: 0.2,
    normalOffsetBias: 0.05
});
light.setLocalEulerAngles(60, 30, 0);
app.root.addChild(light);

// A warm light in the room behind the door, which shows as the door opens
const lamp = new Entity('lamp');
lamp.addComponent('light', { type: 'omni', color: new Color(1, 0.75, 0.45), intensity: 2, range: 8 });
lamp.setPosition(0, 2.5, -4);
app.root.addChild(lamp);

// A camera that orbits the door. Drag to look around
const camera = new Entity('camera');
camera.addComponent('camera', { clearColor: new Color(0.1, 0.11, 0.13), fov: 50 });
camera.addComponent('script');
camera.setPosition(2.6, 2.4, 6.8);
app.root.addChild(camera);
camera.script.create(CameraControls, {
    properties: {
        focusPoint: new Vec3(1, 2.2, 0),
        enableFly: false,
        pitchRange: new Vec2(-40, 10),
        zoomRange: new Vec2(3, 10)
    }
});

const atlas = assets.ui.resource;
const panel = new Sprite(device, {
    atlas,
    frameKeys: ['panel'],
    pixelsPerUnit: 2,
    renderMode: SPRITE_RENDERMODE_SLICED
});
app.on('destroy', () => panel.destroy());

/**
 * Create an element on a parent, centered on it unless the properties say otherwise.
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

// The exit sign: a world-space screen 400 x 240 units, scaled to 1.6 x 0.96 meters, above the door.
// Its elements are drawn after the scene, and depth-tested against it
const sign = new Entity('sign');
sign.addComponent('screen', {
    screenSpace: false,
    resolution: [400, 240]
});
sign.setLocalScale(0.004, 0.004, 0.004);
sign.setPosition(0, 4.6, 0.01);
app.root.addChild(sign);
createElement(sign, 'background', {
    sprite: panel,
    color: new Color(0.1, 0.45, 0.25),
    anchor: [0, 0, 1, 1],
    margin: [0, 0, 0, 0]
});
createElement(sign, 'title', { type: ELEMENTTYPE_TEXT, text: 'Exit', fontSize: 96 });

// The control panel beside the door: a screen of its own, at the same scale, whose buttons take
// input like the buttons of a 2D interface
const controls = new Entity('controls');
controls.addComponent('screen', {
    screenSpace: false,
    resolution: [300, 360]
});
controls.setLocalScale(0.004, 0.004, 0.004);
controls.setPosition(2.4, 1.6, 0.01);
app.root.addChild(controls);
createElement(controls, 'background', { sprite: panel, color: PANEL, anchor: [0, 0, 1, 1], margin: [0, 0, 0, 0] });
createElement(controls, 'title', { type: ELEMENTTYPE_TEXT, text: 'Hangar Door', fontSize: 36 }).setLocalPosition(
    0,
    130,
    0
);
const status = createElement(controls, 'status', { type: ELEMENTTYPE_TEXT, fontSize: 28, color: MUTED });
status.setLocalPosition(0, 78, 0);

/**
 * Create a button of the control panel.
 *
 * @param {string} text - The label.
 * @param {number} y - The vertical position.
 * @returns {Entity} The button entity.
 */
const createButton = (text, y) => {
    const button = createElement(controls, text, {
        sprite: panel,
        color: ORANGE,
        width: 220,
        height: 72,
        useInput: true
    });
    button.setLocalPosition(0, y, 0);
    button.addComponent('button', {
        imageEntity: button,
        hoverTint: new Color(1, 0.7, 0.45),
        pressedTint: new Color(0.8, 0.4, 0.1),
        inactiveTint: new Color(0.3, 0.32, 0.37)
    });
    createElement(button, 'label', { type: ELEMENTTYPE_TEXT, text, fontSize: 32, color: new Color(0.1, 0.1, 0.1) });
    return button;
};
const open = createButton('Open', -10);
const close = createButton('Close', -100);

// The door slides up into the wall, or down to close. Only the button that can act is active
let target = 0;
let raised = 0;
const setTarget = (/** @type {number} */ value) => {
    target = value;
    open.button.active = value === 0;
    close.button.active = value === 1;
};
open.button.on('click', () => setTarget(1));
close.button.on('click', () => setTarget(0));
setTarget(0);

app.on('update', (dt) => {
    raised = target > raised ? Math.min(raised + dt * 0.8, 1) : Math.max(raised - dt * 0.8, 0);
    door.setPosition(0, 1.5 + raised * 2.9, -0.2);
    const text = raised === target ? (target ? 'Open' : 'Closed') : target ? 'Opening…' : 'Closing…';
    if (status.element.text !== text) {
        status.element.text = text;
    }
});

// On portrait canvases, fit the scene to the width of the view rather than its height
const layout = () => {
    camera.camera.horizontalFov = device.height > device.width;
};
device.on('resizecanvas', layout);
layout();

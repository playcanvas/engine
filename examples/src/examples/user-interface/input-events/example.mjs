// @config
//
// A map that drops a marker wherever the ground is tapped, under a HUD toolbar. The game reads the
// mouse and touch devices, so without help a tap on the HUD drops a marker behind it too. Tick
// **Keep HUD taps from the game** to stop those presses propagating, and try the tools again.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ELEMENTTYPE_GROUP,
    ELEMENTTYPE_IMAGE,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SCALEMODE_BLEND,
    SPRITE_RENDERMODE_SLICED,
    ScreenComponentSystem,
    Sprite,
    StandardMaterial,
    TextureAtlasHandler,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
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

// Create the element input before the mouse and touch devices, so that stopping an event in a
// UI handler also hides it from them
const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.elementInput = new ElementInput(canvas);
createOptions.mouse = new Mouse(canvas);
createOptions.touch = new TouchDevice(canvas);
createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScreenComponentSystem,
    ElementComponentSystem
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
const LIGHT = new Color(0.95, 0.96, 0.98);
const MUTED = new Color(0.6, 0.64, 0.72);

// The tools, each with an icon in the UI kit and the color of its markers
const TOOLS = [
    { name: 'Pin', icon: 'icon-pin', color: new Color(1, 0.55, 0.2) },
    { name: 'Treasure', icon: 'icon-star', color: new Color(1, 0.8, 0.3) },
    { name: 'Danger', icon: 'icon-flame', color: new Color(0.95, 0.3, 0.25) }
];

// A material of one color, for the ground and the markers
const createMaterial = (/** @type {Color} */ color) => {
    const material = new StandardMaterial();
    material.diffuse = color;
    material.update();
    return material;
};
const materials = TOOLS.map(({ color }) => createMaterial(color));
let tool = 0;

// The map: the ground, a light, and a camera looking down at it
app.scene.ambientLight = new Color(0.35, 0.37, 0.42);
const ground = new Entity('ground');
ground.addComponent('render', { type: 'plane', material: createMaterial(new Color(0.3, 0.45, 0.35)) });
ground.setLocalScale(200, 1, 200);
app.root.addChild(ground);

const light = new Entity('light');
light.addComponent('light', { type: 'directional', castShadows: true, shadowDistance: 30 });
light.setLocalEulerAngles(50, 30, 0);
app.root.addChild(light);

const camera = new Entity('camera');
camera.addComponent('camera', { clearColor: new Color(0.1, 0.11, 0.13) });
camera.setPosition(0, 12, 9);
camera.lookAt(0, 0, 0);
app.root.addChild(camera);

// The HUD's screen
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
const icons = new Sprite(device, { atlas, frameKeys: [...TOOLS.map(({ icon }) => icon), 'checkbox', 'check'] });
app.on('destroy', () => [panel, icons].forEach((sprite) => sprite.destroy()));

/**
 * Create an element, centered on its parent unless the properties say otherwise.
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

// The HUD is a group element that fills the screen, with input off, so that only its panels stop
// presses from reaching the game. The toolbar is one of them, at the bottom of the screen
const hud = createElement(screen, 'hud', { type: ELEMENTTYPE_GROUP, anchor: [0, 0, 1, 1], margin: [0, 0, 0, 0] });
const toolbar = createElement(hud, 'toolbar', {
    sprite: panel,
    color: PANEL,
    anchor: [0.5, 0, 0.5, 0],
    pivot: [0.5, 0],
    width: 296,
    height: 104,
    useInput: true
});
toolbar.setLocalPosition(0, 24, 0);
const buttons = TOOLS.map(({ name, color }, i) => {
    const button = createElement(toolbar, name, { sprite: panel, color: PANEL, width: 80, height: 80, useInput: true });
    button.setLocalPosition((i - 1) * 92, 0, 0);
    createElement(button, 'icon', { sprite: icons, spriteFrame: i, color, width: 48, height: 48 });
    return button;
});

// The name of the tool under the pointer, above the toolbar. Hovering is a mouse extra: a tap
// chooses the tool, and shows its name too
const label = createElement(hud, 'label', {
    type: ELEMENTTYPE_TEXT,
    fontSize: 26,
    anchor: [0.5, 0, 0.5, 0],
    pivot: [0.5, 0]
});
label.setLocalPosition(0, 140, 0);
const show = (/** @type {number} */ i) => {
    label.element.text = `${TOOLS[i].name} marker`;
};
buttons.forEach((button, i) => {
    button.element.on('mouseenter', () => show(i));
    button.element.on('mouseleave', () => show(tool));
});

// One listener on the toolbar handles the clicks of all its buttons: events bubble up from the
// element that was hit, which the event names
const choose = (/** @type {number} */ i) => {
    tool = i;
    buttons.forEach((button, j) => {
        button.element.color = j === i ? new Color(0.3, 0.34, 0.42) : PANEL;
    });
    show(i);
};
toolbar.element.on('click', (event) => {
    const i = buttons.indexOf(event.element.entity);
    if (i >= 0) {
        choose(i);
    }
});
choose(0);

// Stop presses on the HUD from propagating, which keeps them from the mouse and touch devices too.
// The checkbox turns it on and off, to compare
let blocking = false;
const block = (/** @type {{ stopPropagation: () => void }} */ event) => {
    if (blocking) {
        event.stopPropagation();
    }
};
hud.element.on('mousedown', block);
hud.element.on('touchstart', block);

const option = createElement(hud, 'option', {
    sprite: panel,
    color: PANEL,
    anchor: [0, 1, 0, 1],
    pivot: [0, 1],
    width: 400,
    height: 64,
    useInput: true
});
option.setLocalPosition(24, -24, 0);
const box = createElement(option, 'box', { sprite: icons, spriteFrame: 3, color: MUTED, width: 36, height: 36 });
box.setLocalPosition(-166, 0, 0);
const tick = createElement(box, 'tick', { sprite: icons, spriteFrame: 4, width: 36, height: 36 });
createElement(option, 'text', {
    type: ELEMENTTYPE_TEXT,
    text: 'Keep HUD taps from the game',
    fontSize: 24
}).setLocalPosition(20, 0, 0);
option.element.on('click', () => {
    blocking = !blocking;
    tick.enabled = blocking;
});
tick.enabled = blocking;

// The number of markers the game has dropped, which a leaking tap on the HUD adds to
const count = createElement(hud, 'count', {
    type: ELEMENTTYPE_TEXT,
    text: 'Markers dropped: 0',
    fontSize: 26,
    anchor: [1, 1, 1, 1],
    pivot: [1, 1]
});

// The game's input: a press on the ground drops a marker of the current tool there. It reads the
// mouse and touch devices, as game code does, rather than element events
const markers = [];
let dropped = 0;
const near = new Vec3();
const far = new Vec3();
const addMarker = (/** @type {number} */ x, /** @type {number} */ z, /** @type {number} */ kind) => {
    const marker = new Entity('marker');
    marker.addComponent('render', { type: 'cone', material: materials[kind] });
    marker.setLocalScale(0.5, 0.7, 0.5);
    marker.setPosition(x, 0.35, z);
    app.root.addChild(marker);
    markers.push(marker);
    if (markers.length > 12) {
        markers.shift().destroy();
    }
    count.element.text = `Markers dropped: ${++dropped}`;
};

// Find where a press meets the ground, from points on the camera's near and far planes
const drop = (/** @type {number} */ x, /** @type {number} */ y) => {
    camera.camera.screenToWorld(x, y, camera.camera.nearClip, near);
    camera.camera.screenToWorld(x, y, camera.camera.farClip, far);
    const t = near.y / (near.y - far.y);
    addMarker(near.x + (far.x - near.x) * t, near.z + (far.z - near.z) * t, tool);
};
app.mouse.on('mousedown', (event) => drop(event.x, event.y));

// A tap is followed by emulated mouse events, which would drop a second marker. Cancelling the
// touch stops them
app.touch.on('touchstart', (event) => {
    const { x, y } = event.changedTouches[0];
    drop(x, y);
    event.event.preventDefault();
});

// A few markers are on the map already
addMarker(-3.5, -2, 0);
addMarker(2.5, 0.5, 1);
addMarker(4, -3, 2);

// On portrait canvases, use a portrait reference resolution, fit the map to the width of the view,
// and move the count below the option
const layout = () => {
    const portrait = device.height > device.width;
    screen.screen.referenceResolution = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
    camera.camera.horizontalFov = portrait;
    count.setLocalPosition(-24, portrait ? -108 : -40, 0);
};
device.on('resizecanvas', layout);
layout();

// @config
//
// Equipping gear by **drag and drop**. An ElementDragHelper makes each item follow the pointer,
// and when it is dropped, the item snaps into the slot it overlaps, if the slot takes it, or goes
// back to where it came from. The slots that take the item light up while it is dragged.

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
    ElementDragHelper,
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    Mouse,
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
    font: new Asset('font', 'font', { url: './assets/fonts/roboto-bold.json' }),
    ui: new Asset('ui', 'textureatlas', { url: './assets/ui/ui-atlas.png' }, uiAtlasData)
};

const device = await createGraphicsDevice(canvas, { deviceTypes: [deviceType] });
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

// Dragging with the mouse needs a mouse device, created after the element input
const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.elementInput = new ElementInput(canvas);
createOptions.mouse = new Mouse(canvas);
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

const TAKES = new Color(0.55, 0.32, 0.15);
const PANEL = new Color(0.16, 0.18, 0.23);
const SLOT = new Color(0.22, 0.25, 0.31);
const LIGHT = new Color(0.95, 0.96, 0.98);
const MUTED = new Color(0.6, 0.64, 0.72);

// The items, with their icons in the UI kit and the kind of gear slot that takes them
const ITEMS = [
    { icon: 'icon-sword', color: [0.8, 0.9, 1], type: 'Weapon' },
    { icon: 'icon-shield', color: [0.8, 0.6, 0.4], type: 'Shield' },
    { icon: 'icon-gem', color: [1, 0.3, 0.45], type: 'Charm' },
    { icon: 'icon-potion', color: [1, 0.35, 0.4], type: null },
    { icon: 'icon-heart', color: [1, 0.45, 0.6], type: 'Charm' },
    { icon: 'icon-key', color: [1, 0.8, 0.3], type: null }
];

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
const icons = new Sprite(device, { atlas, frameKeys: ITEMS.map(({ icon }) => icon) });
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

// The bag, with six slots that take any item, and the gear, with a slot for each kind of item
const bag = createElement(screen, 'bag', { sprite: panel, color: PANEL, width: 400, height: 310 });
createElement(bag, 'title', { type: ELEMENTTYPE_TEXT, text: 'Bag', fontSize: 30 }).setLocalPosition(0, 120, 0);
const bagSlots = ITEMS.map((item, i) => {
    const slot = createElement(bag, `slot ${i}`, { sprite: panel, color: SLOT, width: 104, height: 104 });
    slot.setLocalPosition(((i % 3) - 1) * 116, 40 - Math.floor(i / 3) * 116, 0);
    return slot;
});

const gear = createElement(screen, 'gear', { sprite: panel, color: PANEL, width: 400, height: 310 });
createElement(gear, 'title', { type: ELEMENTTYPE_TEXT, text: 'Equipped', fontSize: 30 }).setLocalPosition(0, 120, 0);
const gearSlots = ['Weapon', 'Shield', 'Charm'].map((type, i) => {
    const slot = createElement(gear, type, { sprite: panel, color: SLOT, width: 104, height: 104 });
    slot.setLocalPosition((i - 1) * 116, 10, 0);
    createElement(slot, 'label', { type: ELEMENTTYPE_TEXT, text: type, fontSize: 22, color: MUTED }).setLocalPosition(
        0,
        -78,
        0
    );
    return slot;
});

/**
 * The bounds of an element, in CSS pixels from the top-left of the canvas.
 *
 * @param {Entity} entity - The entity.
 * @returns {{ left: number, right: number, top: number, bottom: number }} The bounds.
 */
const bounds = (entity) => {
    const [bottomLeft, , topRight] = entity.element.canvasCorners;
    return { left: bottomLeft.x, right: topRight.x, top: topRight.y, bottom: bottomLeft.y };
};
const overlap = (/** @type {Entity} */ a, /** @type {Entity} */ b) => {
    const p = bounds(a);
    const q = bounds(b);
    return p.left < q.right && p.right > q.left && p.top < q.bottom && p.bottom > q.top;
};

// The items are drawn over both panels, in a group of their own. Each is in a slot, where it goes
// back to whenever it is not dropped in another one. The sword starts out equipped
const layer = createElement(screen, 'items', { type: ELEMENTTYPE_GROUP, anchor: [0, 0, 1, 1], margin: [0, 0, 0, 0] });
const items = ITEMS.map((data, i) => {
    const entity = createElement(layer, data.icon, {
        sprite: icons,
        spriteFrame: i,
        color: new Color(...data.color),
        width: 80,
        height: 80,
        useInput: true
    });
    return {
        entity,
        type: data.type,
        slot: i === 0 ? gearSlots[0] : bagSlots[i],
        drag: new ElementDragHelper(entity.element)
    };
});
const place = (/** @type {{ entity: Entity, slot: Entity }} */ item) =>
    item.entity.setPosition(item.slot.getPosition());
const takes = (/** @type {Entity} */ slot, /** @type {{ type: string|null }} */ item) =>
    bagSlots.includes(slot) || slot.name === item.type;

items.forEach((item) => {
    // While an item is dragged, it is drawn over the other items, and the slots that take it light up
    item.drag.on('drag:start', () => {
        item.entity.reparent(layer);
        gearSlots.forEach((slot) => {
            slot.element.color = takes(slot, item) ? TAKES : SLOT;
        });
    });

    // Dropped on a slot that takes it, the item moves in, and an item already there swaps to the
    // slot it came from, if that slot takes it. Anywhere else, it goes back
    item.drag.on('drag:end', () => {
        const target = [...gearSlots, ...bagSlots].find((slot) => overlap(item.entity, slot));
        const other = items.find((o) => o !== item && o.slot === target);
        if (target && takes(target, item) && (!other || takes(item.slot, other))) {
            if (other) {
                other.slot = item.slot;
                place(other);
            }
            item.slot = target;
        }
        place(item);
        gearSlots.forEach((slot) => {
            slot.element.color = SLOT;
        });
    });
});

// The panels side by side on landscape canvases, and stacked on portrait ones. The items follow
// their slots
const layout = () => {
    const portrait = device.height > device.width;
    const reference = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
    screen.screen.referenceResolution = reference;
    screen.screen.scaleBlend = device.width / reference.x > device.height / reference.y ? 1 : 0;
    bag.setLocalPosition(portrait ? 0 : -220, portrait ? 190 : 0, 0);
    gear.setLocalPosition(portrait ? 0 : 220, portrait ? -170 : 0, 0);
    items.forEach(place);
};
device.on('resizecanvas', layout);
layout();

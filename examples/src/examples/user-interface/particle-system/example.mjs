// @config
//
// A daily reward card with a sparkling chest. Its **particle systems** are in screen space and on
// the UI layer, so they are drawn in the hierarchy's order with the elements: over the card and
// the chest, and under the text and button that come after them. Claim the reward for a burst.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_ADDITIVE,
    ButtonComponentSystem,
    CameraComponentSystem,
    Color,
    Curve,
    CurveSet,
    ELEMENTTYPE_GROUP,
    ELEMENTTYPE_IMAGE,
    ELEMENTTYPE_TEXT,
    EMITTERSHAPE_SPHERE,
    ElementComponentSystem,
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    ParticleSystemComponentSystem,
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
    spark: new Asset('spark', 'texture', { url: './assets/textures/spark.png' }, { srgb: true })
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
    ButtonComponentSystem,
    ParticleSystemComponentSystem
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
const GOLD = new Color(1, 0.8, 0.3);
const PANEL = new Color(0.16, 0.18, 0.23);
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
const panel = new Sprite(device, {
    atlas,
    frameKeys: ['panel'],
    pixelsPerUnit: 2,
    renderMode: SPRITE_RENDERMODE_SLICED
});
const icons = new Sprite(device, { atlas, frameKeys: ['icon-chest', 'icon-coin'] });
app.on('destroy', () => [panel, icons].forEach((sprite) => sprite.destroy()));

/**
 * Create an image or text element, centered on its parent unless the properties say otherwise.
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
const text = { type: ELEMENTTYPE_TEXT, fontAsset: assets.bold.id };

// The player's coins, in the top-right corner
const purse = createElement(screen, 'purse', { type: ELEMENTTYPE_GROUP, anchor: [1, 1, 1, 1], pivot: [1, 1] });
purse.setLocalPosition(-40, -40, 0);
createElement(purse, 'coin', { sprite: icons, spriteFrame: 1, color: GOLD, width: 48, height: 48 });
const coins = createElement(purse, 'coins', { ...text, fontSize: 36, anchor: [1, 0.5, 1, 0.5], pivot: [1, 0.5] });
coins.setLocalPosition(-40, 0, 0);

// The card, and the chest in the middle of it
const card = createElement(screen, 'card', { sprite: panel, color: PANEL, width: 420, height: 500 });
createElement(card, 'title', { ...text, text: 'Daily Reward', fontSize: 36 }).setLocalPosition(0, 200, 0);
const day = createElement(card, 'day', { ...text, fontAsset: assets.font.id, fontSize: 24, color: MUTED });
day.setLocalPosition(0, 158, 0);
const chest = createElement(card, 'chest', { sprite: icons, spriteFrame: 0, color: GOLD, width: 160, height: 160 });
chest.setLocalPosition(0, 30, 0);

// The particles are drawn with the elements, in the order of the hierarchy, when they are in
// screen space and on the UI layer. Sparkles twinkle around the chest while the reward waits
const uiLayer = app.scene.layers.getLayerByName('UI');
const gold = new CurveSet([
    [0, 1],
    [0, 0.8],
    [0, 0.4]
]);
const sparkles = new Entity('sparkles');
card.addChild(sparkles);
sparkles.setLocalPosition(0, 30, 0);
sparkles.addComponent('particlesystem', {
    screenSpace: true,
    localSpace: true,
    layers: [uiLayer.id],
    numParticles: 20,
    lifetime: 1.2,
    rate: 0.06,
    preWarm: true,
    blendType: BLEND_ADDITIVE,
    emitterShape: EMITTERSHAPE_SPHERE,
    emitterRadius: 220,
    colorMap: assets.spark.resource,
    scaleGraph: new Curve([0, 0, 0.4, 0.04, 1, 0]),
    rotationSpeedGraph: new Curve([0, 90]),
    colorGraph: gold
});

// Claiming bursts 50 sparks out of the chest, once
const burst = new Entity('burst');
card.addChild(burst);
burst.setLocalPosition(0, 30, 0);
burst.addComponent('particlesystem', {
    screenSpace: true,
    localSpace: true,
    layers: [uiLayer.id],
    numParticles: 50,
    lifetime: 1,
    rate: 0,
    loop: false,
    blendType: BLEND_ADDITIVE,
    autoPlay: false,
    emitterShape: EMITTERSHAPE_SPHERE,
    emitterRadius: 30,
    colorMap: assets.spark.resource,
    alignToMotion: true,
    stretch: 0.3,
    localVelocityGraph: new CurveSet([
        [0, -500],
        [0, 100, 1, -600],
        [0, 0]
    ]),
    localVelocityGraph2: new CurveSet([
        [0, 500],
        [0, 700, 1, 0],
        [0, 0]
    ]),
    scaleGraph: new Curve([0, 0.03, 1, 0]),
    colorGraph: gold
});

// The text and the button come after the particles in the hierarchy, so they are drawn over them.
// Sync the screen's draw order after adding particles to it
const reward = createElement(card, 'reward', { ...text, fontSize: 36, color: ORANGE });
reward.setLocalPosition(0, -100, 0);
const claim = createElement(card, 'claim', { sprite: panel, color: ORANGE, width: 240, height: 64, useInput: true });
claim.setLocalPosition(0, -180, 0);
claim.addComponent('button', {
    imageEntity: claim,
    hoverTint: new Color(1, 0.7, 0.45),
    pressedTint: new Color(0.8, 0.4, 0.1),
    inactiveTint: new Color(0.3, 0.32, 0.37)
});
const label = createElement(claim, 'label', { ...text, fontSize: 28, color: new Color(0.1, 0.1, 0.1) });
screen.screen.syncDrawOrder();

// Offer the reward for a day. Each day's reward is 50 coins more than the last
let total = 1250;
let shown = total;
let today = 5;
let next = 0;
const offer = () => {
    day.element.text = `Day ${today}`;
    reward.element.text = `+${200 + today * 10} coins`;
    label.element.text = 'Claim';
    claim.button.active = true;
    sparkles.particlesystem.play();
};
coins.element.text = total.toLocaleString('en-US');
offer();

// Claiming bursts the sparks, stops the twinkling and adds the coins. The next reward is offered
// three seconds later
claim.button.on('click', () => {
    burst.particlesystem.reset();
    burst.particlesystem.play();
    sparkles.particlesystem.stop();
    total += 200 + today * 10;
    today++;
    label.element.text = 'Claimed';
    claim.button.active = false;
    next = 3;
});

// Count the coins up to the new total, and offer the next reward when it is due
app.on('update', (dt) => {
    if (shown < total) {
        shown = Math.min(shown + dt * 250, total);
        coins.element.text = Math.floor(shown).toLocaleString('en-US');
    }
    if (next > 0) {
        next -= dt;
        if (next <= 0) {
            offer();
        }
    }
});

// Use a portrait reference resolution on portrait canvases, and scale to whichever axis has
// less room, so the card stays on screen
const layout = () => {
    const portrait = device.height > device.width;
    const reference = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
    screen.screen.referenceResolution = reference;
    screen.screen.scaleBlend = device.width / reference.x > device.height / reference.y ? 1 : 0;
};
device.on('resizecanvas', layout);
layout();

// @config
//
// A character card with a live 3D portrait. A second camera renders the character, on a layer of
// its own, into a **render target**, and an image element shows its texture, behind the card's
// text and buttons like any other image. Press Emote to see the portrait move.

import {
    AnimComponentSystem,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    ButtonComponentSystem,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    ELEMENTTYPE_GROUP,
    ELEMENTTYPE_IMAGE,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    Layer,
    LightComponentSystem,
    PIXELFORMAT_SRGBA8,
    RENDERTARGET_ORIGIN_TOP,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RenderTarget,
    SCALEMODE_BLEND,
    SPRITE_RENDERMODE_SLICED,
    ScreenComponentSystem,
    Sprite,
    Texture,
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
    model: new Asset('model', 'container', { url: './assets/models/bitmoji.glb' }),
    idle: new Asset('idle', 'container', { url: './assets/animations/bitmoji/idle.glb' }),
    flip: new Asset('flip', 'container', { url: './assets/animations/bitmoji/jump-flip.glb' })
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
    AnimComponentSystem,
    ScreenComponentSystem,
    ElementComponentSystem,
    ButtonComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, TextureAtlasHandler, FontHandler, ContainerHandler];

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

// The main camera draws the interface
const camera = new Entity('camera');
camera.addComponent('camera', { clearColor: new Color(0.1, 0.11, 0.13) });
app.root.addChild(camera);

// The texture the portrait is rendered into, and a layer for what the preview camera sees, which
// the main camera does not render
const previewTexture = new Texture(device, {
    width: 512,
    height: 512,
    format: PIXELFORMAT_SRGBA8,
    mipmaps: false
});
// Store the image top row first, as image textures are, so it is the right way up on every API
const renderTarget = new RenderTarget({ colorBuffer: previewTexture, depth: true, origin: RENDERTARGET_ORIGIN_TOP });
const previewLayer = new Layer({ name: 'Preview' });
app.scene.layers.push(previewLayer);
app.on('destroy', () => {
    renderTarget.destroy();
    previewTexture.destroy();
});

// The preview camera renders before the main camera, whose priority is 0, so the texture is ready
// when the interface is drawn. Its transparent clear color keeps the portrait's background clear
const previewCamera = new Entity('preview camera');
previewCamera.addComponent('camera', {
    layers: [previewLayer.id],
    renderTarget,
    priority: -1,
    clearColor: new Color(0, 0, 0, 0),
    fov: 30
});
previewCamera.setPosition(0, 1, 3.9);
previewCamera.lookAt(0, 0.8, 0);
app.root.addChild(previewCamera);

// The character, and a light, on the preview layer only
const character = assets.model.resource.instantiateRenderEntity();
character.findComponents('render').forEach((render) => {
    render.layers = [previewLayer.id];
});
character.addComponent('anim', { activate: true });
character.anim.assignAnimation('Idle', assets.idle.resource.animations[0].resource);
character.anim.assignAnimation('Flip', assets.flip.resource.animations[0].resource, undefined, 1, false);
app.root.addChild(character);

const light = new Entity('light');
light.addComponent('light', { type: 'directional', layers: [previewLayer.id], intensity: 1.2 });
light.setLocalEulerAngles(40, 30, 0);
app.root.addChild(light);
app.scene.ambientLight = new Color(0.45, 0.47, 0.55);

// The interface
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
app.on('destroy', () => panel.destroy());

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
const text = { type: ELEMENTTYPE_TEXT, anchor: [0, 1, 0, 1], pivot: [0, 1] };

// The card: a frame whose mask crops the portrait, an image of the rendered texture, and the
// character's details
const card = createElement(screen, 'card', { sprite: panel, color: PANEL, width: 720, height: 440 });
const frame = createElement(card, 'frame', {
    sprite: panel,
    color: new Color(0.3, 0.35, 0.5),
    width: 360,
    height: 400
});
const mask = createElement(frame, 'mask', { sprite: panel, anchor: [0, 0, 1, 1], margin: [0, 0, 0, 0], mask: true });
createElement(mask, 'portrait', { texture: previewTexture, width: 400, height: 400 });

const details = createElement(card, 'details', { type: ELEMENTTYPE_GROUP, pivot: [0, 1] });
createElement(details, 'name', { ...text, fontAsset: assets.bold.id, text: 'Nova', fontSize: 48 });
createElement(details, 'role', { ...text, text: 'Level 12 · Acrobat', fontSize: 26, color: ORANGE }).setLocalPosition(
    0,
    -64,
    0
);
createElement(details, 'about', {
    ...text,
    text: 'Quick on his feet, and quicker in the air. He lands every jump, and most of them twice.',
    fontSize: 22,
    lineHeight: 30,
    color: MUTED,
    autoWidth: false,
    wrapLines: true,
    alignment: [0, 1],
    width: 280
}).setLocalPosition(0, -110, 0);

// Emote plays the flip once, and the character goes back to idling when it ends
const emote = createElement(card, 'emote', { sprite: panel, color: ORANGE, width: 220, height: 64, useInput: true });
emote.addComponent('button', {
    imageEntity: emote,
    hoverTint: new Color(1, 0.7, 0.45),
    pressedTint: new Color(0.8, 0.4, 0.1)
});
createElement(emote, 'label', {
    type: ELEMENTTYPE_TEXT,
    fontAsset: assets.bold.id,
    text: 'Emote',
    fontSize: 28,
    color: new Color(0.1, 0.1, 0.1)
});
const flipLength = assets.flip.resource.animations[0].resource.duration;
let idleIn = 0;
emote.button.on('click', () => {
    character.anim.baseLayer.transition('Flip', 0.2);
    idleIn = flipLength;
});

// Turn the character slowly, and go back to idling after the flip
app.on('update', (dt) => {
    character.rotateLocal(0, dt * 20, 0);
    if (idleIn > 0) {
        idleIn -= dt;
        if (idleIn <= 0) {
            character.anim.baseLayer.transition('Idle', 0.3);
        }
    }
});

// The portrait beside the details on landscape canvases, and above them on portrait ones
const layout = () => {
    const portraitCanvas = device.height > device.width;
    const reference = portraitCanvas ? new Vec2(540, 960) : new Vec2(1280, 720);
    screen.screen.referenceResolution = reference;
    screen.screen.scaleBlend = device.width / reference.x > device.height / reference.y ? 1 : 0;
    card.element.width = portraitCanvas ? 480 : 720;
    card.element.height = portraitCanvas ? 820 : 440;
    frame.setLocalPosition(portraitCanvas ? 0 : -160, portraitCanvas ? 190 : 0, 0);
    details.setLocalPosition(portraitCanvas ? -200 : 40, portraitCanvas ? -40 : 180, 0);
    emote.setLocalPosition(portraitCanvas ? 0 : 150, portraitCanvas ? -330 : -160, 0);
};
device.on('resizecanvas', layout);
layout();

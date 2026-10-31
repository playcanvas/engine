// @config
//
// Ability buttons whose cooldown is drawn by a **ShaderMaterial** on an image element: a shaded
// circle that sweeps away clockwise, driven by a uniform. Click an ability to cast it, then wait
// for it to be ready again.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_NORMAL,
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
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    ScreenComponentSystem,
    SPRITE_RENDERMODE_SLICED,
    ShaderMaterial,
    Sprite,
    TextureAtlasHandler,
    TextureHandler,
    Vec2,
    createGraphicsDevice
} from 'playcanvas';

import { uiAtlasData } from 'examples/assets/ui/ui-atlas.mjs';
import { deviceType } from 'examples/context';

import fragmentGLSL from './shader.glsl.frag';
import vertexGLSL from './shader.glsl.vert';
import fragmentWGSL from './shader.wgsl.frag';
import vertexWGSL from './shader.wgsl.vert';

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

const LIGHT = new Color(0.95, 0.96, 0.98);
const MUTED = new Color(0.6, 0.64, 0.72);
const SLATE = new Color(0.22, 0.25, 0.32);
const PANEL = new Color(0.14, 0.16, 0.2);

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
// less room, so the abilities stay on screen
const layout = () => {
    const portrait = device.height > device.width;
    const reference = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
    screen.screen.referenceResolution = reference;
    screen.screen.scaleBlend = device.width / reference.x > device.height / reference.y ? 1 : 0;
};
device.on('resizecanvas', layout);
layout();

const atlas = assets.ui.resource;
const circle = new Sprite(device, { atlas, frameKeys: ['circle'] });
const rounded = new Sprite(device, {
    atlas,
    frameKeys: ['panel'],
    pixelsPerUnit: 2,
    renderMode: SPRITE_RENDERMODE_SLICED
});
const sprites = [circle, rounded];

/**
 * Create a material that draws the cooldown shader. The UI layer only draws materials that
 * blend, so it blends normally and doesn't write depth. A custom material replaces the element's
 * own handling of color and opacity, so the shading color is a uniform of its own.
 *
 * @returns {ShaderMaterial} The material.
 */
const createCooldownMaterial = () => {
    const material = new ShaderMaterial({
        uniqueName: 'cooldown',
        vertexGLSL,
        fragmentGLSL,
        vertexWGSL,
        fragmentWGSL,
        attributes: {
            vertex_position: SEMANTIC_POSITION,
            vertex_texCoord0: SEMANTIC_TEXCOORD0
        }
    });
    material.blendType = BLEND_NORMAL;
    material.depthWrite = false;
    material.setParameter('uColor', [0.02, 0.02, 0.03, 0.75]);
    material.setParameter('uProgress', 0);
    material.update();
    return material;
};

/**
 * Create an element, centered on its parent.
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
        ...properties
    });
    parent.addChild(entity);
    return entity;
};

/**
 * Create an ability: a round button with an icon, a cooldown drawn over it by the custom
 * material, and the seconds left.
 *
 * @param {string} name - The name of the ability.
 * @param {string} iconFrame - The frame of the icon in the UI kit.
 * @param {Color} color - The color of the icon.
 * @param {number} x - The horizontal position.
 * @param {number} duration - The cooldown in seconds.
 * @returns {object} The ability.
 */
const createAbility = (name, iconFrame, color, x, duration) => {
    const button = createElement(screen, name, {
        sprite: circle,
        color: SLATE,
        width: 180,
        height: 180,
        useInput: true
    });
    button.setLocalPosition(x, 35, 0);
    button.addComponent('button', {
        imageEntity: button,
        hoverTint: new Color(0.29, 0.33, 0.42),
        pressedTint: new Color(0.17, 0.19, 0.25),
        inactiveTint: SLATE
    });

    const icon = new Sprite(device, { atlas, frameKeys: [iconFrame] });
    sprites.push(icon);
    createElement(button, 'icon', { sprite: icon, color, width: 96, height: 96 });

    // the cooldown covers the icon, and is only shown while it runs
    const material = createCooldownMaterial();
    const overlay = createElement(button, 'cooldown', { material, width: 180, height: 180 });
    const seconds = createElement(button, 'seconds', {
        type: ELEMENTTYPE_TEXT,
        fontAsset: assets.bold.id,
        fontSize: 52,
        color: LIGHT,
        text: ''
    });
    overlay.enabled = false;
    seconds.enabled = false;
    createElement(screen, `${name} label`, {
        type: ELEMENTTYPE_TEXT,
        fontAsset: assets.font.id,
        text: name,
        fontSize: 26,
        color: MUTED
    }).setLocalPosition(x, -98, 0);

    return { button, material, overlay, seconds, duration, left: 0 };
};

/**
 * Cast an ability, which starts its cooldown and makes its button inactive until it is over.
 *
 * @param {object} ability - The ability.
 * @param {number} [left] - The seconds of cooldown left, the whole cooldown by default.
 */
const cast = (ability, left = ability.duration) => {
    ability.left = left;
    ability.button.button.active = false;
    ability.overlay.enabled = true;
    ability.seconds.enabled = true;
};

// The action bar the abilities sit on
createElement(screen, 'action bar', { sprite: rounded, color: PANEL, width: 520, height: 330 });

const abilities = [
    createAbility('Lightning', 'icon-bolt', new Color(1, 0.85, 0.3), -120, 3),
    createAbility('Fireball', 'icon-flame', new Color(1, 0.5, 0.2), 120, 6)
];
abilities.forEach((ability) => ability.button.button.on('click', () => cast(ability)));
app.on('destroy', () => {
    sprites.forEach((sprite) => sprite.destroy());
    abilities.forEach(({ material }) => material.destroy());
});

// Run the cooldowns: update the shader's uniform every frame, and the seconds when they change
app.on('update', (dt) => {
    for (const ability of abilities) {
        if (ability.left <= 0) {
            continue;
        }
        ability.left = Math.max(ability.left - dt, 0);
        ability.material.setParameter('uProgress', ability.left / ability.duration);

        const text = String(Math.ceil(ability.left));
        if (ability.seconds.element.text !== text) {
            ability.seconds.element.text = text;
        }
        if (ability.left === 0) {
            ability.button.button.active = true;
            ability.overlay.enabled = false;
            ability.seconds.enabled = false;
        }
    }
});

// Start with the fireball part of the way through its cooldown
cast(abilities[1], 4);

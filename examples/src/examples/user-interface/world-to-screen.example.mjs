// @config
//
// An arena whose fighters have name tags and health bars. Each tag is a screen-space element, placed
// over its fighter every frame with the camera's **worldToScreen**, so it stays the same size at any
// distance. Tags fade with distance, and hide when their fighter is off screen. Tap one to hit it.

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
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SCALEMODE_BLEND,
    SHADOW_PCF3_32F,
    SPRITE_RENDERMODE_SLICED,
    ScreenComponentSystem,
    Sprite,
    StandardMaterial,
    TextureAtlasHandler,
    TextureHandler,
    Vec2,
    Vec3,
    Vec4,
    createGraphicsDevice,
    math
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

/**
 * Create a material of one color.
 *
 * @param {number[]} rgb - The color.
 * @returns {StandardMaterial} The material.
 */
const createMaterial = (rgb) => {
    const material = new StandardMaterial();
    material.diffuse = new Color(...rgb);
    material.gloss = 0.4;
    material.update();
    return material;
};

// The arena: a floor, lit from above, and a camera looking down at it
app.scene.ambientLight = new Color(0.3, 0.32, 0.38);
const floor = new Entity('floor');
floor.addComponent('render', { type: 'plane', material: createMaterial([0.24, 0.26, 0.32]) });
floor.setLocalScale(200, 1, 200);
app.root.addChild(floor);

const light = new Entity('light');
light.addComponent('light', {
    type: 'directional',
    castShadows: true,
    shadowType: SHADOW_PCF3_32F,
    shadowDistance: 30,
    shadowBias: 0.2,
    normalOffsetBias: 0.05
});
light.setLocalEulerAngles(50, 30, 0);
app.root.addChild(light);

const camera = new Entity('camera');
camera.addComponent('camera', { clearColor: new Color(0.1, 0.11, 0.13), fov: 45 });
camera.setPosition(0, 7, 12);
camera.lookAt(0, 0, 0);
app.root.addChild(camera);

// The screen the tags are on
const screen = new Entity('screen');
screen.addComponent('screen', {
    screenSpace: true,
    referenceResolution: [1280, 720],
    scaleMode: SCALEMODE_BLEND,
    scaleBlend: 0.5
});
app.root.addChild(screen);

const atlas = assets.ui.resource;
const track = new Sprite(device, {
    atlas,
    frameKeys: ['track'],
    pixelsPerUnit: 4,
    renderMode: SPRITE_RENDERMODE_SLICED
});
app.on('destroy', () => track.destroy());
const DARK = new Color(0.05, 0.05, 0.07);
const GREEN = new Color(0.35, 0.85, 0.35);
const RED = new Color(0.95, 0.3, 0.25);

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
    entity.addComponent('element', { anchor: [0.5, 0.5, 0.5, 0.5], pivot: [0.5, 0.5], ...properties });
    parent.addChild(entity);
    return entity;
};

// The fighters walk around the arena, each on a circle of its own
const fighters = [
    ['Aria', [1, 0.55, 0.2], 2.5, 0.5],
    ['Brom', [0.3, 0.6, 1], 4.5, -0.3],
    ['Cai', [0.45, 0.8, 0.4], 6.5, 0.2],
    ['Dara', [0.7, 0.45, 0.95], 4, 0.4]
].map(([name, color, radius, speed], i) => {
    const body = new Entity(name);
    body.addComponent('render', { type: 'capsule', material: createMaterial(color) });
    body.setLocalScale(0.8, 1, 0.8);
    app.root.addChild(body);

    // The tag is anchored to the bottom-left corner of the screen, and its pivot is the middle of
    // its bottom edge, so it sits over the point it is placed at. Tapping it hits the fighter
    const tag = createElement(screen, `${name} tag`, {
        type: ELEMENTTYPE_GROUP,
        anchor: [0, 0, 0, 0],
        pivot: [0.5, 0],
        width: 140,
        height: 56,
        useInput: true
    });
    const label = createElement(tag, 'name', {
        type: ELEMENTTYPE_TEXT,
        fontAsset: assets.font.id,
        text: name,
        fontSize: 24,
        outlineColor: DARK,
        outlineThickness: 0.5
    });
    label.setLocalPosition(0, 10, 0);

    // The health bar: a dark track, and a fill whose right anchor is the fraction of health left
    const bar = createElement(tag, 'bar', {
        type: ELEMENTTYPE_IMAGE,
        sprite: track,
        color: DARK,
        width: 120,
        height: 12
    });
    bar.setLocalPosition(0, -14, 0);
    const health = createElement(bar, 'health', {
        type: ELEMENTTYPE_IMAGE,
        sprite: track,
        color: GREEN,
        anchor: [0, 0, 1, 1],
        margin: [2, 2, 2, 2]
    });

    const fighter = { body, parts: [label, bar, health], tag, hp: 1, radius, speed, angle: i * 1.7 };
    tag.element.on('click', () => {
        fighter.hp = fighter.hp > 0.3 ? fighter.hp - 0.25 : 1;
        health.element.anchor = new Vec4(0, 0, fighter.hp, 1);
        health.element.color = new Color().lerp(RED, GREEN, fighter.hp);
    });
    return fighter;
});

// One update handler walks the fighters and places their tags. worldToScreen gives CSS pixels from
// the canvas's top-left corner, and the tags are placed in the screen's units from its bottom-left
const head = new Vec3();
const view = new Vec3();
const onCanvas = new Vec3();
const overHead = new Vec3(0, 1.4, 0);
app.on('update', (dt) => {
    const units = canvas.width / canvas.clientWidth / screen.screen.scale;
    fighters.forEach((fighter) => {
        const { body, tag, parts, radius, speed } = fighter;
        fighter.angle += dt * speed;
        body.setPosition(radius * Math.sin(fighter.angle), 1, radius * Math.cos(fighter.angle));

        head.add2(body.getPosition(), overHead);
        camera.camera.worldToScreen(head, onCanvas);

        // Hide the tag when its fighter is behind the camera, which the depth in view space tells,
        // or off the canvas
        camera.camera.viewMatrix.transformPoint(head, view);
        tag.enabled =
            view.z < 0 &&
            onCanvas.x > 0 &&
            onCanvas.x < canvas.clientWidth &&
            onCanvas.y > 0 &&
            onCanvas.y < canvas.clientHeight;
        if (tag.enabled) {
            tag.setLocalPosition(onCanvas.x * units, (canvas.clientHeight - onCanvas.y) * units, 0);

            // Fade the tags of distant fighters, so that the nearest ones stand out
            const opacity = math.clamp(2.2 - -view.z / 10, 0.35, 1);
            for (const part of parts) {
                part.element.opacity = opacity;
            }
        }
    });
});

// On portrait canvases, fit the arena to the width of the view rather than its height, and use a
// portrait reference resolution for the tags
const layout = () => {
    const portrait = device.height > device.width;
    camera.camera.horizontalFov = portrait;
    screen.screen.referenceResolution = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
};
device.on('resizecanvas', layout);
layout();

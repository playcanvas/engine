import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BUTTON_TRANSITION_MODE_SPRITE_CHANGE,
    ButtonComponentSystem,
    CameraComponentSystem,
    Color,
    ELEMENTTYPE_IMAGE,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_NEAREST,
    FontHandler,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SCALEMODE_BLEND,
    SPRITE_RENDERMODE_SIMPLE,
    ScreenComponentSystem,
    Sprite,
    TextureAtlas,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec4,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    font: new Asset('font', 'font', { url: './assets/fonts/courier.json' }),
    red_button_atlas: new Asset(
        'red_button_atlas',
        'texture',
        {
            url: './assets/button/red_button_atlas.png'
        },
        { srgb: true }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.elementInput = new ElementInput(canvas);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    ScreenComponentSystem,
    ButtonComponentSystem,
    ElementComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, FontHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Create a camera
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(30 / 255, 30 / 255, 30 / 255)
});
app.root.addChild(camera);

// Create a 2D screen
const screen = new Entity();
screen.addComponent('screen', {
    referenceResolution: new Vec2(1280, 720),
    scaleBlend: 0.5,
    scaleMode: SCALEMODE_BLEND,
    screenSpace: true
});
app.root.addChild(screen);

// Create a simple button
const button = new Entity();
button.addComponent('button', {
    active: true,
    transitionMode: BUTTON_TRANSITION_MODE_SPRITE_CHANGE
});
button.addComponent('element', {
    anchor: [0.5, 0.5, 0.5, 0.5],
    height: 64,
    pivot: [0.5, 0.5],
    type: ELEMENTTYPE_IMAGE,
    width: 175,
    useInput: true
});
screen.addChild(button);

// Create a label for the button
const label = new Entity();
label.addComponent('element', {
    anchor: [0.5, 0.5, 0.5, 0.5],
    color: new Color(1, 1, 1),
    fontAsset: assets.font.id,
    fontSize: 32,
    height: 64,
    opacity: 0.5,
    pivot: [0.5, 0.5],
    text: 'CLICK ME',
    type: ELEMENTTYPE_TEXT,
    width: 128,
    wrapLines: true
});
button.addChild(label);

// Change the background color every time the button is clicked
button.button.on('click', () => {
    const r = Math.random();
    camera.camera.clearColor = new Color(r, r, r);
});

// Move the button's label with the animation of the sprite
button.button.on('pressedstart', () => {
    label.translateLocal(0, -4, 0);
});
button.button.on('pressedend', () => {
    label.translateLocal(0, 4, 0);
});

// Apply the font to the text element
const texture = assets.red_button_atlas.resource;
texture.addressU = ADDRESS_CLAMP_TO_EDGE;
texture.addressV = ADDRESS_CLAMP_TO_EDGE;
texture.minFilter = FILTER_NEAREST;
texture.magFilter = FILTER_NEAREST;

const atlas = new TextureAtlas();
atlas.frames = {
    0: {
        rect: new Vec4(0, 147, 190, 49),
        pivot: new Vec2(0.5, 0.5),
        border: new Vec4(7, 11, 7, 7)
    },
    1: {
        rect: new Vec4(0, 98, 190, 49),
        pivot: new Vec2(0.5, 0.5),
        border: new Vec4(7, 11, 7, 7)
    },
    2: {
        rect: new Vec4(0, 49, 190, 49),
        pivot: new Vec2(0.5, 0.5),
        border: new Vec4(7, 11, 7, 7)
    },
    3: {
        rect: new Vec4(0, 0, 190, 49),
        pivot: new Vec2(0.5, 0.5),
        border: new Vec4(7, 11, 7, 7)
    }
};
atlas.texture = texture;

/**
 * @param {string} frame - Frame key for Sprite.
 * @returns {Asset} The asset.
 */
const createSpriteAsset = (frame) => {
    const sprite = new Sprite(app.graphicsDevice, {
        atlas: atlas,
        frameKeys: [frame],
        pixelsPerUnit: 1,
        renderMode: SPRITE_RENDERMODE_SIMPLE
    });

    const spriteAsset = new Asset('sprite', 'sprite', { url: '' });
    spriteAsset.resource = sprite;
    spriteAsset.loaded = true;
    app.assets.add(spriteAsset);
    return spriteAsset;
};

button.element.spriteAsset = createSpriteAsset('0').id;
button.button.hoverSpriteAsset = createSpriteAsset('1');
button.button.pressedSpriteAsset = createSpriteAsset('2');
button.button.inactiveSpriteAsset = createSpriteAsset('3');

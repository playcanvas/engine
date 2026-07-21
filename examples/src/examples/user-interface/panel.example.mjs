// 9-scaled image rendering, using an asset from https://help.umajin.com/nine-slice-tutorial/
import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ELEMENTTYPE_IMAGE,
    ElementComponentSystem,
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_NEAREST,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SCALEMODE_BLEND,
    SPRITE_RENDERMODE_SIMPLE,
    SPRITE_RENDERMODE_SLICED,
    ScreenComponentSystem,
    Sprite,
    TextureAtlas,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec4,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    grey_button: new Asset(
        'grey_button',
        'texture',
        {
            url: './assets/button/grey_button.png'
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
    ElementComponentSystem
];
createOptions.resourceHandlers = [TextureHandler];

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

// Create a simple panel
const panel = new Entity();
panel.addComponent('element', {
    anchor: [0.5, 0.5, 0.5, 0.5],
    width: 400,
    height: 200,
    pivot: [0.5, 0.5],
    type: ELEMENTTYPE_IMAGE,
    useInput: true
});
screen.addChild(panel);

// Prepare the atlas with a single frame
const texture = assets.grey_button.resource;
texture.addressU = ADDRESS_CLAMP_TO_EDGE;
texture.addressV = ADDRESS_CLAMP_TO_EDGE;
texture.minFilter = FILTER_NEAREST;
texture.magFilter = FILTER_NEAREST;

const atlas = new TextureAtlas();
atlas.frames = {
    0: {
        // x, y, width, height properties of the frame in pixels
        rect: new Vec4(0, 0, 240, 135),

        // The pivot of the frame - values are between 0-1
        pivot: new Vec2(0.5, 0.5),

        // Nine-slice border: left, bottom, right, top border in pixels
        border: new Vec4(21, 28, 21, 33)
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
        renderMode: SPRITE_RENDERMODE_SLICED
    });

    const spriteAsset = new Asset('sprite', 'sprite', { url: '' });
    spriteAsset.resource = sprite;
    spriteAsset.loaded = true;
    app.assets.add(spriteAsset);
    return spriteAsset;
};

panel.element.spriteAsset = createSpriteAsset('0').id;

// Animation variables
let scaleXDirection = 1;
let scaleYDirection = 1;
const scaleXSpeed = 3;
const scaleYSpeed = 1.5;

app.on('update', (_dt) => {
    const currentWidth = panel.element.width;
    const currentHeight = panel.element.height;

    let targetWidth = currentWidth + scaleXDirection * scaleXSpeed;
    let targetHeight = currentHeight + scaleYDirection * scaleYSpeed;

    // Bounce logic for width
    if (targetWidth > 800) {
        targetWidth = 800;
        scaleXDirection = -1;
    } else if (targetWidth < 100) {
        targetWidth = 100;
        scaleXDirection = 1;
    }

    // Bounce logic for height
    if (targetHeight > 676) {
        targetHeight = 676;
        scaleYDirection = -1;
    } else if (targetHeight < 100) {
        targetHeight = 100;
        scaleYDirection = 1;
    }

    panel.element.width = targetWidth;
    panel.element.height = targetHeight;
});

// Apply UI changes
data.on('*:set', (/** @type {string} */ path, value) => {
    if (path === 'data.sliced') {
        panel.element.sprite.renderMode = value ? SPRITE_RENDERMODE_SLICED : SPRITE_RENDERMODE_SIMPLE;
    }
});

// Set initial values
data.set('data', {
    sliced: true
});

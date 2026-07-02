// @config
//
// Demonstrates UI masking with the element system. A mask is an
// ELEMENTTYPE_IMAGE element with `mask: true` - its children are rendered only
// where the mask passes the stencil test. The top panel clips scrolling
// content to a rectangle, while the bottom panel clips it to the alpha shape of
// a heart texture (the visible region follows the texture's opaque pixels).

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ELEMENTTYPE_IMAGE,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SCALEMODE_BLEND,
    ScreenComponentSystem,
    TextureHandler,
    Vec2,
    Vec4,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    colors: new Asset('colors', 'texture', { url: './assets/textures/colors.webp' }),
    heart: new Asset('heart', 'texture', { url: './assets/textures/heart.png' }),
    font: new Asset('font', 'font', { url: './assets/fonts/courier.json' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    ScreenComponentSystem,
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
const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.12)
});
app.root.addChild(camera);

// Create a 2D screen
const screen = new Entity('Screen');
screen.addComponent('screen', {
    referenceResolution: new Vec2(1280, 720),
    scaleBlend: 0.5,
    scaleMode: SCALEMODE_BLEND,
    screenSpace: true
});
app.root.addChild(screen);

/**
 * Creates a screen-space text label.
 * @param {string} text - The label text.
 * @param {number} x - The horizontal offset from the screen center.
 * @param {number} y - The vertical offset from the screen center.
 * @param {number} fontSize - The font size.
 */
const createLabel = (text, x, y, fontSize) => {
    const label = new Entity(`Label: ${text}`);
    label.addComponent('element', {
        type: ELEMENTTYPE_TEXT,
        anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
        pivot: new Vec2(0.5, 0.5),
        fontAsset: assets.font.id,
        fontSize: fontSize,
        text: text,
        color: new Color(1, 1, 1)
    });
    label.setLocalPosition(x, y, 0);
    screen.addChild(label);
};

// --- Panel A: rectangular mask (top) -------------------------------------
// The mask is a plain image element (no texture), so its rectangle defines
// the masked region. A row of square tiles (matching the square source
// texture, so it renders undistorted) scrolls horizontally behind it on a
// treadmill, and is continuously clipped at the left and right edges of the
// rectangle.
const rectWidth = 440;
const rectHeight = 190;

const rectMask = new Entity('RectMask');
rectMask.addComponent('element', {
    type: ELEMENTTYPE_IMAGE,
    anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
    pivot: new Vec2(0.5, 0.5),
    width: rectWidth,
    height: rectHeight,
    mask: true
});
rectMask.setLocalPosition(0, 155, 0);
screen.addChild(rectMask);

// Square tiles the height of the mask, enough of them to cover the masked
// width with room to wrap around seamlessly as they scroll.
const tileSize = rectHeight;
const tileCount = 5;
const tileTotal = tileSize * tileCount;
const rectContent = [];
for (let i = 0; i < tileCount; i++) {
    const content = new Entity(`RectContent: ${i}`);
    content.addComponent('element', {
        type: ELEMENTTYPE_IMAGE,
        anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
        pivot: new Vec2(0.5, 0.5),
        width: tileSize,
        height: tileSize,
        textureAsset: assets.colors.id
    });
    rectMask.addChild(content);
    rectContent.push(content);
}

createLabel('Rectangular mask', 0, 25, 26);

// --- Panel B: alpha-shaped mask (bottom) ---------------------------------
// The mask uses the heart texture. As the mask material runs an alpha test,
// the visible region follows the heart's opaque pixels rather than a
// rectangle. The content drifts behind it, and the heart itself "beats" by
// animating the mask element's size.
const heartSize = 230;

const heartMask = new Entity('HeartMask');
heartMask.addComponent('element', {
    type: ELEMENTTYPE_IMAGE,
    anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
    pivot: new Vec2(0.5, 0.5),
    width: heartSize,
    height: heartSize,
    textureAsset: assets.heart.id,
    mask: true
});
heartMask.setLocalPosition(0, -150, 0);
screen.addChild(heartMask);

// Content is larger than the heart so it always covers it as it drifts.
const heartContent = new Entity('HeartContent');
heartContent.addComponent('element', {
    type: ELEMENTTYPE_IMAGE,
    anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
    pivot: new Vec2(0.5, 0.5),
    width: 380,
    height: 380,
    textureAsset: assets.colors.id
});
heartMask.addChild(heartContent);

createLabel('Heart alpha mask', 0, -295, 26);

// Animate the content. Time only advances while animation is enabled, so
// toggling it off freezes the scene in place.
let time = 0;
app.on('update', (dt) => {
    if (data.get('data.animate')) {
        time += dt;
    }

    // Panel A: scroll the row of square tiles on a treadmill. Each tile is
    // wrapped around a belt as wide as all tiles combined, so the strip
    // scrolls continuously and is clipped at the rectangle edges.
    const scrollX = (time * 100) % tileTotal;
    for (let i = 0; i < tileCount; i++) {
        let x = (i * tileSize - scrollX) % tileTotal;
        if (x < 0) x += tileTotal;
        x -= tileTotal / 2;
        rectContent[i].setLocalPosition(x, 0, 0);
    }

    // Panel B: drift the content and pulse the heart-shaped mask.
    heartContent.setLocalPosition(40 * Math.sin(time * 0.7), 35 * Math.sin(time * 1.1), 0);
    const beat = heartSize + 20 * Math.sin(time * 2.5);
    heartMask.element.width = beat;
    heartMask.element.height = beat;
});

// Toggle masking on both elements. With masking off the content renders
// unclipped, which shows what the mask is actually hiding.
data.on('*:set', (/** @type {string} */ path, value) => {
    if (path === 'data.mask') {
        rectMask.element.mask = value;
        heartMask.element.mask = value;
    }
});

// set initial control values
data.set('data', {
    animate: true,
    mask: true
});

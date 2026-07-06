import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
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

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
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
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.85, 0.85, 0.85)
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

/**
 * Create a text element.
 *
 * @param {number} x - Local x position.
 * @param {number} y - Local y position.
 * @param {object} options - Options to merge into the element component data.
 * @returns {Entity} The created entity.
 */
const createText = (x, y, options) => {
    const entity = new Entity();
    entity.setLocalPosition(x, y, 0);
    entity.addComponent('element', {
        pivot: new Vec2(0.5, 0.5),
        anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
        fontAsset: assets.font.id,
        fontSize: 36,
        type: ELEMENTTYPE_TEXT,
        ...options
    });
    screen.addChild(entity);
    return entity;
};

// Each row renders the same text twice: with markup disabled (left) and enabled (right). The two
// sides must look identical - a color difference indicates a gamma space handling bug in the
// per-vertex (markup) color path.
const columnX = 300;

createText(-columnX, 300, { text: 'Markup OFF', fontSize: 48, color: new Color().fromString('#000000') });
createText(columnX, 300, { text: 'Markup ON', fontSize: 48, color: new Color().fromString('#000000') });

// element color, no tags
createText(-columnX, 200, {
    text: 'Element color #454A53',
    color: new Color().fromString('#454A53')
});
createText(columnX, 200, {
    text: 'Element color #454A53',
    color: new Color().fromString('#454A53'),
    enableMarkup: true
});

// color tags
createText(-columnX, 100, {
    text: 'Color tag #803333',
    color: new Color().fromString('#803333')
});
createText(columnX, 100, {
    text: '[color="#803333"]Color tag #803333[/color]',
    enableMarkup: true
});

// outline color and thickness
createText(-columnX, 0, {
    text: 'Outline #204080',
    color: new Color().fromString('#B0B8C4'),
    outlineColor: new Color().fromString('#204080'),
    outlineThickness: 0.6
});
createText(columnX, 0, {
    text: '[outline color="#204080" thickness="0.6"]Outline #204080[/outline]',
    color: new Color().fromString('#B0B8C4'),
    enableMarkup: true
});

// shadow color and offset
createText(-columnX, -100, {
    text: 'Shadow #663311',
    color: new Color().fromString('#B0B8C4'),
    shadowColor: new Color().fromString('#663311'),
    shadowOffset: new Vec2(0.25, -0.25)
});
createText(columnX, -100, {
    text: '[shadow color="#663311" offsetX="0.25" offsetY="-0.25"]Shadow #663311[/shadow]',
    color: new Color().fromString('#B0B8C4'),
    enableMarkup: true
});

// mixed tags in one string
createText(0, -220, {
    text:
        'Mixed: [color="#803333"]red[/color] plain [color="#204080"]blue[/color] ' +
        '[outline color="#663311" thickness="0.5"]outlined[/outline] ' +
        '[shadow color="#803333" offsetX="0.2" offsetY="-0.2"]shadowed[/shadow]',
    color: new Color().fromString('#454A53'),
    enableMarkup: true,
    fontSize: 30
});

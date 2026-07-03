import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    ButtonComponentSystem,
    CameraComponentSystem,
    Color,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    LayoutGroupComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SCALEMODE_BLEND,
    ScreenComponentSystem,
    ScrollViewComponentSystem,
    ScrollbarComponentSystem,
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
    font: new Asset('font', 'font', { url: './assets/fonts/courier.json' })
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
    ElementComponentSystem,
    LayoutGroupComponentSystem,
    ScrollViewComponentSystem,
    ScrollbarComponentSystem
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

await new Promise(resolve => {
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

// Basic Text
const textBasic = new Entity();
textBasic.setLocalPosition(0, 200, 0);
textBasic.addComponent('element', {
    pivot: new Vec2(0.5, 0.5),
    anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
    fontAsset: assets.font.id,
    fontSize: 42,
    text: 'Basic Text',
    type: ELEMENTTYPE_TEXT
});
screen.addChild(textBasic);

// Markup Text with wrap
const textMarkup = new Entity();
textMarkup.setLocalPosition(0, 50, 0);
textMarkup.addComponent('element', {
    pivot: new Vec2(0.5, 0.5),
    anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
    fontAsset: assets.font.id,
    fontSize: 32,
    text: 'There are seven colors in the rainbow: [color="#ff0000"]red[/color], [color="#ffa500"]orange[/color], [color="#ffff00"]yellow[/color], [color="#00ff00"]green[/color], [color="#0000ff"]blue[/color], [color="#4b0082"]indigo[/color] and [color="#7f00ff"]violet[/color].',
    width: 500,
    height: 100,
    autoWidth: false,
    autoHeight: false,
    wrapLines: true,
    enableMarkup: true,
    type: ELEMENTTYPE_TEXT
});
screen.addChild(textMarkup);

// Text with outline
const textOutline = new Entity();
textOutline.setLocalPosition(0, -100, 0);
textOutline.addComponent('element', {
    pivot: new Vec2(0.5, 0.5),
    anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
    fontAsset: assets.font.id,
    fontSize: 62,
    text: 'Outline',
    color: new Color(0, 0, 0),
    outlineColor: new Color(1, 1, 1),
    outlineThickness: 0.75,
    type: ELEMENTTYPE_TEXT
});
screen.addChild(textOutline);

// Text with drop shadow
const textDropShadow = new Entity();
textDropShadow.setLocalPosition(0, -200, 0);
textDropShadow.addComponent('element', {
    pivot: new Vec2(0.5, 0.5),
    anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
    fontAsset: assets.font.id,
    fontSize: 62,
    text: 'Drop Shadow',
    shadowColor: new Color(1, 0, 0),
    shadowOffset: new Vec2(0.25, -0.25),
    type: ELEMENTTYPE_TEXT
});
screen.addChild(textDropShadow);

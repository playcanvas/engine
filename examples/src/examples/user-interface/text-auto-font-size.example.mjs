import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
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

// Create a container entity with an image component
const autoFontSizeContainer = new Entity();
autoFontSizeContainer.addComponent('element', {
    pivot: new Vec2(0.5, 0.5),
    anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
    width: 220,
    height: 50,
    color: new Color(60 / 255, 60 / 255, 60 / 255),
    type: ELEMENTTYPE_IMAGE
});
// Create a text element with auto font size, and place it inside the container
const autoFontSizeText = new Entity();
autoFontSizeText.addComponent('element', {
    // place the text taking the entire parent space
    pivot: new Vec2(0.5, 0.5),
    anchor: new Vec4(0, 0, 1, 1),
    margin: new Vec4(0, 0, 0, 0),
    fontAsset: assets.font.id,
    autoWidth: false,
    autoHeight: false,
    autoFitWidth: true,
    autoFitHeight: true,
    minFontSize: 10,
    maxFontSize: 100,
    text: 'Auto font size!',
    type: ELEMENTTYPE_TEXT
});
screen.addChild(autoFontSizeContainer);
autoFontSizeContainer.addChild(autoFontSizeText);

// update the container's size to showcase the auto-sizing feature
let time = 0;
app.on('update', dt => {
    time += dt;
    autoFontSizeContainer.element.width = 280 + Math.sin(time) * 80;
    autoFontSizeContainer.element.height = 60 + Math.sin(time * 0.5) * 50;
});

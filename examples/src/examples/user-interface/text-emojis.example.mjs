import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    ButtonComponentSystem,
    CameraComponentSystem,
    CanvasFont,
    Color,
    ELEMENTTYPE_GROUP,
    ELEMENTTYPE_IMAGE,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    FITTING_BOTH,
    FontHandler,
    LayoutChildComponentSystem,
    LayoutGroupComponentSystem,
    Mouse,
    ORIENTATION_HORIZONTAL,
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
    font: new Asset('font', 'font', { url: './assets/fonts/arial.json' })
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
    ScrollbarComponentSystem,
    LayoutChildComponentSystem
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

// Some sample text
const firstLineText = 'PlayCanvas supports Emojis via CanvasFont!';
const flagsText = 'Flags: 🇺🇸🇩🇪🇮🇪🇮🇹🏴‍☠️🇨🇦';
const complexText = 'Complex emoji: 👨🏿3️⃣👁️‍🗨️';

// Create a canvas font asset
const size = 64;
const elSize = 32;

const canvasFont = new CanvasFont(app, {
    color: new Color(1, 1, 1), // white
    fontName: 'Arial',
    fontSize: size,
    width: 256,
    height: 256
});

// The first texture update needs to be `createTextures()`. Follow-up calls need to be `updateTextures()`.
canvasFont.createTextures(firstLineText);
canvasFont.updateTextures(flagsText);
canvasFont.updateTextures(complexText);

/**
 * Create the text entities.
 * @param {number} y - The y coordinate.
 * @param {string} text - The element component's text.
 */
function createText(y, text) {
    const canvasElementEntity = new Entity();
    canvasElementEntity.setLocalPosition(0, y, 0);
    canvasElementEntity.addComponent('element', {
        pivot: new Vec2(0.5, 0.5),
        anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
        fontSize: elSize,
        text: text,
        type: ELEMENTTYPE_TEXT
    });
    canvasElementEntity.element.font = canvasFont;
    screen.addChild(canvasElementEntity);
}
createText(225, firstLineText);
createText(150, flagsText);
createText(100, complexText);

// Canvas Fonts Debug - you shouldn't do this in your actual project
const debugText = new Entity();
debugText.setLocalPosition(0, -50, 0);
debugText.addComponent('element', {
    pivot: new Vec2(0.5, 0.5),
    anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
    fontAsset: assets.font.id,
    fontSize: elSize,
    text: "The following are the CanvasFont's Texture Atlases,\ncontaining all the rendered characters:",
    type: ELEMENTTYPE_TEXT
});
screen.addChild(debugText);

// Create Layout Group Entity
const group = new Entity();
group.setLocalPosition(0, -150, 0);
group.addComponent('element', {
    // A Layout Group needs a 'group' element component
    type: ELEMENTTYPE_GROUP,
    anchor: [0.5, 0.5, 0.5, 0.5],
    pivot: [0.5, 0.5],
    // The element's width and height dictate the group's bounds
    width: 300,
    height: 100
});
group.addComponent('layoutgroup', {
    orientation: ORIENTATION_HORIZONTAL,
    // fit_both for width and height, making all child elements take the entire space
    widthFitting: FITTING_BOTH,
    heightFitting: FITTING_BOTH,
    // Wrap children
    wrap: true
});
screen.addChild(group);

// Create 1 child per texture
for (let i = 0; i < canvasFont.textures.length; i++) {
    const texture = canvasFont.textures[i];

    // Create a random-colored panel
    const child = new Entity();
    child.addComponent('element', {
        anchor: [0.5, 0.5, 0.5, 0.5],
        pivot: [0.5, 0.5],
        texture: texture,
        type: ELEMENTTYPE_IMAGE
    });
    child.addComponent('layoutchild', {
        excludeFromLayout: false
    });
    group.addChild(child);
}

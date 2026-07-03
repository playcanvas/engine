import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BUTTON_TRANSITION_MODE_TINT,
    ButtonComponentSystem,
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
    LayoutGroupComponentSystem,
    Mouse,
    ORIENTATION_HORIZONTAL,
    ORIENTATION_VERTICAL,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SCALEMODE_BLEND,
    SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED,
    SCROLL_MODE_BOUNCE,
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
app.root.addChild(camera);

camera.addComponent('camera', {
    clearColor: new Color(30 / 255, 30 / 255, 30 / 255)
});

// Create a 2D screen
const screen = new Entity();
app.root.addChild(screen);

screen.addComponent('screen', {
    screenSpace: true,
    referenceResolution: new Vec2(1280, 720),
    scaleMode: SCALEMODE_BLEND,
    scaleBlend: 0.5
});
/**
 * @param {boolean} horizontal - True means horizontal, false means vertical.
 * @returns {Entity} The returned entity.
 */
function createScrollbar(horizontal) {
    const handle = new Entity('Handle');
    const handleOptions = {
        type: ELEMENTTYPE_IMAGE,
        color: new Color(1, 1, 1),
        opacity: 1,
        margin: new Vec4(0, 0, 0, 0),
        rect: new Vec4(0, 0, 1, 1),
        mask: false,
        useInput: true
    };
    if (horizontal) {
        // @ts-ignore engine-tsd
        handleOptions.anchor = new Vec4(0, 0, 0, 1); // Split in Y
        // @ts-ignore engine-tsd
        handleOptions.pivot = new Vec2(0, 0); // Bottom left
    } else {
        // @ts-ignore engine-tsd
        handleOptions.anchor = new Vec4(0, 1, 1, 1); // Split in X
        // @ts-ignore engine-tsd
        handleOptions.pivot = new Vec2(1, 1); // Top right
    }
    handle.addComponent('element', handleOptions);
    handle.addComponent('button', {
        active: true,
        imageEntity: handle,
        hitPadding: new Vec4(0, 0, 0, 0),
        transitionMode: BUTTON_TRANSITION_MODE_TINT,
        hoverTint: new Color(1, 1, 1),
        pressedTint: new Color(1, 1, 1),
        inactiveTint: new Color(1, 1, 1),
        fadeDuration: 0
    });

    const scrollbar = new Entity(horizontal ? 'HorizontalScrollbar' : 'VerticalScrollbar');

    scrollbar.addChild(handle);

    const scrollbarOptions = {
        type: ELEMENTTYPE_IMAGE,
        color: new Color(0.5, 0.5, 0.5),
        opacity: 1,
        rect: new Vec4(0, 0, 1, 1),
        mask: false,
        useInput: false
    };

    const scrollbarSize = 20;

    if (horizontal) {
        // @ts-ignore engine-tsd
        scrollbarOptions.anchor = new Vec4(0, 0, 1, 0);
        // @ts-ignore engine-tsd
        scrollbarOptions.pivot = new Vec2(0, 0);
        // @ts-ignore engine-tsd
        scrollbarOptions.margin = new Vec4(0, 0, scrollbarSize, -scrollbarSize);
    } else {
        // @ts-ignore engine-tsd
        scrollbarOptions.anchor = new Vec4(1, 0, 1, 1);
        // @ts-ignore engine-tsd
        scrollbarOptions.pivot = new Vec2(1, 1);
        // @ts-ignore engine-tsd
        scrollbarOptions.margin = new Vec4(-scrollbarSize, scrollbarSize, 0, 0);
    }
    scrollbar.addComponent('element', scrollbarOptions);
    scrollbar.addComponent('scrollbar', {
        orientation: horizontal ? ORIENTATION_HORIZONTAL : ORIENTATION_VERTICAL,
        value: 0,
        handleSize: 0.5,
        handleEntity: handle
    });

    return scrollbar;
}

// Create some text content
const text = new Entity('Text');
text.addComponent('element', {
    alignment: new Vec2(0, 0),
    anchor: new Vec4(0, 1, 0, 1),
    autoHeight: true,
    autoWidth: false,
    fontAsset: assets.font.id,
    fontSize: 32,
    lineHeight: 36,
    pivot: new Vec2(0, 1),
    text:
        'This is a scroll view control. You can scroll the content by dragging the vertical ' +
        'or horizontal scroll bars, by dragging the content itself, by using the mouse wheel, or ' +
        'by using a trackpad. Notice the elastic bounce if you drag the content beyond the ' +
        'limits of the scroll view.',
    type: ELEMENTTYPE_TEXT,
    width: 600,
    wrapLines: true
});

// Group to hold the content inside the scroll view's viewport
const content = new Entity('Content');
content.addChild(text);

content.addComponent('element', {
    anchor: new Vec4(0, 1, 0, 1),
    height: 400,
    pivot: new Vec2(0, 1),
    type: ELEMENTTYPE_GROUP,
    useInput: true,
    width: 600
});

// Scroll view viewport
const viewport = new Entity('Viewport');
viewport.addChild(content);

viewport.addComponent('element', {
    anchor: new Vec4(0, 0, 1, 1),
    color: new Color(0.2, 0.2, 0.2),
    margin: new Vec4(0, 20, 20, 0),
    mask: true,
    opacity: 1,
    pivot: new Vec2(0, 1),
    rect: new Vec4(0, 0, 1, 1),
    type: ELEMENTTYPE_IMAGE,
    useInput: false
});

const horizontalScrollbar = createScrollbar(true);
const verticalScrollbar = createScrollbar(false);

// Create a scroll view
const scrollview = new Entity('ScrollView');
scrollview.addChild(viewport);
scrollview.addChild(horizontalScrollbar);
scrollview.addChild(verticalScrollbar);

// You must add the scrollview entity to the hierarchy BEFORE adding the scrollview component
screen.addChild(scrollview);

scrollview.addComponent('element', {
    anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
    height: 200,
    pivot: new Vec2(0.5, 0.5),
    type: ELEMENTTYPE_GROUP,
    useInput: false,
    width: 400
});

scrollview.addComponent('scrollview', {
    bounceAmount: 0.1,
    contentEntity: content,
    friction: 0.05,
    useMouseWheel: true,
    mouseWheelSensitivity: Vec2.ONE,
    horizontal: true,
    horizontalScrollbarEntity: horizontalScrollbar,
    horizontalScrollbarVisibility: SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED,
    scrollMode: SCROLL_MODE_BOUNCE,
    vertical: true,
    verticalScrollbarEntity: verticalScrollbar,
    verticalScrollbarVisibility: SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED,
    viewportEntity: viewport
});

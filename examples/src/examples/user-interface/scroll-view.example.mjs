import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    font: new pc.Asset('font', 'font', { url: rootPath + '/static/assets/fonts/courier.json' })
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.elementInput = new pc.ElementInput(canvas);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.ScreenComponentSystem,
    pc.ButtonComponentSystem,
    pc.ElementComponentSystem,
    pc.LayoutGroupComponentSystem,
    pc.ScrollViewComponentSystem,
    pc.ScrollbarComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.FontHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Create a camera
    const camera = new pc.Entity();
    app.root.addChild(camera);

    camera.addComponent('camera', {
        clearColor: new pc.Color(30 / 255, 30 / 255, 30 / 255)
    });

    // Create a 2D screen
    const screen = new pc.Entity();
    app.root.addChild(screen);

    screen.addComponent('screen', {
        screenSpace: true,
        referenceResolution: new pc.Vec2(1280, 720),
        scaleMode: pc.SCALEMODE_BLEND,
        scaleBlend: 0.5
    });
    /**
     * @param {boolean} horizontal - True means horizontal, false means vertical.
     * @returns {pc.Entity} The returned entity.
     */
    function createScrollbar(horizontal) {
        const handle = new pc.Entity('Handle');
        const handleOptions = {
            type: pc.ELEMENTTYPE_IMAGE,
            color: new pc.Color(1, 1, 1),
            opacity: 1,
            margin: new pc.Vec4(0, 0, 0, 0),
            rect: new pc.Vec4(0, 0, 1, 1),
            mask: false,
            useInput: true
        };
        if (horizontal) {
            // @ts-ignore engine-tsd
            handleOptions.anchor = new pc.Vec4(0, 0, 0, 1); // Split in Y
            // @ts-ignore engine-tsd
            handleOptions.pivot = new pc.Vec2(0, 0); // Bottom left
        } else {
            // @ts-ignore engine-tsd
            handleOptions.anchor = new pc.Vec4(0, 1, 1, 1); // Split in X
            // @ts-ignore engine-tsd
            handleOptions.pivot = new pc.Vec2(1, 1); // Top right
        }
        handle.addComponent('element', handleOptions);
        handle.addComponent('button', {
            active: true,
            imageEntity: handle,
            hitPadding: new pc.Vec4(0, 0, 0, 0),
            transitionMode: pc.BUTTON_TRANSITION_MODE_TINT,
            hoverTint: new pc.Color(1, 1, 1),
            pressedTint: new pc.Color(1, 1, 1),
            inactiveTint: new pc.Color(1, 1, 1),
            fadeDuration: 0
        });

        const scrollbar = new pc.Entity(horizontal ? 'HorizontalScrollbar' : 'VerticalScrollbar');

        scrollbar.addChild(handle);

        const scrollbarOptions = {
            type: pc.ELEMENTTYPE_IMAGE,
            color: new pc.Color(0.5, 0.5, 0.5),
            opacity: 1,
            rect: new pc.Vec4(0, 0, 1, 1),
            mask: false,
            useInput: false
        };

        const scrollbarSize = 20;

        if (horizontal) {
            // @ts-ignore engine-tsd
            scrollbarOptions.anchor = new pc.Vec4(0, 0, 1, 0);
            // @ts-ignore engine-tsd
            scrollbarOptions.pivot = new pc.Vec2(0, 0);
            // @ts-ignore engine-tsd
            scrollbarOptions.margin = new pc.Vec4(0, 0, scrollbarSize, -scrollbarSize);
        } else {
            // @ts-ignore engine-tsd
            scrollbarOptions.anchor = new pc.Vec4(1, 0, 1, 1);
            // @ts-ignore engine-tsd
            scrollbarOptions.pivot = new pc.Vec2(1, 1);
            // @ts-ignore engine-tsd
            scrollbarOptions.margin = new pc.Vec4(-scrollbarSize, scrollbarSize, 0, 0);
        }
        scrollbar.addComponent('element', scrollbarOptions);
        scrollbar.addComponent('scrollbar', {
            orientation: horizontal ? pc.ORIENTATION_HORIZONTAL : pc.ORIENTATION_VERTICAL,
            value: 0,
            handleSize: 0.5,
            handleEntity: handle
        });

        return scrollbar;
    }

    // Create some text content
    const text = new pc.Entity('Text');
    text.addComponent('element', {
        alignment: new pc.Vec2(0, 0),
        anchor: new pc.Vec4(0, 1, 0, 1),
        autoHeight: true,
        autoWidth: false,
        fontAsset: assets.font.id,
        fontSize: 32,
        lineHeight: 36,
        pivot: new pc.Vec2(0, 1),
        text:
            'This is a scroll view control. You can scroll the content by dragging the vertical ' +
            'or horizontal scroll bars, by dragging the content itself, by using the mouse wheel, or ' +
            'by using a trackpad. Notice the elastic bounce if you drag the content beyond the ' +
            'limits of the scroll view.',
        type: pc.ELEMENTTYPE_TEXT,
        width: 600,
        wrapLines: true
    });

    // Group to hold the content inside the scroll view's viewport
    const content = new pc.Entity('Content');
    content.addChild(text);

    content.addComponent('element', {
        anchor: new pc.Vec4(0, 1, 0, 1),
        height: 400,
        pivot: new pc.Vec2(0, 1),
        type: pc.ELEMENTTYPE_GROUP,
        useInput: true,
        width: 600
    });

    // Scroll view viewport
    const viewport = new pc.Entity('Viewport');
    viewport.addChild(content);

    viewport.addComponent('element', {
        anchor: new pc.Vec4(0, 0, 1, 1),
        color: new pc.Color(0.2, 0.2, 0.2),
        margin: new pc.Vec4(0, 20, 20, 0),
        mask: true,
        opacity: 1,
        pivot: new pc.Vec2(0, 1),
        rect: new pc.Vec4(0, 0, 1, 1),
        type: pc.ELEMENTTYPE_IMAGE,
        useInput: false
    });

    const horizontalScrollbar = createScrollbar(true);
    const verticalScrollbar = createScrollbar(false);

    // Create a scroll view
    const scrollview = new pc.Entity('ScrollView');
    scrollview.addChild(viewport);
    scrollview.addChild(horizontalScrollbar);
    scrollview.addChild(verticalScrollbar);

    // You must add the scrollview entity to the hierarchy BEFORE adding the scrollview component
    screen.addChild(scrollview);

    scrollview.addComponent('element', {
        anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
        height: 200,
        pivot: new pc.Vec2(0.5, 0.5),
        type: pc.ELEMENTTYPE_GROUP,
        useInput: false,
        width: 400
    });

    scrollview.addComponent('scrollview', {
        bounceAmount: 0.1,
        contentEntity: content,
        friction: 0.05,
        useMouseWheel: true,
        mouseWheelSensitivity: pc.Vec2.ONE,
        horizontal: true,
        horizontalScrollbarEntity: horizontalScrollbar,
        horizontalScrollbarVisibility: pc.SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED,
        scrollMode: pc.SCROLL_MODE_BOUNCE,
        vertical: true,
        verticalScrollbarEntity: verticalScrollbar,
        verticalScrollbarVisibility: pc.SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED,
        viewportEntity: viewport
    });
});

export { app };

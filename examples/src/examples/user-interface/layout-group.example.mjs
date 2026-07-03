import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
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
    TextureHandler,
    TouchDevice,
    Vec2,
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

// Create Layout Group Entity
const group = new Entity();
group.addComponent('element', {
    // a Layout Group needs a 'group' element component
    type: ELEMENTTYPE_GROUP,
    anchor: [0.5, 0.5, 0.5, 0.5],
    pivot: [0.5, 0.5],
    // the element's width and height dictate the group's bounds
    width: 350,
    height: 150
});
group.addComponent('layoutgroup', {
    orientation: ORIENTATION_HORIZONTAL,
    spacing: new Vec2(10, 10),
    // fit_both for width and height, making all child elements take the entire space
    widthFitting: FITTING_BOTH,
    heightFitting: FITTING_BOTH,
    // wrap children
    wrap: true
});
screen.addChild(group);

// create 15 children to show off the layout group
for (let i = 0; i < 15; ++i) {
    // create a random-colored panel
    const child = new Entity();
    child.addComponent('element', {
        anchor: [0.5, 0.5, 0.5, 0.5],
        pivot: [0.5, 0.5],
        color: new Color(Math.random(), Math.random(), Math.random()),
        type: ELEMENTTYPE_IMAGE
    });
    child.addComponent('layoutchild', {
        excludeFromLayout: false
    });
    group.addChild(child);

    // add a text label
    const childLabel = new Entity();
    childLabel.addComponent('element', {
        // center-position and attach to the borders of parent
        // meaning this text element will scale along with parent
        anchor: [0, 0, 1, 1],
        margin: [0, 0, 0, 0],
        pivot: [0.5, 0.5],
        color: new Color(1, 1, 1),
        fontAsset: assets.font.id,
        text: `${i + 1}`,
        type: ELEMENTTYPE_TEXT,
        // auto font size
        autoWidth: false,
        autoHeight: false,
        autoFitWidth: true,
        autoFitHeight: true
    });
    child.addChild(childLabel);
}

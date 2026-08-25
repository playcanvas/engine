// @config
//
// Demonstrates the horizontal text layouts of a text element - aligned to the left,
// center or right with the `alignment` property, and justified with `justify`.

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
    font: new Asset('font', 'font', { url: './assets/fonts/arial.json' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [CameraComponentSystem, ScreenComponentSystem, ElementComponentSystem];
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
    clearColor: new Color(24 / 255, 24 / 255, 28 / 255)
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

const TEXT_WIDTH = 620;
const TEXT_HEIGHT = 290;

// A panel behind the text, exactly the size of the text element, so that it is easy to see which
// edges the text is being aligned to
const panel = new Entity('panel');
panel.setLocalPosition(0, 40, 0);
panel.addComponent('element', {
    anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
    pivot: new Vec2(0.5, 0.5),
    width: TEXT_WIDTH,
    height: TEXT_HEIGHT,
    color: new Color(1, 1, 1),
    opacity: 0.06,
    type: ELEMENTTYPE_IMAGE
});
screen.addChild(panel);

// The paragraph being laid out. Justification only does something when the text wraps, which
// needs wrapLines to be true and the element to have a width of its own to wrap against, so
// autoWidth is turned off.
const text = new Entity('text');
text.addComponent('element', {
    anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
    pivot: new Vec2(0.5, 0.5),
    fontAsset: assets.font.id,
    fontSize: 26,
    lineHeight: 38,
    width: TEXT_WIDTH,
    height: TEXT_HEIGHT,
    autoWidth: false,
    autoHeight: false,
    wrapLines: true,
    text:
        'Justified text is stretched so that each of its lines finishes flush with both edges ' +
        'of the element. The engine does this by widening the gaps between the words of every ' +
        'line that wraps. The last line of the text keeps its normal alignment, because pulling ' +
        'a few short words across the whole width would look broken rather than tidy.',
    type: ELEMENTTYPE_TEXT
});
panel.addChild(text);

// Reports which two property values the selected mode comes down to
const readout = new Entity('readout');
readout.setLocalPosition(0, -190, 0);
readout.addComponent('element', {
    anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
    pivot: new Vec2(0.5, 0.5),
    fontAsset: assets.font.id,
    fontSize: 20,
    color: new Color(0.55, 0.8, 1),
    text: '',
    type: ELEMENTTYPE_TEXT
});
screen.addChild(readout);

const alignments = {
    left: { x: 0, name: 'left' },
    center: { x: 0.5, name: 'centered' },
    right: { x: 1, name: 'right' }
};

// The two properties are independent, so all six of their combinations are worth a look.
// Justifying takes the wrapped lines out of alignment's hands, but never the last line of the
// text, so alignment is what keeps deciding where that one sits.
const applyLayout = () => {
    const justify = data.get('data.justify');
    const alignment = alignments[data.get('data.alignment')] ?? alignments.left;

    text.element.justify = justify;

    // the text is kept at the top of its element so that it does not move vertically as the
    // number of lines changes
    text.element.alignment = new Vec2(alignment.x, 1);

    const effect = justify ? `wrapped lines flush, last line ${alignment.name}` : `every line ${alignment.name}`;
    readout.element.text = `justify: ${justify}   alignment.x: ${alignment.x}   ->   ${effect}`;
};

data.on('*:set', (/** @type {string} */ path) => {
    if (path.startsWith('data.')) {
        applyLayout();
    }
});

data.set('data', {
    justify: true,
    alignment: 'left'
});

applyLayout();

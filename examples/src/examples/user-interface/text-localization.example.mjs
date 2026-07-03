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
    Mouse,
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

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

app.i18n.addData({
    header: {
        version: 1
    },
    data: [
        {
            info: {
                locale: 'en-US'
            },
            messages: {
                HELLO: 'Hi'
            }
        },
        {
            info: {
                locale: 'fr-FR'
            },
            messages: {
                HELLO: 'Salut'
            }
        },
        {
            info: {
                locale: 'es-ES'
            },
            messages: {
                HELLO: 'Hola'
            }
        },
        {
            info: {
                locale: 'pt-BR'
            },
            messages: {
                HELLO: 'Oi!'
            }
        }
    ]
});

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

// Create a basic text element
const text = new Entity();
text.addComponent('element', {
    anchor: [0.5, 0.5, 0.5, 0.5],
    autoWidth: false,
    fontAsset: assets.font.id,
    fontSize: 128,
    pivot: [0.5, 0.5],
    key: 'HELLO',
    type: ELEMENTTYPE_TEXT,
    width: 640
});
screen.addChild(text);

/**
 * @param {string} labelText - The label text.
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @returns {Entity} The returned entity.
 */
function createButton(labelText, x, y) {
    // Create a simple button
    const button = new Entity();
    button.addComponent('button');
    button.addComponent('element', {
        anchor: [0.5, 0.5, 0.5, 0.5],
        height: 40,
        pivot: [0.5, 0.5],
        type: ELEMENTTYPE_IMAGE,
        width: 128,
        useInput: true
    });

    // Create a label for the button
    const label = new Entity();
    label.addComponent('element', {
        anchor: [0.5, 0.5, 0.5, 0.5],
        color: new Color(0, 0, 0),
        fontAsset: assets.font.id,
        fontSize: 32,
        height: 64,
        pivot: [0.5, 0.5],
        text: labelText,
        type: ELEMENTTYPE_TEXT,
        width: 128,
        wrapLines: true
    });
    button.addChild(label);

    // Change the locale to the button text
    button.button.on('click', () => {
        app.i18n.locale = labelText;
    });

    button.setLocalPosition(x, y, 0);

    return button;
}

screen.addChild(createButton('en-US', -225, -100));
screen.addChild(createButton('fr-FR', -75, -100));
screen.addChild(createButton('es-ES', 75, -100));
screen.addChild(createButton('pt-BR', 225, -100));

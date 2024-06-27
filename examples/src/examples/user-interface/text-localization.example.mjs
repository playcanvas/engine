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
    pc.ElementComponentSystem
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
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(30 / 255, 30 / 255, 30 / 255)
    });
    app.root.addChild(camera);

    // Create a 2D screen
    const screen = new pc.Entity();
    screen.addComponent('screen', {
        referenceResolution: new pc.Vec2(1280, 720),
        scaleBlend: 0.5,
        scaleMode: pc.SCALEMODE_BLEND,
        screenSpace: true
    });
    app.root.addChild(screen);

    // Create a basic text element
    const text = new pc.Entity();
    text.addComponent('element', {
        anchor: [0.5, 0.5, 0.5, 0.5],
        autoWidth: false,
        fontAsset: assets.font.id,
        fontSize: 128,
        pivot: [0.5, 0.5],
        key: 'HELLO',
        type: pc.ELEMENTTYPE_TEXT,
        width: 640
    });
    screen.addChild(text);

    /**
     * @param {string} labelText - The label text.
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @returns {pc.Entity} The returned entity.
     */
    function createButton(labelText, x, y) {
        // Create a simple button
        const button = new pc.Entity();
        button.addComponent('button');
        button.addComponent('element', {
            anchor: [0.5, 0.5, 0.5, 0.5],
            height: 40,
            pivot: [0.5, 0.5],
            type: pc.ELEMENTTYPE_IMAGE,
            width: 128,
            useInput: true
        });

        // Create a label for the button
        const label = new pc.Entity();
        label.addComponent('element', {
            anchor: [0.5, 0.5, 0.5, 0.5],
            color: new pc.Color(0, 0, 0),
            fontAsset: assets.font.id,
            fontSize: 32,
            height: 64,
            pivot: [0.5, 0.5],
            text: labelText,
            type: pc.ELEMENTTYPE_TEXT,
            width: 128,
            wrapLines: true
        });
        button.addChild(label);

        // Change the locale to the button text
        button.button.on('click', function () {
            app.i18n.locale = labelText;
        });

        button.setLocalPosition(x, y, 0);

        return button;
    }

    screen.addChild(createButton('en-US', -225, -100));
    screen.addChild(createButton('fr-FR', -75, -100));
    screen.addChild(createButton('es-ES', 75, -100));
    screen.addChild(createButton('pt-BR', 225, -100));
});

export { app };

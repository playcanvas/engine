import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    ButtonComponentSystem,
    CameraComponentSystem,
    Color,
    ElementComponentSystem,
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    KEY_ESCAPE,
    Keyboard,
    LayoutChildComponentSystem,
    LayoutGroupComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScreenComponentSystem,
    ScriptComponentSystem,
    ScrollViewComponentSystem,
    ScrollbarComponentSystem,
    TemplateHandler,
    TextureHandler,
    TouchDevice,
    Vec3,
    XRSPACE_LOCALFLOOR,
    XRTARGETRAY_POINTER,
    XRTYPE_AR,
    XRTYPE_VR,
    XrManager,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

import uiText from './text.txt';
import uiCss from './ui.css';
import uiHtml from './ui.html';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// create UI
// html
const div = document.createElement('div');
div.innerHTML = uiHtml;
document.body.appendChild(div);
// css
const css = document.createElement('style');
css.innerHTML = uiCss;
document.head.appendChild(css);

/**
 * @param {string} msg - The message.
 */
const message = (msg) => {
    document.querySelector('.message').textContent = msg;
};

const assets = {
    font: new Asset('font', 'font', { url: './assets/fonts/courier.json' }),
    monitor: new Asset('monitor', 'template', { url: './assets/templates/monitor.json' })
};

assets.font.id = 42;

const gfxOptions = {
    deviceTypes: [deviceType],
    alpha: true
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(canvas);
createOptions.touch = new TouchDevice(canvas);
createOptions.keyboard = new Keyboard(window);
createOptions.xr = XrManager;
createOptions.elementInput = new ElementInput(canvas);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    ScreenComponentSystem,
    LayoutGroupComponentSystem,
    LayoutChildComponentSystem,
    ButtonComponentSystem,
    ScrollViewComponentSystem,
    ScrollbarComponentSystem,
    ElementComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, FontHandler, TemplateHandler];

const app = new AppBase(canvas);

app.init(createOptions);

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    div.remove();
    css.remove();
});

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

const colorCamera = new Color(44 / 255, 62 / 255, 80 / 255);
const colorTransparent = new Color(0, 0, 0, 0);

// create camera
const cameraEntity = new Entity();
cameraEntity.addComponent('camera', {
    clearColor: colorCamera
});
cameraEntity.setLocalPosition(0, 1, 1);
app.root.addChild(cameraEntity);

// virtual monitor from a template
const monitor = assets.monitor.resource.instantiate();
monitor.setLocalEulerAngles(45, 0, 0);
monitor.setLocalPosition(0, 1, -1);
app.root.addChild(monitor);

// resize scrollable area to match its content
const entityText = monitor.findByName('Lorem');
entityText.element.text = uiText;
monitor.findByName('Content').element.height = entityText.element.height + 40;

// fps counter
const entityFps = monitor.findByName('FPS');
let ticks = 0;
let fpsTime = 0;

const vec3A = new Vec3();

if (app.xr.supported) {
    // XR availability
    document
    .querySelector('.container > .button[data-xr="immersive-ar"]')
    ?.classList.toggle('active', app.xr.isAvailable(XRTYPE_AR));
    document
    .querySelector('.container > .button[data-xr="immersive-vr"]')
    ?.classList.toggle('active', app.xr.isAvailable(XRTYPE_VR));

    // XR availability events
    app.xr.on('available', (type, available) => {
        const element = document.querySelector(`.container > .button[data-xr="${type}"]`);
        element?.classList.toggle('active', available);
    });

    // reset camera color on XR end
    app.xr.on('end', () => {
        cameraEntity.camera.clearColor = colorCamera;
    });

    // button handler
    const onXrButtonClick = (event) => {
        const button = /** @type {HTMLElement} */ (event.currentTarget);
        if (!button.classList.contains('active')) return;

        const type = button.getAttribute('data-xr');

        cameraEntity.camera.clearColor = type === XRTYPE_AR ? colorTransparent : colorCamera;

        app.xr.start(cameraEntity.camera, type, XRSPACE_LOCALFLOOR, {
            callback: (err) => {
                if (err) message(`XR ${type} failed to start: ${err.message}`);
            }
        });
    };

    // button clicks
    const buttons = document.querySelectorAll('.container > .button');
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener('click', onXrButtonClick);
    }

    // end session by keyboard ESC
    app.keyboard.on('keydown', (evt) => {
        if (evt.key === KEY_ESCAPE && app.xr.active) {
            app.xr.end();
        }
    });

    app.on('update', () => {
        // fps meter
        const now = Date.now();
        if (now - fpsTime >= 1000) {
            fpsTime = now;
            entityFps.element.text = `FPS: ${ticks}`;
            ticks = 0;
        }
        ticks++;

        // visualize input source rays
        for (let i = 0; i < app.xr.input.inputSources.length; i++) {
            const inputSource = app.xr.input.inputSources[i];

            // draw ray
            if (inputSource.targetRayMode === XRTARGETRAY_POINTER) {
                vec3A.copy(inputSource.getDirection()).mulScalar(10).add(inputSource.getOrigin());
                const color = inputSource.selecting ? Color.GREEN : Color.WHITE;
                app.drawLine(inputSource.getOrigin(), vec3A, color);
            }
        }
    });

    app.xr.on('start', () => {
        message('Immersive XR session has started');
    });
    app.xr.on('end', () => {
        message('Immersive XR session has ended');
    });
    app.xr.on(`available:${XRTYPE_AR}`, (available) => {
        message(`Immersive XR is ${available ? 'available' : 'unavailable'}`);
    });

    if (!app.xr.isAvailable(XRTYPE_VR)) {
        message('Immersive VR is not available');
    } else if (!app.xr.isAvailable(XRTYPE_AR)) {
        message('Immersive AR is not available');
    }
} else {
    message('WebXR is not supported');
}

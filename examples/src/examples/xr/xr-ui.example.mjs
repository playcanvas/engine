// @config WEBGPU_DISABLED
import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';
import files from 'examples/files';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// create UI
// html
const div = document.createElement('div');
div.innerHTML = files['ui.html'];
document.body.appendChild(div);
// css
const css = document.createElement('style');
css.innerHTML = files['ui.css'];
document.head.appendChild(css);

/**
 * @param {string} msg - The message.
 */
const message = function (msg) {
    document.querySelector('.message').textContent = msg;
};

const assets = {
    font: new pc.Asset('font', 'font', { url: rootPath + '/static/assets/fonts/courier.json' }),
    monitor: new pc.Asset('monitor', 'template', { url: rootPath + '/static/assets/templates/monitor.json' })
};

assets.font.id = 42;

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js',
    alpha: true
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.xr = pc.XrManager;
createOptions.graphicsDevice = device;
createOptions.keyboard = new pc.Keyboard(document.body);
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.elementInput = new pc.ElementInput(canvas);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.ScreenComponentSystem,
    pc.LayoutGroupComponentSystem,
    pc.LayoutChildComponentSystem,
    pc.ButtonComponentSystem,
    pc.ScrollViewComponentSystem,
    pc.ScrollbarComponentSystem,
    pc.ElementComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.FontHandler, pc.TemplateHandler];

const app = new pc.AppBase(canvas);

app.init(createOptions);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    div.remove();
    css.remove();
});

// use device pixel ratio
app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    const colorCamera = new pc.Color(44 / 255, 62 / 255, 80 / 255);
    const colorTransparent = new pc.Color(0, 0, 0, 0);

    // create camera
    const cameraEntity = new pc.Entity();
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
    entityText.element.text = files['text.txt'];
    monitor.findByName('Content').element.height = entityText.element.height + 40;

    // fps counter
    const entityFps = monitor.findByName('FPS');
    let ticks = 0;
    let fpsTime = 0;

    const vec3A = new pc.Vec3();

    if (app.xr.supported) {
        // XR availability
        document
            .querySelector(`.container > .button[data-xr="immersive-ar"]`)
            ?.classList.toggle('active', app.xr.isAvailable(pc.XRTYPE_AR));
        document
            .querySelector(`.container > .button[data-xr="immersive-vr"]`)
            ?.classList.toggle('active', app.xr.isAvailable(pc.XRTYPE_VR));

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
        const onXrButtonClick = function () {
            if (!this.classList.contains('active')) return;

            const type = this.getAttribute('data-xr');

            cameraEntity.camera.clearColor = type === pc.XRTYPE_AR ? colorTransparent : colorCamera;

            app.xr.start(cameraEntity.camera, type, pc.XRSPACE_LOCALFLOOR, {
                callback: function (err) {
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
        app.keyboard.on('keydown', function (evt) {
            if (evt.key === pc.KEY_ESCAPE && app.xr.active) {
                app.xr.end();
            }
        });

        app.on('update', function () {
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
                if (inputSource.targetRayMode === pc.XRTARGETRAY_POINTER) {
                    vec3A.copy(inputSource.getDirection()).mulScalar(10).add(inputSource.getOrigin());
                    const color = inputSource.selecting ? pc.Color.GREEN : pc.Color.WHITE;
                    app.drawLine(inputSource.getOrigin(), vec3A, color);
                }
            }
        });

        app.xr.on('start', function () {
            message('Immersive XR session has started');
        });
        app.xr.on('end', function () {
            message('Immersive XR session has ended');
        });
        app.xr.on('available:' + pc.XRTYPE_AR, function (available) {
            message('Immersive XR is ' + (available ? 'available' : 'unavailable'));
        });

        if (!app.xr.isAvailable(pc.XRTYPE_VR)) {
            message('Immersive VR is not available');
        } else if (!app.xr.isAvailable(pc.XRTYPE_AR)) {
            message('Immersive AR is not available');
        }
    } else {
        message('WebXR is not supported');
    }
});

export { app };

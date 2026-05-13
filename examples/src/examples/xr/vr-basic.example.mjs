import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

/**
 * @param {string} msg - The message.
 */
const message = function (msg) {
    /** @type {HTMLDivElement} */
    let el = document.querySelector('.message');
    if (!el) {
        el = document.createElement('div');
        el.classList.add('message');
        document.body.append(el);
    }
    el.textContent = msg;
};

const gfxOptions = {
    deviceTypes: [deviceType],
    alpha: true
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = window.devicePixelRatio;

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(canvas);
createOptions.touch = new pc.TouchDevice(canvas);
createOptions.keyboard = new pc.Keyboard(window);
createOptions.xr = pc.XrManager;

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler
];

const app = new pc.AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assets = {
    gallery: new pc.Asset('gallery', 'container', { url: `${rootPath}/static/assets/models/xr_gallery.glb` })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    const galleryEntity = assets.gallery.resource.instantiateRenderEntity();
    app.root.addChild(galleryEntity);

    // Initial camera (desktop / before XR): offset to the side and higher than default eye height.
    const camX = 1.35;
    const camY = 2.45;
    const camZ = 3.0;
    const lookX = 0;
    const lookY = 1.25;
    const lookZ = 0;

    const c = new pc.Entity();
    c.addComponent('camera', {
        clearColor: new pc.Color(44 / 255, 62 / 255, 80 / 255),
        farClip: 10000
    });
    c.setLocalPosition(camX, camY, camZ);
    c.lookAt(lookX, lookY, lookZ);
    app.root.addChild(c);

    const l = new pc.Entity();
    l.addComponent('light', {
        type: 'spot',
        range: 30
    });
    l.translate(0, 10, 0);
    app.root.addChild(l);

    if (app.xr.supported) {
        const activate = function () {
            if (app.xr.isAvailable(pc.XRTYPE_VR)) {
                c.camera.startXr(pc.XRTYPE_VR, pc.XRSPACE_LOCALFLOOR, {
                    callback: function (err) {
                        if (err) message(`WebXR Immersive VR failed to start: ${err.message}`);
                    }
                });
            } else {
                message('Immersive VR is not available');
            }
        };

        app.mouse.on('mousedown', () => {
            if (!app.xr.active) activate();
        });

        if (app.touch) {
            app.touch.on('touchend', (evt) => {
                if (!app.xr.active) {
                    activate();
                } else {
                    c.camera.endXr();
                }

                evt.event.preventDefault();
                evt.event.stopPropagation();
            });
        }

        app.keyboard.on('keydown', (evt) => {
            if (evt.key === pc.KEY_ESCAPE && app.xr.active) {
                app.xr.end();
            }
        });

        app.xr.on('start', () => {
            message('Immersive VR session has started');
        });
        app.xr.on('end', () => {
            message('Immersive VR session has ended');
        });
        app.xr.on(`available:${pc.XRTYPE_VR}`, (available) => {
            message(`Immersive VR is ${available ? 'available' : 'unavailable'}`);
        });

        if (!app.xr.isAvailable(pc.XRTYPE_VR)) {
            message('Immersive VR is not available');
        }
    } else {
        message('WebXR is not supported');
    }
});

export { app };

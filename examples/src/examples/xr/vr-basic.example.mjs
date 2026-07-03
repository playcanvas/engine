// @config
//
// @credit
// title: XR VR Gallery Space
// author: Josh Johanson
// source: https://sketchfab.com/3d-models/xr-vr-gallery-space-873a1808080e47d2a804f3c991e33b4f
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    KEY_ESCAPE,
    Keyboard,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    TEXTURETYPE_RGBP,
    TextureHandler,
    TouchDevice,
    XRSPACE_LOCALFLOOR,
    XRTYPE_VR,
    XrManager,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

/**
 * @param {string} msg - The message.
 */
const message = msg => {
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

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = window.devicePixelRatio;

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(canvas);
createOptions.touch = new TouchDevice(canvas);
createOptions.keyboard = new Keyboard(window);
createOptions.xr = XrManager;

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

const app = new AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assets = {
    gallery: new Asset('gallery', 'container', { url: './assets/models/xr_gallery.glb' }),
    envatlas: new Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/table-mountain-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Skydome
app.scene.envAtlas = assets.envatlas.resource;
app.scene.skyboxMip = 0;
app.scene.exposure = 0.5;

const galleryEntity = assets.gallery.resource.instantiateRenderEntity();
app.root.addChild(galleryEntity);

// Initial camera (desktop / before XR): offset to the side and higher than default eye height.
const camX = 1.35;
const camY = 2.45;
const camZ = 3.0;
const lookX = 0;
const lookY = 1.25;
const lookZ = 0;

const c = new Entity();
c.addComponent('camera', {
    clearColor: new Color(44 / 255, 62 / 255, 80 / 255),
    farClip: 10000
});
c.setLocalPosition(camX, camY, camZ);
c.lookAt(lookX, lookY, lookZ);
app.root.addChild(c);

const l = new Entity();
l.addComponent('light', {
    type: 'spot',
    range: 30
});
l.translate(0, 10, 0);
app.root.addChild(l);

if (app.xr.supported) {
    const activate = () => {
        if (app.xr.isAvailable(XRTYPE_VR)) {
            c.camera.startXr(XRTYPE_VR, XRSPACE_LOCALFLOOR, {
                callback: err => {
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
        app.touch.on('touchend', evt => {
            if (!app.xr.active) {
                activate();
            } else {
                c.camera.endXr();
            }

            evt.event.preventDefault();
            evt.event.stopPropagation();
        });
    }

    app.keyboard.on('keydown', evt => {
        if (evt.key === KEY_ESCAPE && app.xr.active) {
            app.xr.end();
        }
    });

    app.xr.on('start', () => {
        message('Immersive VR session has started');
    });
    app.xr.on('end', () => {
        message('Immersive VR session has ended');
    });
    app.xr.on(`available:${XRTYPE_VR}`, available => {
        message(`Immersive VR is ${available ? 'available' : 'unavailable'}`);
    });

    if (!app.xr.isAvailable(XRTYPE_VR)) {
        message('Immersive VR is not available');
    }
} else {
    message('WebXR is not supported');
}

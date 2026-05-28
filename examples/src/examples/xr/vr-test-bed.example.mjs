// @config
//
// @credit
// title: XR VR Gallery Space
// author: Josh Johanson
// source: https://sketchfab.com/3d-models/xr-vr-gallery-space-873a1808080e47d2a804f3c991e33b4f
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import * as pc from 'playcanvas';
import { XrMenu } from 'playcanvas/scripts/esm/xr-menu.mjs';

import { deviceType } from 'examples/context';

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
    alpha: true,
    // Disable MSAA so XR fixed foveation actually has an effect on rendering. XrManager warns
    // when graphicsDevice.samples > 1 because the MSAA resolve undoes the foveation density map.
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = window.devicePixelRatio;

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(canvas);
createOptions.touch = new pc.TouchDevice(canvas);
createOptions.keyboard = new pc.Keyboard(window);
createOptions.xr = pc.XrManager;
createOptions.elementInput = new pc.ElementInput(canvas);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScreenComponentSystem,
    pc.ElementComponentSystem,
    pc.ButtonComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.FontHandler
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
    gallery: new pc.Asset('gallery', 'container', { url: './assets/models/xr_gallery.glb' }),
    envatlas: new pc.Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/table-mountain-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    font: new pc.Asset('font', 'font', { url: './assets/fonts/roboto-extralight.json' })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // skydome
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

    // In-VR debug HUD: shows current fixed-foveation value with +/- controls and an exit button.
    // The menu is always visible and follows the camera, biased to the right of the eye line.
    const menuEntity = new pc.Entity('XrMenu');
    menuEntity.addComponent('script');
    menuEntity.script.create(XrMenu, {
        properties: {
            menuItems: [
                // Foveation row doubles as a toggle button: clicking enables/disables foveation,
                // remembering the last non-zero value set via + / -.
                // Note: on Quest 3 with WebGPU, writing fixedFoveation kills the renderer (Quest
                // browser bug). On WebGL it works as expected.
                { label: 'FOVEATION: ---', eventName: 'fov:toggle' },
                { label: '-', eventName: 'fov:dec' },
                { label: '+', eventName: 'fov:inc' },
                { label: 'EXIT XR', eventName: 'xr:end' }
            ],
            fontAsset: assets.font,
            alwaysVisible: true,
            followDistance: 0.6,
            followOffset: new pc.Vec2(0.25, -0.15),
            // Wider rows so "FOVEATION: 0.50" fits on a single line (default 0.075 truncates it).
            buttonWidth: 0.13
        }
    });
    app.root.addChild(menuEntity);
    const xrMenu = menuEntity.script.xrMenu;

    let fov = 0;
    let lastNonZeroFov = 1;     // value restored by the toggle when re-enabling foveation
    let fovSupported = true;

    const refreshFovLabel = () => {
        const suffix = fovSupported ? '' : ' [N/A]';
        xrMenu.setItemLabel(0, `FOVEATION: ${fov.toFixed(2)}${suffix}`);
    };
    refreshFovLabel(); // seed the label so it shows "0.00" before the XR session starts

    // Single setter that clamps, remembers the last non-zero value (so toggle can restore it),
    // applies it to the live XR layer, and refreshes the label. + / - / toggle all funnel here.
    // When the runtime reports fixedFoveation as unsupported, fov is force-clamped to 0 so the
    // button still flashes (click feedback) but the value visibly never moves off 0.00.
    const setFov = (newFov) => {
        const requested = pc.math.clamp(newFov, 0, 1);
        fov = fovSupported ? requested : 0;
        if (fov > 0) lastNonZeroFov = fov;
        if (app.xr.active && fovSupported) {
            app.xr.fixedFoveation = fov;
        }
        refreshFovLabel();
    };

    app.xr.on('start', () => {
        const current = app.xr.fixedFoveation;
        if (current === null) {
            fovSupported = false;
            refreshFovLabel();
            return;
        }
        fovSupported = true;
        fov = current;
        if (fov > 0) lastNonZeroFov = fov;
        refreshFovLabel();
    });

    app.on('fov:inc', () => setFov(fov + 0.1));
    app.on('fov:dec', () => setFov(fov - 0.1));
    app.on('fov:toggle', () => setFov(fov > 0 ? 0 : lastNonZeroFov));
    app.on('xr:end', () => app.xr.end());

    // Draw a debug aim ray from each tracked-pointer XR input source (controllers, hand pointers)
    // every frame so the user can see where they're pointing at the menu buttons. Interaction
    // itself is wired through pc.ElementInput on the canvas — these lines are purely visual.
    const rayColor = new pc.Color(0.4, 0.8, 1, 1);
    const rayEnd = new pc.Vec3();
    const rayLength = 2.0;
    app.on('update', () => {
        if (!app.xr.active) return;
        for (const source of app.xr.input.inputSources) {
            if (source.targetRayMode !== pc.XRTARGETRAY_POINTER) continue;
            const origin = source.getOrigin();
            const direction = source.getDirection();
            rayEnd.copy(direction).mulScalar(rayLength).add(origin);
            app.drawLine(origin, rayEnd, rayColor);
        }
    });

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

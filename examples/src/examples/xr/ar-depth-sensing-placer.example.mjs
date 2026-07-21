import {
    AppBase,
    AppOptions,
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
    TextureHandler,
    TouchDevice,
    Vec3,
    XRDEPTHSENSINGFORMAT_F32,
    XRDEPTHSENSINGUSAGE_GPU,
    XRSPACE_LOCALFLOOR,
    XRTYPE_AR,
    XrManager,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

/**
 * @param {string} msg - The message.
 */
const message = (msg) => {
    /** @type {HTMLDivElement} */
    let el = document.querySelector('.message');
    if (!el) {
        el = document.createElement('div');
        el.classList.add('message');
        el.style.position = 'absolute';
        el.style.bottom = '96px';
        el.style.right = '0';
        el.style.padding = '8px 16px';
        el.style.fontFamily = 'Helvetica, Arial, sans-serif';
        el.style.color = '#fff';
        el.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
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

app.start();

// Create camera
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0, 0, 0, 0),
    farClip: 10000
});
app.root.addChild(camera);

// Light
const l = new Entity();
l.addComponent('light', {
    type: 'spot',
    range: 30
});
l.translate(0, 10, 0);
app.root.addChild(l);

// Placeable cone
const cone = new Entity();
cone.addComponent('render', {
    type: 'cone'
});
cone.setLocalScale(0.1, 0.1, 0.1);
app.root.addChild(cone);

const tmpVec3A = new Vec3();

if (app.xr.supported) {
    const activate = () => {
        if (app.xr.isAvailable(XRTYPE_AR)) {
            camera.camera.startXr(XRTYPE_AR, XRSPACE_LOCALFLOOR, {
                depthSensing: {
                    // Request access to camera depth
                    usagePreference: XRDEPTHSENSINGUSAGE_GPU,
                    dataFormatPreference: XRDEPTHSENSINGFORMAT_F32
                },
                callback: (err) => {
                    if (err) message(`WebXR Immersive AR failed to start: ${err.message}`);
                }
            });
        } else {
            message('Immersive AR is not available');
        }
    };

    app.mouse.on('mousedown', () => {
        if (!app.xr.active) activate();
    });

    if (app.touch) {
        app.touch.on('touchend', (evt) => {
            if (!app.xr.active) {
                // If not in VR, activate
                activate();
            } else {
                // Otherwise reset camera
                camera.camera.endXr();
            }

            evt.event.preventDefault();
            evt.event.stopPropagation();
        });
    }

    // End session by keyboard ESC
    app.keyboard.on('keydown', (evt) => {
        if (evt.key === KEY_ESCAPE && app.xr.active) {
            app.xr.end();
        }
    });

    app.xr.on('start', () => {
        message('Immersive AR session has started');
        console.log('depth gpu optimized', app.xr.views.depthGpuOptimized);
        console.log('depth texture format', app.xr.views.depthPixelFormat);
    });
    app.xr.on('end', () => {
        message('Immersive AR session has ended');
    });
    app.xr.on(`available:${XRTYPE_AR}`, (available) => {
        if (available) {
            if (!app.xr.views.supportedDepth) {
                message('AR Camera Depth is not supported');
            } else {
                message('Touch screen to start AR session');
            }
        } else {
            message('Immersive AR is not available');
        }
    });

    let selecting = false;
    let selectingTime = 0;
    const selectingDelay = 100;

    app.xr.input.on('select', () => {
        selecting = true;
        selectingTime = Date.now();
    });

    app.on('update', () => {
        // If camera depth is available
        if (app.xr.views.availableDepth) {
            const view = app.xr.views.list[0];
            const depth = view.getDepth(0.5, 0.5);

            if (depth) {
                tmpVec3A.copy(camera.forward);
                tmpVec3A.mulScalar(depth);
                tmpVec3A.add(camera.getPosition());
                tmpVec3A.y += 0.05; // Offset based on cone scale

                cone.enabled = true;
                cone.setLocalPosition(tmpVec3A);

                if (selecting && Date.now() - selectingTime < selectingDelay) {
                    selecting = false;
                    const obj = cone.clone();
                    app.root.addChild(obj);
                }
            } else {
                cone.enabled = false;
            }
        } else {
            cone.enabled = false;
        }
    });

    if (!app.xr.isAvailable(XRTYPE_AR)) {
        message('Immersive AR is not available');
    } else if (!app.xr.views.supportedDepth) {
        message('AR Camera Depth is not supported');
    } else {
        message('Touch screen to start AR session');
    }
} else {
    message('WebXR is not supported');
}

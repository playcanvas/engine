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
    StandardMaterial,
    TextureHandler,
    TouchDevice,
    XRSPACE_LOCALFLOOR,
    XRTRACKABLE_PLANE,
    XRTRACKABLE_POINT,
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

app.start();

// Create camera
const c = new Entity();
c.addComponent('camera', {
    clearColor: new Color(0, 0, 0, 0),
    farClip: 10000
});
app.root.addChild(c);

const l = new Entity();
l.addComponent('light', {
    type: 'spot',
    range: 30
});
l.translate(0, 10, 0);
app.root.addChild(l);

const material = new StandardMaterial();
material.diffuse = new Color(Math.random(), Math.random(), Math.random());

const target = new Entity();
target.addComponent('render', {
    type: 'cylinder',
    material: material
});
target.setLocalScale(0.1, 0.01, 0.1);
target.render.meshInstances[0].setParameter('material_diffuse', [Math.random(), Math.random(), Math.random()]);
app.root.addChild(target);

if (app.xr.supported) {
    const activate = () => {
        if (app.xr.isAvailable(XRTYPE_AR)) {
            c.camera.startXr(XRTYPE_AR, XRSPACE_LOCALFLOOR, {
                callback: err => {
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
        app.touch.on('touchend', evt => {
            if (!app.xr.active) {
                // If not in VR, activate
                activate();
            } else {
                // Otherwise reset camera
                c.camera.endXr();
            }

            evt.event.preventDefault();
            evt.event.stopPropagation();
        });
    }

    // End session by keyboard ESC
    app.keyboard.on('keydown', evt => {
        if (evt.key === KEY_ESCAPE && app.xr.active) {
            app.xr.end();
        }
    });

    app.xr.hitTest.on('available', () => {
        app.xr.hitTest.start({
            entityTypes: [XRTRACKABLE_POINT, XRTRACKABLE_PLANE],
            callback: (err, hitTestSource) => {
                if (err) {
                    message('Failed to start AR hit test');
                    return;
                }

                hitTestSource.on('result', (position, rotation) => {
                    target.setPosition(position);
                    target.setRotation(rotation);
                });
            }
        });
    });

    app.xr.on('start', () => {
        message('Immersive AR session has started');
    });
    app.xr.on('end', () => {
        message('Immersive AR session has ended');
    });
    app.xr.on(`available:${XRTYPE_AR}`, available => {
        if (available) {
            if (app.xr.hitTest.supported) {
                message('Touch screen to start AR session and look at the floor or walls');
            } else {
                message('AR Hit Test is not supported');
            }
        } else {
            message('Immersive AR is unavailable');
        }
    });

    if (app.xr.hitTest.supported) {
        app.xr.input.on('add', inputSource => {
            inputSource.hitTestStart({
                entityTypes: [XRTRACKABLE_POINT, XRTRACKABLE_PLANE],
                callback: (err, hitTestSource) => {
                    if (err) return;

                    let target = new Entity();
                    target.addComponent('render', {
                        type: 'cylinder',
                        material: material
                    });
                    target.setLocalScale(0.1, 0.01, 0.1);
                    target.render.meshInstances[0].setParameter('material_diffuse', [
                        Math.random(),
                        Math.random(),
                        Math.random()
                    ]);
                    app.root.addChild(target);

                    hitTestSource.on('result', (position, rotation) => {
                        target.setPosition(position);
                        target.setRotation(rotation);
                    });

                    hitTestSource.once('remove', () => {
                        target.destroy();
                        target = null;
                    });
                }
            });
        });
    }

    if (!app.xr.isAvailable(XRTYPE_AR)) {
        message('Immersive AR is not available');
    } else if (!app.xr.hitTest.supported) {
        message('AR Hit Test is not supported');
    } else {
        message('Touch screen to start AR session and look at the floor or walls');
    }
} else {
    message('WebXR is not supported');
}

// @config WEBGPU_DISABLED
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

const app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    touch: new pc.TouchDevice(canvas),
    keyboard: new pc.Keyboard(window),
    graphicsDeviceOptions: { alpha: true }
});
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// use device pixel ratio
app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;

app.start();

// create camera
const c = new pc.Entity();
c.addComponent('camera', {
    clearColor: new pc.Color(0, 0, 0, 0),
    farClip: 10000
});
app.root.addChild(c);

const l = new pc.Entity();
l.addComponent('light', {
    type: 'spot',
    range: 30
});
l.translate(0, 10, 0);
app.root.addChild(l);

const material = new pc.StandardMaterial();
material.diffuse = new pc.Color(Math.random(), Math.random(), Math.random());

const target = new pc.Entity();
target.addComponent('render', {
    type: 'cylinder',
    material: material
});
target.setLocalScale(0.1, 0.01, 0.1);
target.render.meshInstances[0].setParameter('material_diffuse', [Math.random(), Math.random(), Math.random()]);
app.root.addChild(target);

if (app.xr.supported) {
    const activate = function () {
        if (app.xr.isAvailable(pc.XRTYPE_AR)) {
            c.camera.startXr(pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
                callback: function (err) {
                    if (err) message('WebXR Immersive AR failed to start: ' + err.message);
                }
            });
        } else {
            message('Immersive AR is not available');
        }
    };

    app.mouse.on('mousedown', function () {
        if (!app.xr.active) activate();
    });

    if (app.touch) {
        app.touch.on('touchend', function (evt) {
            if (!app.xr.active) {
                // if not in VR, activate
                activate();
            } else {
                // otherwise reset camera
                c.camera.endXr();
            }

            evt.event.preventDefault();
            evt.event.stopPropagation();
        });
    }

    // end session by keyboard ESC
    app.keyboard.on('keydown', function (evt) {
        if (evt.key === pc.KEY_ESCAPE && app.xr.active) {
            app.xr.end();
        }
    });

    app.xr.hitTest.on('available', () => {
        app.xr.hitTest.start({
            entityTypes: [pc.XRTRACKABLE_POINT, pc.XRTRACKABLE_PLANE],
            callback: function (err, hitTestSource) {
                if (err) {
                    message('Failed to start AR hit test');
                    return;
                }

                hitTestSource.on('result', function (position, rotation) {
                    target.setPosition(position);
                    target.setRotation(rotation);
                });
            }
        });
    });

    app.xr.on('start', function () {
        message('Immersive AR session has started');
    });
    app.xr.on('end', function () {
        message('Immersive AR session has ended');
    });
    app.xr.on('available:' + pc.XRTYPE_AR, function (available) {
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
        app.xr.input.on('add', (inputSource) => {
            inputSource.hitTestStart({
                entityTypes: [pc.XRTRACKABLE_POINT, pc.XRTRACKABLE_PLANE],
                callback: (err, hitTestSource) => {
                    if (err) return;

                    let target = new pc.Entity();
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

    if (!app.xr.isAvailable(pc.XRTYPE_AR)) {
        message('Immersive AR is not available');
    } else if (!app.xr.hitTest.supported) {
        message('AR Hit Test is not supported');
    } else {
        message('Touch screen to start AR session and look at the floor or walls');
    }
} else {
    message('WebXR is not supported');
}

export { app };

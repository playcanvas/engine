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
const camera = new pc.Entity();
camera.addComponent('camera', {
    clearColor: new pc.Color(0, 0, 0, 0),
    farClip: 10000
});
app.root.addChild(camera);

const l = new pc.Entity();
l.addComponent('light', {
    type: 'spot',
    range: 30
});
l.translate(0, 10, 0);
app.root.addChild(l);

const cone = new pc.Entity();
cone.addComponent('render', {
    type: 'cone'
});
cone.setLocalScale(0.1, 0.1, 0.1);

const materialStandard = new pc.StandardMaterial();

const materialPersistent = new pc.StandardMaterial();
materialPersistent.diffuse = new pc.Color(0.5, 1, 0.5);

const createAnchor = (hitTestResult) => {
    app.xr.anchors.create(hitTestResult, (err, anchor) => {
        if (err) return message('Failed creating Anchor');
        if (!anchor) return message('Anchor has not been created');

        anchor.persist((err, uuid) => {
            if (err) {
                message('Anchor failed to persist');
            }
        });
    });
};

if (app.xr.supported) {
    const activate = function () {
        if (app.xr.isAvailable(pc.XRTYPE_AR)) {
            camera.camera.startXr(pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
                anchors: true,
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
                camera.camera.endXr();
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

    app.xr.anchors.on('available', () => {
        message('Anchors became available');

        // restore all persistent anchors
        if (app.xr.anchors.persistence) {
            const uuids = app.xr.anchors.uuids;
            for (let i = 0; i < uuids.length; i++) {
                app.xr.anchors.restore(uuids[i]);
            }
        }
    });

    app.xr.on('start', function () {
        message('Immersive AR session has started');
    });
    app.xr.on('end', function () {
        message('Immersive AR session has ended');
    });
    app.xr.on('available:' + pc.XRTYPE_AR, function (available) {
        if (available) {
            if (!app.xr.hitTest.supported) {
                message('AR Hit Test is not supported');
            } else if (!app.xr.anchors.supported) {
                message('AR Anchors are not supported');
            } else if (!app.xr.anchors.persistence) {
                message('AR Anchors Persistence is not supported');
            } else {
                message('Touch screen to start AR session and look at the floor or walls');
            }
        } else {
            message('Immersive AR is unavailable');
        }
    });

    // create hit test sources for all input sources
    if (app.xr.hitTest.supported && app.xr.anchors.supported) {
        app.xr.input.on('add', (inputSource) => {
            inputSource.hitTestStart({
                entityTypes: [pc.XRTRACKABLE_MESH],
                callback: (err, hitTestSource) => {
                    if (err) return;

                    let target = new pc.Entity();
                    target.addComponent('render', {
                        type: 'cylinder'
                    });
                    target.setLocalScale(0.1, 0.01, 0.1);
                    app.root.addChild(target);

                    let lastHitTestResult = null;

                    // persistent input sources
                    if (inputSource.targetRayMode === pc.XRTARGETRAY_POINTER) {
                        inputSource.on('select', () => {
                            if (lastHitTestResult) createAnchor(lastHitTestResult);
                        });
                    }

                    hitTestSource.on('result', (position, rotation, inputSource, hitTestResult) => {
                        target.setPosition(position);
                        target.setRotation(rotation);
                        lastHitTestResult = hitTestResult;
                    });

                    hitTestSource.once('remove', () => {
                        target.destroy();
                        target = null;

                        // mobile screen input source
                        if (inputSource.targetRayMode === pc.XRTARGETRAY_SCREEN && lastHitTestResult)
                            createAnchor(lastHitTestResult);

                        lastHitTestResult = null;
                    });
                }
            });
        });
    }

    if (app.xr.anchors.persistence) {
        app.on('update', () => {
            const inputSources = app.xr.input.inputSources;
            for (let i = 0; i < inputSources.length; i++) {
                const inputSource = inputSources[i];

                if (!inputSource.gamepad) continue;

                for (let b = 0; b < inputSource.gamepad.buttons.length; b++) {
                    if (!inputSource.gamepad.buttons[b].pressed) continue;

                    if (b === 0) continue;

                    // clear all persistent anchors
                    const uuids = app.xr.anchors.uuids;
                    for (let a = 0; a < uuids.length; a++) {
                        app.xr.anchors.forget(uuids[a]);
                    }
                    return;
                }
            }
        });
    }

    // create entity for anchors
    app.xr.anchors.on('add', (anchor) => {
        let entity = cone.clone();
        app.root.addChild(entity);
        entity.setPosition(anchor.getPosition());
        entity.setRotation(anchor.getRotation());
        entity.translateLocal(0, 0.05, 0);

        anchor.on('change', () => {
            entity.setPosition(anchor.getPosition());
            entity.setRotation(anchor.getRotation());
            entity.translateLocal(0, 0.05, 0);
        });

        if (anchor.persistent) {
            entity.render.material = materialPersistent;
        }

        anchor.on('persist', () => {
            entity.render.material = materialPersistent;
        });

        anchor.on('forget', () => {
            entity.render.material = materialStandard;
        });

        anchor.once('destroy', () => {
            entity.destroy();
            entity = null;
        });
    });

    if (!app.xr.isAvailable(pc.XRTYPE_AR)) {
        message('Immersive AR is not available');
    } else if (!app.xr.hitTest.supported) {
        message('AR Hit Test is not supported');
    } else if (!app.xr.anchors.supported) {
        message('AR Anchors are not supported');
    } else if (!app.xr.anchors.persistence) {
        message('AR Anchors Persistence is not supported');
    } else {
        message('Touch screen to start AR session and look at the floor or walls');
    }
} else {
    message('WebXR is not supported');
}

export { app };

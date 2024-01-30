import * as pc from 'playcanvas';

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas }) {
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
    l.addComponent("light", {
        type: "spot",
        range: 30
    });
    l.translate(0, 10, 0);
    app.root.addChild(l);

    const target = new pc.Entity();
    target.addComponent('render', {
        type: "cylinder"
    });
    target.setLocalScale(0.1, 0.01, 0.1);
    app.root.addChild(target);

    const cone = new pc.Entity();
    cone.addComponent('render', {
        type: 'cone'
    });
    cone.setLocalScale(0.1, 0.1, 0.1);

    const createAnchor = (hitTestResult) => {
        app.xr.anchors.create(hitTestResult, (err, anchor) => {
            if (err) return message("Failed creating Anchor");
            if (!anchor) return message("Anchor has not been created");

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

            anchor.once('destroy', () => {
                entity.destroy();
                entity = null;
            });
        });
    };

    if (app.xr.supported) {
        const activate = function () {
            if (app.xr.isAvailable(pc.XRTYPE_AR)) {
                c.camera.startXr(pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
                    anchors: true,
                    callback: function (err) {
                        if (err) message("WebXR Immersive AR failed to start: " + err.message);
                    }
                });
            } else {
                message("Immersive AR is not available");
            }
        };

        app.mouse.on("mousedown", function () {
            if (!app.xr.active)
                activate();
        });

        if (app.touch) {
            app.touch.on("touchend", function (evt) {
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

        app.xr.on('start', function () {
            message("Immersive AR session has started");

            if (!app.xr.hitTest.supported || !app.xr.anchors.supported)
                return;

            // provide gaze-like way to create anchors
            // best for mobile phones
            let lastHitTestResult = null;

            app.xr.hitTest.start({
                entityTypes: [pc.XRTRACKABLE_POINT, pc.XRTRACKABLE_PLANE, pc.XRTRACKABLE_MESH],
                callback: function (err, hitTestSource) {
                    if (err) {
                        message("Failed to start AR hit test");
                        return;
                    }

                    hitTestSource.on('result', function (position, rotation, inputSource, hitTestResult) {
                        target.setPosition(position);
                        target.setRotation(rotation);
                        lastHitTestResult = hitTestResult;
                    });
                }
            });

            app.xr.input.on('select', (inputSource) => {
                if (inputSource.targetRayMode !== pc.XRTARGETRAY_SCREEN)
                    return;

                if (!lastHitTestResult)
                    return;

                createAnchor(lastHitTestResult);
            });
        });
        app.xr.on('end', function () {
            message("Immersive AR session has ended");
        });
        app.xr.on('available:' + pc.XRTYPE_AR, function (available) {
            if (available) {
                if (!app.xr.hitTest.supported) {
                    message("AR Hit Test is not supported");
                } else if (!app.xr.anchors.supported) {
                    message("AR Anchors are not supported");
                } else {
                    message("Touch screen to start AR session and look at the floor or walls");
                }
            } else {
                message("Immersive AR is unavailable");
            }
        });

        // create hit test sources for all input sources
        if (app.xr.hitTest.supported && app.xr.anchors.supported) {
            app.xr.input.on('add', (inputSource) => {
                inputSource.hitTestStart({
                    entityTypes: [pc.XRTRACKABLE_POINT, pc.XRTRACKABLE_PLANE],
                    callback: (err, hitTestSource) => {
                        if (err) return;

                        let target = new pc.Entity();
                        target.addComponent("render", {
                            type: "cylinder"
                        });
                        target.setLocalScale(0.1, 0.01, 0.1);
                        app.root.addChild(target);

                        let lastHitTestResult = null;

                        // persistent input sources
                        if (inputSource.targetRayMode === pc.XRTARGETRAY_POINTER) {
                            inputSource.on('select', () => {
                                if (lastHitTestResult)
                                    createAnchor(lastHitTestResult);
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

        if (!app.xr.isAvailable(pc.XRTYPE_AR)) {
            message("Immersive AR is not available");
        } else if (!app.xr.hitTest.supported) {
            message("AR Hit Test is not supported");
        } else if (!app.xr.anchors.supported) {
            message("AR Anchors are not supported");
        } else {
            message("Touch screen to start AR session and look at the floor or walls");
        }
    } else {
        message("WebXR is not supported");
    }
    return app;
}

class ArHitTestAnchorsExample {
    static CATEGORY = 'XR';
    static example = example;
}

export { ArHitTestAnchorsExample };

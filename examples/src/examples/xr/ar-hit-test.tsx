import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';

class ARHitTestExample extends Example {
    static CATEGORY = 'XR';
    static NAME = 'AR Hit Test';

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement): void {
        const message = function (msg: string) {
            let el: HTMLDivElement = document.querySelector('.message');
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

        window.addEventListener("resize", function () {
            app.resizeCanvas(canvas.width, canvas.height);
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
        target.addComponent("model", {
            type: "cylinder"
        });
        target.setLocalScale(0.5, 0.01, 0.5);
        app.root.addChild(target);

        if (app.xr.supported) {
            const activate = function () {
                if (app.xr.isAvailable(pc.XRTYPE_AR)) {
                    c.camera.startXr(pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
                        callback: function (err) {
                            if (err) message("WebXR Immersive AR failed to start: " + err.message);
                        }
                    });
                } else {
                    message("Immersive AR is not available");
                }
            };

            app.mouse.on("mousedown", function () {
                if (! app.xr.active)
                    activate();
            });

            if (app.touch) {
                app.touch.on("touchend", function (evt) {
                    if (! app.xr.active) {
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

                if (! app.xr.hitTest.supported)
                    return;

                app.xr.hitTest.start({
                    entityTypes: [pc.XRTRACKABLE_POINT, pc.XRTRACKABLE_PLANE],
                    callback: function (err, hitTestSource) {
                        if (err) {
                            message("Failed to start AR hit test");
                            return;
                        }

                        hitTestSource.on('result', function (position, rotation) {
                            target.setPosition(position);
                            target.setRotation(rotation);
                        });
                    }
                });
            });
            app.xr.on('end', function () {
                message("Immersive AR session has ended");
            });
            app.xr.on('available:' + pc.XRTYPE_AR, function (available) {
                if (available) {
                    if (app.xr.hitTest.supported) {
                        message("Touch screen to start AR session and look at the floor or walls");
                    } else {
                        message("AR Hit Test is not supported");
                    }
                } else {
                    message("Immersive AR is unavailable");
                }
            });

            if (! app.xr.isAvailable(pc.XRTYPE_AR)) {
                message("Immersive AR is not available");
            } else if (! app.xr.hitTest.supported) {
                message("AR Hit Test is not supported");
            } else {
                message("Touch screen to start AR session and look at the floor or walls");
            }
        } else {
            message("WebXR is not supported");
        }
    }
}

export default ARHitTestExample;

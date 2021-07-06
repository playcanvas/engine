import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class VRTemplateExample extends Example {
    static CATEGORY = 'XR';
    static NAME = 'VR Controllers';

    load() {
        return <>
            <AssetLoader name='glb' type='container' url='static/assets/models/vr-controller.glb' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { glb: pc.Asset }): void {
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
            keyboard: new pc.Keyboard(window)
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
            clearColor: new pc.Color(44 / 255, 62 / 255, 80 / 255)
        });
        app.root.addChild(c);

        const l = new pc.Entity();
        l.addComponent("light", {
            type: "directional",
            castShadows: true,
            shadowBias: 0.05,
            normalOffsetBias: 0.05,
            shadowDistance: 5
        });
        l.setEulerAngles(45, 135, 0);
        app.root.addChild(l);

        const createCube = function (x: number, y: number, z: number) {
            const cube = new pc.Entity();
            cube.addComponent("model", {
                type: "box",
                material: new pc.StandardMaterial()
            });
            cube.translate(x, y, z);
            app.root.addChild(cube);
        };

        const controllers: any = [];
        // create controller model
        const createController = function (inputSource: any) {
            const entity = new pc.Entity();
            entity.addComponent('model', {
                type: 'asset',
                asset: assets.glb.resource.model,
                castShadows: true
            });
            app.root.addChild(entity);
            // @ts-ignore engine-tsd
            entity.inputSource = inputSource;
            controllers.push(entity);

            // destroy input source related entity
            // when input source is removed
            inputSource.on('remove', function () {
                controllers.splice(controllers.indexOf(entity), 1);
                entity.destroy();
            });
        };

        // create a grid of cubes
        const SIZE = 4;
        for (let x = 0; x <= SIZE; x++) {
            for (let y = 0; y <= SIZE; y++) {
                createCube(2 * x - SIZE, -1.5, 2 * y - SIZE);
            }
        }

        if (app.xr.supported) {
            const activate = function () {
                if (app.xr.isAvailable(pc.XRTYPE_VR)) {
                    c.camera.startXr(pc.XRTYPE_VR, pc.XRSPACE_LOCAL, {
                        callback: function (err) {
                            if (err) message("Immersive VR failed to start: " + err.message);
                        }
                    });
                } else {
                    message("Immersive VR is not available");
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

            // when new input source added
            app.xr.input.on('add', function (inputSource) {
                message("Controller Added");
                createController(inputSource);
            });

            message("Tap on screen to enter VR, and see controllers");

            // update position and rotation for each controller
            app.on('update', function () {
                for (let i = 0; i < controllers.length; i++) {
                    const inputSource = controllers[i].inputSource;
                    if (inputSource.grip) {
                        // some controllers can be gripped
                        controllers[i].enabled = true;
                        controllers[i].setLocalPosition(inputSource.getLocalPosition());
                        controllers[i].setLocalRotation(inputSource.getLocalRotation());
                    } else {
                        // some controllers cannot be gripped
                        controllers[i].enabled = false;
                    }
                }
            });
        } else {
            message("WebXR is not supported");
        }
    }
}

export default VRTemplateExample;

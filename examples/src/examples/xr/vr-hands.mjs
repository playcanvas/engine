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
        keyboard: new pc.Keyboard(window)
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

    app.scene.ambientLight = new pc.Color(0.1, 0.1, 0.1);

    app.start();

    // create camera
    const c = new pc.Entity();
    c.addComponent('camera', {
        clearColor: new pc.Color(44 / 255, 62 / 255, 80 / 255)
    });
    app.root.addChild(c);

    const l = new pc.Entity();
    l.addComponent("light", {
        type: "directional"
    });
    l.setEulerAngles(45, 135, 0);
    app.root.addChild(l);
    /**
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @param {number} z - The z coordinate.
     */
    const createCube = function (x, y, z) {
        const cube = new pc.Entity();
        cube.addComponent("render", {
            type: "box",
            material: new pc.StandardMaterial()
        });
        cube.translate(x, y, z);
        app.root.addChild(cube);
    };

    const controllers = [];

    // create controller model
    const createController = function (inputSource) {
        const entity = new pc.Entity();

        if (inputSource.hand) {
            // hand input
            // @ts-ignore engine-tsd
            entity.joints = [];

            const material = new pc.StandardMaterial();

            // create box for each hand joint
            for (let i = 0; i < inputSource.hand.joints.length; i++) {
                const joint = inputSource.hand.joints[i];
                const jointEntity = new pc.Entity();
                jointEntity.addComponent('model', {
                    type: 'box',
                    material: material
                });
                // @ts-ignore engine-tsd
                jointEntity.joint = joint;
                // @ts-ignore engine-tsd
                entity.joints.push(jointEntity);
                entity.addChild(jointEntity);
            }
            // when tracking lost, paint joints to red
            inputSource.hand.on('trackinglost', function () {
                // @ts-ignore engine-tsd
                entity.joints[0].model.material.diffuse.set(1, 0, 0);
                // @ts-ignore engine-tsd
                entity.joints[0].model.material.update();
            });
            // when tracking recovered, paint joints to white
            inputSource.hand.on('tracking', function () {
                // @ts-ignore engine-tsd
                entity.joints[0].model.material.diffuse.set(1, 1, 1);
                // @ts-ignore engine-tsd
                entity.joints[0].model.material.update();
            });
        } else {
            // other inputs
            entity.addComponent('model', {
                type: 'box',
                castShadows: true
            });
            entity.setLocalScale(0.05, 0.05, 0.05);
        }

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

        // when new input source added
        app.xr.input.on('add', function (inputSource) {
            message("Controller Added");
            createController(inputSource);
        });

        if (window.XRHand) {
            message("Tap on screen to enter VR, and switch to hand input");
        } else {
            message("WebXR Hands Input is not supported by your platform");
        }

        // update position and rotation for each controller
        app.on('update', function () {
            for (let i = 0; i < controllers.length; i++) {
                const inputSource = controllers[i].inputSource;

                if (inputSource.hand) {
                    // hand input source
                    controllers[i].enabled = true;
                    // update each hand joint
                    for (let j = 0; j < controllers[i].joints.length; j++) {
                        const joint = controllers[i].joints[j].joint;
                        const r = joint.radius * 2;
                        controllers[i].joints[j].setLocalScale(r, r, r);
                        controllers[i].joints[j].setPosition(joint.getPosition());
                        controllers[i].joints[j].setRotation(joint.getRotation());
                    }
                } else if (inputSource.grip) {
                    // grippable input source
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
    return app;
}

class VrHandsExample {
    static CATEGORY = 'XR';
    static example = example;
}

export { VrHandsExample };

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

app.start();

// create camera parent
const cameraParent = new pc.Entity();
app.root.addChild(cameraParent);

// create camera
const c = new pc.Entity();
c.addComponent('camera', {
    clearColor: new pc.Color(44 / 255, 62 / 255, 80 / 255),
    farClip: 10000
});
cameraParent.addChild(c);

const l = new pc.Entity();
l.addComponent('light', {
    type: 'spot',
    range: 30
});
l.translate(0, 10, 0);
app.root.addChild(l);

/**
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} z - The z coordinate.
 */
const createCube = function (x, y, z) {
    const cube = new pc.Entity();
    cube.addComponent('render', {
        type: 'box',
        material: new pc.StandardMaterial()
    });
    cube.setLocalScale(1, 1, 1);
    cube.translate(x, y, z);
    app.root.addChild(cube);
};

const controllers = [];
// create controller box
const createController = function (inputSource) {
    const entity = new pc.Entity();
    entity.addComponent('model', {
        type: 'box'
    });
    entity.setLocalScale(0.05, 0.05, 0.05);
    cameraParent.addChild(entity);
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
                    if (err) message('Immersive VR failed to start: ' + err.message);
                }
            });
        } else {
            message('Immersive VR is not available');
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

    // when new input source added
    app.xr.input.on('add', function (inputSource) {
        createController(inputSource);
    });

    message('Tap on screen to enter VR, use left thumbstick to move and right thumbstick to rotate');

    const movementSpeed = 1.5; // 1.5 m/s
    const rotateSpeed = 45;
    const rotateThreshold = 0.5;
    const rotateResetThreshold = 0.25;
    let lastRotateValue = 0;

    const tmpVec2A = new pc.Vec2();
    const tmpVec2B = new pc.Vec2();
    const tmpVec3A = new pc.Vec3();
    const tmpVec3B = new pc.Vec3();
    const lineColor = new pc.Color(1, 1, 1);

    // update position and rotation for each controller
    app.on('update', function (dt) {
        let i, inputSource;

        // first we update movement
        for (i = 0; i < controllers.length; i++) {
            inputSource = controllers[i].inputSource;

            // should have gamepad
            if (!inputSource.gamepad) continue;

            // left controller - for movement
            if (inputSource.handedness === pc.XRHAND_LEFT) {
                // set vector based on gamepad thumbstick axes values
                tmpVec2A.set(inputSource.gamepad.axes[2], inputSource.gamepad.axes[3]);

                // if there is input
                if (tmpVec2A.length()) {
                    tmpVec2A.normalize();

                    // we need to take in account camera facing
                    // so we figure out Yaw of camera
                    tmpVec2B.x = c.forward.x;
                    tmpVec2B.y = c.forward.z;
                    tmpVec2B.normalize();

                    const rad = Math.atan2(tmpVec2B.x, tmpVec2B.y) - Math.PI / 2;
                    // and rotate our movement vector based on camera yaw
                    const t = tmpVec2A.x * Math.sin(rad) - tmpVec2A.y * Math.cos(rad);
                    tmpVec2A.y = tmpVec2A.y * Math.sin(rad) + tmpVec2A.x * Math.cos(rad);
                    tmpVec2A.x = t;

                    // set movement speed
                    tmpVec2A.mulScalar(movementSpeed * dt);
                    // move camera parent based on calculated movement vector
                    cameraParent.translate(tmpVec2A.x, 0, tmpVec2A.y);
                }

                // right controller - for rotation
            } else if (inputSource.handedness === pc.XRHAND_RIGHT) {
                // get rotation from thumbsitck
                const rotate = -inputSource.gamepad.axes[2];

                // each rotate should be done by moving thumbstick to the side enough
                // then thumbstick should be moved back close to neutral position
                // before it can be used again to rotate
                if (lastRotateValue > 0 && rotate < rotateResetThreshold) {
                    lastRotateValue = 0;
                } else if (lastRotateValue < 0 && rotate > -rotateResetThreshold) {
                    lastRotateValue = 0;
                }

                // if thumbstick is reset and moved enough to the side
                if (lastRotateValue === 0 && Math.abs(rotate) > rotateThreshold) {
                    lastRotateValue = Math.sign(rotate);

                    // we want to rotate relative to camera position
                    tmpVec3A.copy(c.getLocalPosition());
                    cameraParent.translateLocal(tmpVec3A);
                    cameraParent.rotateLocal(0, Math.sign(rotate) * rotateSpeed, 0);
                    cameraParent.translateLocal(tmpVec3A.mulScalar(-1));
                }
            }
        }

        // after movement and rotation is done
        // we update/render controllers
        for (i = 0; i < controllers.length; i++) {
            inputSource = controllers[i].inputSource;

            // render controller ray
            tmpVec3A.copy(inputSource.getOrigin());
            tmpVec3B.copy(inputSource.getDirection());
            tmpVec3B.mulScalar(100).add(tmpVec3A);
            app.drawLine(tmpVec3A, tmpVec3B, lineColor);

            // render controller
            if (inputSource.grip) {
                // some controllers can be gripped
                controllers[i].model.enabled = true;
                controllers[i].setLocalPosition(inputSource.getLocalPosition);
                controllers[i].setLocalRotation(inputSource.getLocalRotation);
            } else {
                // some controllers cannot be gripped
                controllers[i].model.enabled = false;
            }
        }
    });
} else {
    message('WebXR is not supported');
}

export { app };

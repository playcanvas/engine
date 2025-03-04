import {
    platform,
    FlyModel,
    JoystickDoubleInput,
    JoystickTouchInput,
    KeyboardMouseInput,
    Mat4,
    MultiTouchInput,
    OrbitModel,
    Vec2,
    Vec3
} from 'playcanvas';

/** @import { AppBase, CameraComponent } from 'playcanvas' */

const tmpM1 = new Mat4();
const tmpVa = new Vec2();
const tmpV1 = new Vec3();

class CameraControls {
    /**
     * @type {string}
     * @static
     */
    static MODE_FLY = 'fly';

    /**
     * @type {string}
     * @static
     */
    static MODE_ORBIT = 'orbit';

    /**
     * @type {AppBase}
     * @private
     */
    _app;

    /**
     * @type {CameraComponent}
     * @private
     */
    _camera;

    /**
     * @type {number}
     * @private
     */
    _zoom = 0;

    /**
     * @type {KeyboardMouseInput}
     * @private
     */
    _desktopInput;

    /**
     * @type {MultiTouchInput}
     * @private
     */
    _orbitMobileInput;

    /**
     * @type {JoystickTouchInput}
     * @private
     */
    _flyMobileInput;

    /**
     * @type {KeyboardMouseInput|JoystickDoubleInput|JoystickTouchInput|MultiTouchInput}
     * @private
     */
    _input;

    /**
     * @type {FlyModel}
     * @private
     */
    _flyModel;

    /**
     * @type {OrbitModel}
     * @private
     */
    _orbitModel;

    /**
     * @type {FlyModel|OrbitModel}
     * @private
     */
    _model;

    /**
     * @type {string}
     * @private
     */
    _mode;

    /**
     * @type {number}
     * @private
     */
    _panning = 0;

    /**
     * @type {Vec3}
     * @private
     */
    _moveAxes = new Vec3();

    /**
     * @type {number}
     * @private
     */
    _moveFast = 0;

    /**
     * @type {number}
     * @private
     */
    _moveSlow = 0;

    /**
     * @type {boolean}
     */
    enableFly = true;

    /**
     * @type {boolean}
     */
    enableOrbit = true;

    /**
     * @type {boolean}
     */
    enablePanning = true;

    /**
     * @type {number}
     */
    moveFastMult = 2;

    /**
     * @type {number}
     */
    moveSlowMult = 0.5;

    /**
     * @type {number}
     */
    pinchMult = 5;

    /**
     * @type {number}
     */
    joytickRotateMult = 2;

    /**
     * @param {Object} options - The options.
     * @param {AppBase} options.app - The application.
     * @param {CameraComponent} options.camera - The camera.
     * @param {string} options.mode - The mode.
     * @param {Vec3} [options.focus] - The focus.
     */
    constructor({ app, camera, mode, focus }) {
        this._app = app;
        this._camera = camera;

        // input
        this._desktopInput = new KeyboardMouseInput();
        this._orbitMobileInput = new MultiTouchInput();
        this._flyMobileInput = new JoystickTouchInput();

        // models
        this._flyModel = new FlyModel();
        this._orbitModel = new OrbitModel();

        // focus
        if (focus) {
            this.focusPoint = focus;
            this.update(0);
        }

        // mode
        this.mode = mode ?? CameraControls.MODE_ORBIT;
    }

    set focusPoint(point) {
        this.mode = CameraControls.MODE_ORBIT;

        if (this._model instanceof OrbitModel) {
            const start = this._camera.entity.getPosition();
            this._zoom = start.distance(point);
            this._model.focus(point, start, false);
        }
    }

    get focusPoint() {
        this.mode = CameraControls.MODE_ORBIT;

        if (this._model instanceof OrbitModel) {
            return this._model.point;
        }
        return this._camera.entity.getPosition();
    }

    set mode(mode) {
        if (this._mode === mode) {
            return;
        }

        // mode validation
        if (this.mode) {
            if (mode === CameraControls.MODE_FLY && !this.enableFly) {
                return;
            }
            if (mode === CameraControls.MODE_ORBIT && !this.enableOrbit) {
                return;
            }

            this._mode = mode;
        } else {
            switch (true) {
                case this.enableFly && this.enableOrbit: {
                    this._mode = mode;
                    break;
                }
                case this.enableFly && !this.enableOrbit: {
                    this._mode = CameraControls.MODE_FLY;
                    break;
                }
                case !this.enableFly && this.enableOrbit: {
                    this._mode = CameraControls.MODE_ORBIT;
                    break;
                }
                case !this.enableFly && !this.enableOrbit: {
                    console.warn('CameraControls: both fly and orbit modes are disabled');
                    return;
                }
            }
        }

        // determine input and model
        let input, model;
        if (this._mode === CameraControls.MODE_FLY) {
            input = platform.mobile ? this._flyMobileInput : this._desktopInput;
            model = this._flyModel;
        } else {
            input = platform.mobile ? this._orbitMobileInput : this._desktopInput;
            model = this._orbitModel;
        }

        // input reattach
        if (input !== this._input) {
            if (this._input) {
                this._input.detach();
            }
            this._input = input;
            this._input.attach(this._app.graphicsDevice.canvas);
        }

        // model reattach
        if (model !== this._model) {
            if (this._model) {
                this._model.detach();
            }
            this._model = model;
            this._model.attach(this._camera.entity.getWorldTransform());
        }

        // refocus if orbit mode
        if (this._model instanceof OrbitModel) {
            const start = this._camera.entity.getPosition();
            const point = tmpV1.copy(this._camera.entity.forward).mulScalar(this._zoom).add(start);
            this._model.focus(point, start, false);
        }

        console.log(`CameraControls: mode set to ${this._mode}`);
    }

    get mode() {
        return this._mode;
    }

    set rotateSpeed(speed) {
        this._flyModel.rotateSpeed = speed;
        this._orbitModel.rotateSpeed = speed;
    }

    get rotateSpeed() {
        return this._model.rotateSpeed;
    }

    set rotateDamping(damping) {
        this._flyModel.rotateDamping = damping;
        this._orbitModel.rotateDamping = damping;
    }

    get rotateDamping() {
        return this._model.rotateDamping;
    }

    set moveSpeed(speed) {
        this._flyModel.moveSpeed = speed;
    }

    get moveSpeed() {
        return this._flyModel.moveSpeed;
    }

    set moveDamping(damping) {
        this._flyModel.moveDamping = damping;
    }

    get moveDamping() {
        return this._flyModel.moveDamping;
    }

    set zoomSpeed(speed) {
        this._orbitModel.zoomSpeed = speed;
    }

    get zoomSpeed() {
        return this._orbitModel.zoomSpeed;
    }

    set zoomDamping(damping) {
        this._orbitModel.zoomDamping = damping;
    }

    get zoomDamping() {
        return this._orbitModel.zoomDamping;
    }

    set pitchRange(range) {
        this._flyModel.pitchRange = range;
        this._orbitModel.pitchRange = range;
    }

    get pitchRange() {
        return this._model.pitchRange;
    }

    set yawRange(range) {
        this._flyModel.yawRange = range;
        this._orbitModel.yawRange = range;
    }

    get yawRange() {
        return this._model.yawRange;
    }

    set zoomRange(range) {
        this._orbitModel.zoomRange = range;
    }

    get zoomRange() {
        return this._orbitModel.zoomRange;
    }

    /**
     * @param {Vec3} point - The focus point.
     */
    focus(point) {
        this.mode = CameraControls.MODE_ORBIT;

        if (this._model instanceof OrbitModel) {
            this._model.focus(point);
        }
    }

    /**
     * @param {Vec3} point - The focus point.
     * @param {boolean} [resetZoom] - Whether to reset the zoom.
     */
    look(point, resetZoom = false) {
        this.mode = CameraControls.MODE_ORBIT;

        if (this._model instanceof OrbitModel) {
            if (resetZoom) {
                const start = tmpV1.copy(this._camera.entity.getPosition())
                .sub(point)
                .normalize()
                .mulScalar(this._zoom)
                .add(point);
                this._model.focus(point, start);
            } else {
                this._model.focus(point, this._camera.entity.getPosition());
            }
        }
    }

    /**
     * @param {Vec3} point - The focus point.
     * @param {Vec3} start - The start point.
     */
    reset(point, start) {
        this.mode = CameraControls.MODE_ORBIT;

        if (this._model instanceof OrbitModel) {
            this._model.focus(point, start);
        }
    }

    /**
     * @param {number} dt - The time delta.
     */
    update(dt) {
        if (this._app.xr?.active) {
            return;
        }

        // desktop input
        if (this._input instanceof KeyboardMouseInput) {
            const { key, button, mouse, wheel } = this._input.frame();
            const [
                forward,
                back,
                left,
                right,
                up,
                down,
                fast,
                slow
            ] = key;

            // left mouse button, middle mouse button, mouse wheel
            const switchToOrbit = button[0] === 1 || button[1] === 1 || wheel[0] !== 0;

            // right mouse button or any key
            const switchToFly = button[2] === 1 || key.some(k => k === 1);

            if (switchToOrbit) {
                this.mode = CameraControls.MODE_ORBIT;
            } else if (switchToFly) {
                this.mode = CameraControls.MODE_FLY;
            }

            this._moveAxes.add(tmpV1.set(right - left, up - down, forward - back));
            this._moveFast += fast;
            this._moveSlow += slow;
            const mult = this._moveFast ?
                this.moveFastMult : this._moveSlow ?
                    this.moveSlowMult : 1;
            this._panning += button[1];

            if (this._model instanceof OrbitModel) {
                tmpM1.copy(this._model.update({
                    drag: tmpVa.fromArray(mouse),
                    zoom: wheel[0],
                    pan: !!this._panning && this.enablePanning
                }, this._camera, dt));
            } else {
                tmpM1.copy(this._model.update({
                    rotate: tmpVa.fromArray(mouse),
                    move: tmpV1.copy(this._moveAxes).normalize().mulScalar(mult)
                }, dt));
            }
        }

        // orbit only input
        if (this._model instanceof OrbitModel) {
            // orbit mobile
            if (this._input instanceof MultiTouchInput) {
                const { touch, pinch, count } = this._input.frame();

                tmpM1.copy(this._model.update({
                    drag: tmpVa.fromArray(touch),
                    zoom: pinch[0] * this.pinchMult,
                    pan: count[0] > 1 && this.enablePanning
                }, this._camera, dt));
            }
        }

        // fly only input
        if (this._model instanceof FlyModel) {
            // fly mobile (joystick + touch)
            if (this._input instanceof JoystickTouchInput) {
                const { stick, touch } = this._input.frame();

                tmpM1.copy(this._model.update({
                    rotate: tmpVa.fromArray(touch),
                    move: tmpV1.set(stick[0], 0, -stick[1])
                }, dt));
            }

            // fly mobile (joystick x2)
            if (this._input instanceof JoystickDoubleInput) {
                const { leftStick, rightStick } = this._input.frame();

                tmpM1.copy(this._model.update({
                    rotate: tmpVa.fromArray(rightStick).mulScalar(this.joytickRotateMult),
                    move: tmpV1.set(leftStick[0], 0, -leftStick[1])
                }, dt));
            }
        }

        this._camera.entity.setPosition(tmpM1.getTranslation());
        this._camera.entity.setEulerAngles(tmpM1.getEulerAngles());
    }

    destroy() {
        this._desktopInput.destroy();
        this._orbitMobileInput.destroy();
        this._flyMobileInput.destroy();

        this._flyModel.destroy();
        this._orbitModel.destroy();
    }
}

export { CameraControls };

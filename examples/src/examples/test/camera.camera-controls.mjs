import * as pc from 'playcanvas';

const tmpM1 = new pc.Mat4();
const tmpVa = new pc.Vec2();
const tmpV1 = new pc.Vec3();

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
     * @type {pc.AppBase}
     * @private
     */
    _app;

    /**
     * @type {pc.CameraComponent}
     * @private
     */
    _camera;

    /**
     * @type {number}
     * @private
     */
    _zoom = 0;

    /**
     * @type {pc.KeyboardMouseInput}
     * @private
     */
    _orbitDesktopInput;

    /**
     * @type {pc.MultiTouchInput}
     * @private
     */
    _orbitMobileInput;

    /**
     * @type {pc.KeyboardMouseInput}
     * @private
     */
    _flyDesktopInput;

    /**
     * @type {pc.JoystickTouchInput}
     * @private
     */
    _flyMobileInput;

    /**
     * @type {pc.KeyboardMouseInput|pc.JoystickDoubleInput|pc.JoystickTouchInput|pc.MultiTouchInput}
     * @private
     */
    _input;

    /**
     * @type {pc.FlyModel}
     * @private
     */
    _flyModel;

    /**
     * @type {pc.OrbitModel}
     * @private
     */
    _orbitModel;

    /**
     * @type {pc.FlyModel|pc.OrbitModel}
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
     * @type {pc.Vec3}
     * @private
     */
    _moveAxes = new pc.Vec3();

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
     * @param {pc.AppBase} options.app - The application.
     * @param {pc.CameraComponent} options.camera - The camera.
     * @param {string} options.mode - The mode.
     * @param {pc.Vec3} [options.focus] - The focus.
     */
    constructor({ app, camera, mode, focus }) {
        this._app = app;
        this._camera = camera;

        // input
        this._orbitDesktopInput = new pc.KeyboardMouseInput();
        this._orbitMobileInput = new pc.MultiTouchInput();
        this._flyDesktopInput = new pc.KeyboardMouseInput();
        this._flyMobileInput = new pc.JoystickTouchInput();

        // models
        this._flyModel = new pc.FlyModel();
        this._flyModel.rotateSpeed = 0.3;
        this._flyModel.rotateDamping = 0.95;
        this._orbitModel = new pc.OrbitModel();
        this._orbitModel.rotateSpeed = 0.3;
        this._orbitModel.rotateDamping = 0.95;

        // mode
        this.mode = mode ?? CameraControls.MODE_ORBIT;

        // focus
        if (focus) {
            this.focusPoint = focus;
        }
    }

    /**
     * @type {pc.Vec3}
     */
    set focusPoint(point) {
        if (this._model instanceof pc.OrbitModel) {
            const start = this._camera.entity.getPosition();
            this._zoom = start.distance(point);
            this._model.focus(start, point, false);
        }
    }

    get focusPoint() {
        if (this._model instanceof pc.OrbitModel) {
            return this._model.point;
        }
        return this._camera.entity.getPosition();
    }

    set mode(mode) {
        if (this._mode === mode) {
            return;
        }

        this._mode = mode;

        this._panning = 0;
        this._moveAxes.set(0, 0, 0);
        this._moveFast = 0;
        this._moveSlow = 0;

        if (this._input) {
            this._input.detach();
        }

        if (this._model) {
            this._model.detach();
        }

        if (this._mode === CameraControls.MODE_FLY) {
            this._input = pc.platform.mobile ? this._flyMobileInput : this._flyDesktopInput;
            this._model = this._flyModel;
        } else {
            this._input = pc.platform.mobile ? this._orbitMobileInput : this._orbitDesktopInput;
            this._model = this._orbitModel;
        }

        this._input.attach(this._app.graphicsDevice.canvas);
        this._model.attach(this._camera.entity.getWorldTransform());

        if (this._model instanceof pc.OrbitModel) {
            const start = this._camera.entity.getPosition();
            const point = tmpV1.copy(this._camera.entity.forward).mulScalar(this._zoom).add(start);
            this._model.focus(start, point, false);
        }

        console.log(`CameraControls: mode set to ${mode}`);
    }

    get mode() {
        return this._mode;
    }

    /**
     * @param {pc.Vec3} point - The focus point.
     * @param {boolean} [resetZoom] - Whether to reset the zoom.
     */
    focus(point, resetZoom = true) {
        if (this._model instanceof pc.OrbitModel) {
            if (resetZoom) {
                const start = tmpV1.copy(this._camera.entity.getPosition())
                .sub(point)
                .normalize()
                .mulScalar(this._zoom)
                .add(point);
                this._model.focus(start, point);
            } else {
                this._model.focus(this._camera.entity.getPosition(), point);
            }
        }
    }

    /**
     * @param {pc.Vec3} start - The start point.
     * @param {pc.Vec3} point - The focus point.
     */
    reset(start, point) {
        if (this._model instanceof pc.OrbitModel) {
            this._model.focus(start, point);
        }
    }

    /**
     * @param {number} dt - The time delta.
     */
    update(dt) {
        if (this._app.xr?.active) {
            return;
        }

        if (this._model instanceof pc.OrbitModel) {
            // orbit desktop
            if (this._input instanceof pc.KeyboardMouseInput) {
                const { button, mouse, wheel } = this._input.frame();
                this._panning += button[2];

                tmpM1.copy(this._model.update({
                    drag: tmpVa.fromArray(mouse),
                    zoom: wheel[0],
                    pan: !!this._panning
                }, this._camera, dt));
            }

            // orbit mobile
            if (this._input instanceof pc.MultiTouchInput) {
                const { touch, pinch, count } = this._input.frame();

                tmpM1.copy(this._model.update({
                    drag: tmpVa.fromArray(touch),
                    zoom: pinch[0] * this.pinchMult,
                    pan: count[0] > 1
                }, this._camera, dt));
            }
        } else {
            // fly desktop
            if (this._input instanceof pc.KeyboardMouseInput) {
                const { key, mouse } = this._input.frame();
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
                this._moveAxes.add(tmpV1.set(right - left, up - down, forward - back));
                this._moveFast += fast;
                this._moveSlow += slow;
                const mult = this._moveFast ?
                    this.moveFastMult : this._moveSlow ?
                        this.moveSlowMult : 1;

                tmpM1.copy(this._model.update({
                    rotate: tmpVa.fromArray(mouse),
                    move: tmpV1.copy(this._moveAxes).normalize().mulScalar(mult)
                }, dt));
            }

            // fly mobile (joystick + touch)
            if (this._input instanceof pc.JoystickTouchInput) {
                const { stick, touch } = this._input.frame();

                tmpM1.copy(this._model.update({
                    rotate: tmpVa.fromArray(touch),
                    move: tmpV1.set(stick[0], 0, -stick[1])
                }, dt));
            }

            // fly mobile (joystick x2)
            if (this._input instanceof pc.JoystickDoubleInput) {
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
        this._orbitDesktopInput.destroy();
        this._orbitMobileInput.destroy();
        this._flyDesktopInput.destroy();
        this._flyMobileInput.destroy();

        this._flyModel.destroy();
        this._orbitModel.destroy();
    }
}

export { CameraControls };

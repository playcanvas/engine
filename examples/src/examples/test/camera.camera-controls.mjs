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
     */
    _app;

    /**
     * @type {pc.CameraComponent}
     */
    _camera;

    /**
     * @type {pc.KeyboardMouseInput|pc.JoystickDoubleInput|pc.JoystickTouchInput|pc.MultiTouchInput}
     * @private
     */
    _input;

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

        // mode
        this._mode = mode ?? CameraControls.MODE_ORBIT;

        // input
        if (pc.platform.mobile) {
            this._input = this._mode === CameraControls.MODE_FLY ? new pc.JoystickDoubleInput() : new pc.MultiTouchInput();
        } else {
            this._input = new pc.KeyboardMouseInput();
        }
        this._input.attach(this._app.graphicsDevice.canvas);

        // model
        this._model = this._mode === CameraControls.MODE_FLY ? new pc.FlyModel() : new pc.OrbitModel();
        this._model.rotateSpeed = 0.3;
        this._model.rotateDamping = 0.95;
        this._model.attach(this._camera.entity.getWorldTransform());

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
            this._model.focus(this._camera.entity.getPosition(), point, false);
        }
    }

    get focusPoint() {
        if (this._model instanceof pc.OrbitModel) {
            return this._model.point;
        }
        return this._camera.entity.getPosition();
    }

    /**
     * @param {pc.Vec3} point - The focus point.
     * @param {number} [distance] - The distance from focus point.
     */
    focus(point, distance) {
        if (this._model instanceof pc.OrbitModel) {
            if (distance !== undefined) {
                const start = tmpV1.copy(this._camera.entity.getPosition())
                .sub(point)
                .normalize()
                .mulScalar(distance)
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
                    move: tmpV1.copy(this._moveAxes).mulScalar(mult)
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
        this._model.destroy();
        this._input.destroy();
    }
}

export { CameraControls };

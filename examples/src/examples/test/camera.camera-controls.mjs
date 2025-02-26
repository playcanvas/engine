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
     * @type {pc.KeyboardMouseInput|pc.JoystickTouchInput|pc.MultiTouchInput}
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
     */
    _mode;

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
    panButton = 2;

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
            this._input = this._mode === CameraControls.MODE_FLY ? new pc.JoystickTouchInput() : new pc.MultiTouchInput();
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
            this.focus(focus);
        }
    }

    /**
     * @param {pc.Vec3} point - The point.
     */
    focus(point) {
        if (this._model instanceof pc.OrbitModel) {
            this._model.focus(this._camera.entity.getPosition(), point);
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
            if (this._input instanceof pc.KeyboardMouseInput) {
                const [
                    ,,,,,,,,
                    mouseX,
                    mouseY,
                    wheel,
                    button
                ] = this._input.frame();
                tmpM1.copy(this._model.update({
                    drag: tmpVa.set(mouseX, mouseY),
                    zoom: wheel,
                    pan: button === this.panButton
                }, this._camera, dt));
            }
            if (this._input instanceof pc.MultiTouchInput) {
                const [
                    touchX,
                    touchY,
                    pinch,
                    multi
                ] = this._input.frame();
                tmpM1.copy(this._model.update({
                    drag: tmpVa.set(touchX, touchY),
                    zoom: pinch * this.pinchMult,
                    pan: !!multi
                }, this._camera, dt));
            }
        } else {
            if (this._input instanceof pc.KeyboardMouseInput) {
                const [
                    keyForward,
                    keyBack,
                    keyLeft,
                    keyRight,
                    keyUp,
                    keyDown,
                    keyFast,
                    keySlow,
                    mouseX,
                    mouseY
                ] = this._input.frame();
                const mult = keyFast ? this.moveFastMult : keySlow ? this.moveSlowMult : 1;
                tmpM1.copy(this._model.update({
                    rotate: tmpVa.set(mouseX, mouseY),
                    move: tmpV1.set(
                        (keyRight - keyLeft) * mult,
                        (keyUp - keyDown) * mult,
                        (keyForward - keyBack) * mult
                    )
                }, dt));
            }
            if (this._input instanceof pc.JoystickTouchInput) {
                const [
                    stickX,
                    stickY,
                    touchX,
                    touchY
                ] = this._input.frame();
                tmpM1.copy(this._model.update({
                    rotate: tmpVa.set(touchX, touchY),
                    move: tmpV1.set(stickX, 0, stickY)
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

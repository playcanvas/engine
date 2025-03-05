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
    Vec3,
    math
} from 'playcanvas';

/** @import { AppBase, CameraComponent, EventHandler } from 'playcanvas' */

const tmpM1 = new Mat4();
const tmpVa = new Vec2();
const tmpV1 = new Vec3();

const ZOOM_SCALE_MULT = 10;
const JOYSTICK_BASE_SIZE = 100;
const JOYSTICK_STICK_SIZE = 60;

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
     * @type {JoystickTouchInput | JoystickDoubleInput}
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
    sceneSize = 100;

    /**
     * @type {number}
     */
    rotateSpeed = 0.2;

    /**
     * @type {number}
     */
    rotateJoystickSens = 2;

    /**
     * @type {number}
     */
    moveSpeed = 2;

    /**
     * @type {number}
     */
    moveFastSpeed = 4;

    /**
     * @type {number}
     */
    moveSlowSpeed = 1;

    /**
     * @type {number}
     */
    zoomSpeed = 0.005;

    /**
     * @type {number}
     */
    zoomPinchSens = 5;

    /**
     * @type {number}
     */
    zoomScaleMin;

    /**
     * @param {Object} options - The options.
     * @param {AppBase} options.app - The application.
     * @param {CameraComponent} options.camera - The camera.
     * @param {string} options.mode - The mode.
     * @param {Vec3} [options.focus] - The focus.
     * @param {number} [options.sceneSize] - The scene size.
     * @param {boolean} [options.doubleStick] - Whether to use double stick.
     */
    constructor({ app, camera, mode, focus, sceneSize, doubleStick }) {
        this._app = app;
        this._camera = camera;

        // zoom scale min
        this.zoomScaleMin = this._camera.nearClip;

        // input
        this._desktopInput = new KeyboardMouseInput();
        this._orbitMobileInput = new MultiTouchInput();
        this._flyMobileInput = doubleStick ? new JoystickDoubleInput() : new JoystickTouchInput();

        // models
        this._flyModel = new FlyModel();
        this._orbitModel = new OrbitModel();

        // focus
        if (focus) {
            this.focusPoint = focus;
            this.update(0);
        }

        // scene size
        this.sceneSize = sceneSize ?? this.sceneSize;

        // mode
        this.mode = mode ?? CameraControls.MODE_ORBIT;

        // ui
        if (this._flyMobileInput instanceof JoystickDoubleInput) {
            this._createJoystickUI(this._flyMobileInput.leftJoystick, JOYSTICK_BASE_SIZE, JOYSTICK_STICK_SIZE);
            this._createJoystickUI(this._flyMobileInput.rightJoystick, JOYSTICK_BASE_SIZE, JOYSTICK_STICK_SIZE);
        } else {
            this._createJoystickUI(this._flyMobileInput.joystick, JOYSTICK_BASE_SIZE, JOYSTICK_STICK_SIZE);
        }
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

        this._moveAxes.set(0, 0, 0);
        this._moveFast = 0;
        this._moveSlow = 0;
        this._panning = 0;

        console.log(`CameraControls: mode set to ${this._mode}`);
    }

    get mode() {
        return this._mode;
    }

    set rotateDamping(damping) {
        this._flyModel.rotateDamping = damping;
        this._orbitModel.rotateDamping = damping;
    }

    get rotateDamping() {
        return this._model.rotateDamping;
    }

    set moveDamping(damping) {
        this._flyModel.moveDamping = damping;
    }

    get moveDamping() {
        return this._flyModel.moveDamping;
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
     * @param {EventHandler} joystick - The joystick.
     * @param {number} baseSize - The base size.
     * @param {number} stickSize - The stick size.
     * @private
     */
    _createJoystickUI(joystick, baseSize, stickSize) {
        const base = document.createElement('div');
        Object.assign(base.style, {
            display: 'none',
            position: 'absolute',
            width: `${baseSize}px`,
            height: `${baseSize}px`,
            borderRadius: '50%',
            backgroundColor: 'rgba(50, 50, 50, 0.5)',
            boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.5)'
        });

        const stick = document.createElement('div');
        Object.assign(stick.style, {
            display: 'none',
            position: 'absolute',
            width: `${stickSize}px`,
            height: `${stickSize}px`,
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
            boxShadow: 'inset 0 0 10px rgba(0, 0, 0, 0.5)'
        });

        joystick.on('position:base', (x, y) => {
            const left = x - baseSize * 0.5;
            const top = y - baseSize * 0.5;

            base.style.display = 'block';
            base.style.left = `${left}px`;
            base.style.top = `${top}px`;
        });
        joystick.on('position:stick', (x, y) => {
            const left = x - stickSize * 0.5;
            const top = y - stickSize * 0.5;

            stick.style.display = 'block';
            stick.style.left = `${left}px`;
            stick.style.top = `${top}px`;
        });
        joystick.on('reset', () => {
            base.style.display = 'none';
            stick.style.display = 'none';
        });

        document.body.append(base, stick);
    }

    /**
     * @param {Vec3} move - The move delta.
     * @returns {Vec3} The scaled delta.
     * @private
     */
    _scaleMove(move) {
        const speed = this._moveFast ?
            this.moveFastSpeed : this._moveSlow ?
                this.moveSlowSpeed : this.moveSpeed;
        return move.mulScalar(speed * this.sceneSize);
    }

    /**
     * @param {number} zoom - The delta.
     * @returns {number} The scaled delta.
     * @private
     */
    _scaleZoom(zoom) {
        if (!(this._model instanceof OrbitModel)) {
            return 0;
        }
        const norm = this._model.zoom / (ZOOM_SCALE_MULT * this.sceneSize);
        const scale = math.clamp(norm, this.zoomScaleMin, 1);
        return zoom * scale * this.zoomSpeed * this.sceneSize;
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
            this._panning += button[1];

            if (this._model instanceof OrbitModel) {
                const pan = !!this._panning && this.enablePanning;
                tmpM1.copy(this._model.update({
                    drag: tmpVa.fromArray(mouse).mulScalar(pan ? 1 : this.rotateSpeed),
                    zoom: this._scaleZoom(wheel[0]),
                    pan
                }, this._camera, dt));
            } else {
                tmpM1.copy(this._model.update({
                    rotate: tmpVa.fromArray(mouse).mulScalar(this.rotateSpeed),
                    move: this._scaleMove(tmpV1.copy(this._moveAxes).normalize())
                }, dt));
            }
        }

        // orbit only input
        if (this._model instanceof OrbitModel) {
            // orbit mobile
            if (this._input instanceof MultiTouchInput) {
                const { touch, pinch, count } = this._input.frame();

                const pan = count[0] > 1 && this.enablePanning;
                tmpM1.copy(this._model.update({
                    drag: tmpVa.fromArray(touch).mulScalar(pan ? 1 : this.rotateSpeed),
                    zoom: this._scaleZoom(pinch[0]) * this.zoomPinchSens,
                    pan
                }, this._camera, dt));
            }
        }

        // fly only input
        if (this._model instanceof FlyModel) {
            // fly mobile (joystick + touch)
            if (this._input instanceof JoystickTouchInput) {
                const { stick, touch } = this._input.frame();

                tmpM1.copy(this._model.update({
                    rotate: tmpVa.fromArray(touch).mulScalar(this.rotateSpeed),
                    move: this._scaleMove(tmpV1.set(stick[0], 0, -stick[1]))
                }, dt));
            }

            // fly mobile (joystick x2)
            if (this._input instanceof JoystickDoubleInput) {
                const { leftStick, rightStick } = this._input.frame();

                tmpM1.copy(this._model.update({
                    rotate: tmpVa.fromArray(rightStick).mulScalar(this.rotateSpeed * this.rotateJoystickSens),
                    move: this._scaleMove(tmpV1.set(leftStick[0], 0, -leftStick[1]))
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

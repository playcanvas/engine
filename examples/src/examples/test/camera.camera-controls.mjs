import {
    math,
    GamepadInput,
    JoystickDoubleInput,
    JoystickTouchInput,
    KeyboardMouseInput,
    MultiTouchInput,
    FlyController,
    OrbitController,
    Script,
    Mat4,
    Vec2,
    Vec3
} from 'playcanvas';

/** @import { CameraComponent, EventHandler } from 'playcanvas' */

/**
 * @typedef {object} CameraControlsFrame
 * @property {Vec3} move - The move delta.
 * @property {Vec2} rotate - The rotate delta.
 * @property {Vec2} drag - The drag delta.
 * @property {number} zoom - The zoom delta.
 * @property {boolean} pan - The pan flag.
 */

/**
 * @typedef {object} CameraControlsState
 * @property {Vec3} axis - The axis.
 * @property {number} shift - The shift.
 * @property {number} ctrl - The ctrl.
 * @property {number[]} mouse - The mouse.
 * @property {number} touches - The touches.
 */

const tmpM1 = new Mat4();
const tmpVa = new Vec2();
const tmpV1 = new Vec3();

const ZOOM_SCALE_MULT = 10;

/**
 * @param {EventHandler} joystick - The joystick.
 * @param {number} baseSize - The base size.
 * @param {number} stickSize - The stick size.
 * @private
 */
const createJoystickUI = (joystick, baseSize = 100, stickSize = 60) => {
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
};

class CameraControls extends Script {
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
     * @type {CameraComponent}
     * @private
     */
    _camera;

    /**
     * @type {number}
     * @private
     */
    _startZoomDist = 0;

    /**
     * @type {boolean}
     * @private
     */
    _useVirtualGamepad = false;

    /**
     * @type {KeyboardMouseInput}
     * @private
     */
    _desktopInput = new KeyboardMouseInput();

    /**
     * @type {JoystickDoubleInput | JoystickTouchInput | MultiTouchInput}
     * @private
     */
    _mobileInput;

    /**
     * @type {MultiTouchInput}
     * @private
     */
    _orbitMobileInput = new MultiTouchInput();

    /**
     * @type {JoystickTouchInput}
     * @private
     */
    _flyMobileTouchInput = new JoystickTouchInput();

    /**
     * @type {JoystickDoubleInput}
     * @private
     */
    _flyMobileGamepadInput = new JoystickDoubleInput();

    /**
     * @type {GamepadInput}
     * @private
     */
    _gamepadInput = new GamepadInput();

    /**
     * @type {FlyController}
     * @private
     */
    _flyController = new FlyController();

    /**
     * @type {OrbitController}
     * @private
     */
    _orbitController = new OrbitController();

    /**
     * @type {FlyController|OrbitController}
     * @private
     */
    _controller;

    /**
     * @type {CameraControls.MODE_ORBIT|CameraControls.MODE_FLY}
     * @private
     */
    _mode;

    /**
     * @type {CameraControlsFrame}
     * @private
     */
    _frame = {
        move: new Vec3(),
        rotate: new Vec2(),
        drag: new Vec2(),
        zoom: 0,
        pan: false
    };

    /**
     * @type {CameraControlsState}
     * @private
     */
    _state = {
        axis: new Vec3(),
        shift: 0,
        ctrl: 0,
        mouse: [0, 0, 0],
        touches: 0
    };

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
    zoomScaleMin = 0.001;

    /**
     * @type {number}
     */
    gamepadDeadZoneLow = 0.3;

    /**
     * @type {number}
     */
    gamepadDeadZoneHigh = 0.6;

    initialize() {
        // mode
        this.mode = this._mode ?? CameraControls.MODE_ORBIT;

        // destroy
        this.on('destroy', this.destroy, this);
    }

    set mode(mode) {
        if (this._mode === mode) {
            return;
        }

        // check if initialized
        if (!this._mode) {
            this._init();
        }

        // set mode
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

        // mobile input reattach
        const mobileInput = this._mode === CameraControls.MODE_FLY ?
            this._useVirtualGamepad ?
                this._flyMobileGamepadInput :
                this._flyMobileTouchInput :
            this._orbitMobileInput;
        if (mobileInput !== this._mobileInput) {
            if (this._mobileInput) {
                this._mobileInput.detach();
            }
            this._mobileInput = mobileInput;
            this._mobileInput.attach(this.app.graphicsDevice.canvas);

            // reset state
            this._resetState();
        }

        // controller reattach
        const controller = this._mode === CameraControls.MODE_FLY ? this._flyController : this._orbitController;
        const currZoomDist = this._orbitController.zoom;
        if (controller !== this._controller) {
            if (this._controller) {
                this._controller.detach();
            }
            this._controller = controller;
            this._controller.attach(this._camera.entity.getWorldTransform());
        }

        // refocus if orbit mode
        if (this._controller instanceof OrbitController) {
            const start = this._camera.entity.getPosition();
            const point = tmpV1.copy(this._camera.entity.forward).mulScalar(currZoomDist).add(start);
            this._controller.focus(point, start, false);
        }
    }

    get mode() {
        return this._mode;
    }

    set focusPoint(point) {
        this.mode = CameraControls.MODE_ORBIT;

        if (this._controller instanceof OrbitController) {
            const start = this._camera.entity.getPosition();
            this._startZoomDist = start.distance(point);
            this._controller.focus(point, start, false);
            this.update(0);
        }
    }

    get focusPoint() {
        this.mode = CameraControls.MODE_ORBIT;

        if (this._controller instanceof OrbitController) {
            return this._controller.point;
        }
        return this._camera.entity.getPosition();
    }

    set rotateDamping(damping) {
        this.mode = this._mode;

        this._flyController.rotateDamping = damping;
        this._orbitController.rotateDamping = damping;
    }

    get rotateDamping() {
        this.mode = this._mode;

        return this._controller.rotateDamping;
    }

    set moveDamping(damping) {
        this.mode = this._mode;

        this._flyController.moveDamping = damping;
    }

    get moveDamping() {
        this.mode = this._mode;

        return this._flyController.moveDamping;
    }

    set zoomDamping(damping) {
        this.mode = this._mode;

        this._orbitController.zoomDamping = damping;
    }

    get zoomDamping() {
        this.mode = this._mode;

        return this._orbitController.zoomDamping;
    }

    set pitchRange(range) {
        this.mode = this._mode;

        this._flyController.pitchRange = range;
        this._orbitController.pitchRange = range;
    }

    get pitchRange() {
        this.mode = this._mode;

        return this._controller.pitchRange;
    }

    set yawRange(range) {
        this.mode = this._mode;

        this._flyController.yawRange = range;
        this._orbitController.yawRange = range;
    }

    get yawRange() {
        this.mode = this._mode;

        return this._controller.yawRange;
    }

    set zoomRange(range) {
        this.mode = this._mode;

        this._orbitController.zoomRange = range;
    }

    get zoomRange() {
        this.mode = this._mode;

        return this._orbitController.zoomRange;
    }

    set useVirtualGamepad(use) {
        this._useVirtualGamepad = use;
    }

    get useVirtualGamepad() {
        return this._useVirtualGamepad;
    }

    /**
     * @private
     */
    _init() {
        if (!this.entity.camera) {
            console.error('CameraControls: camera component not found');
            return;
        }
        this._camera = this.entity.camera;

        // attach input
        this._desktopInput.attach(this.app.graphicsDevice.canvas);
        this._gamepadInput.attach(this.app.graphicsDevice.canvas);

        // create ui
        createJoystickUI(this._flyMobileGamepadInput.leftJoystick);
        createJoystickUI(this._flyMobileGamepadInput.rightJoystick);
        createJoystickUI(this._flyMobileTouchInput.joystick);
    }

    /**
     * @private
     */
    _resetFrame() {
        this._frame.move.set(0, 0, 0);
        this._frame.rotate.set(0, 0);
        this._frame.drag.set(0, 0);
        this._frame.zoom = 0;
        this._frame.pan = false;
    }

    /**
     * @private
     */
    _resetState() {
        this._state.axis.set(0, 0, 0);
        this._state.shift = 0;
        this._state.ctrl = 0;
        this._state.mouse.fill(0);
        this._state.touches = 0;
    }

    /**
     * @param {Vec2} stick - The stick
     * @returns {Vec2} The remapped stick.
     * @private
     */
    _applyDeadZone(stick) {
        const mag = stick.length();
        if (mag < this.gamepadDeadZoneLow) {
            return stick.set(0, 0);
        }
        const scale = (mag - this.gamepadDeadZoneLow) / (this.gamepadDeadZoneHigh - this.gamepadDeadZoneLow);
        return stick.normalize().mulScalar(scale);
    }

    /**
     * @param {Vec3} move - The move delta.
     * @returns {Vec3} The scaled delta.
     * @private
     */
    _scaleMove(move) {
        const speed = this._state.shift ?
            this.moveFastSpeed : this._state.ctrl ?
                this.moveSlowSpeed : this.moveSpeed;
        return move.mulScalar(speed * this.sceneSize);
    }

    /**
     * @param {number} zoom - The delta.
     * @returns {number} The scaled delta.
     * @private
     */
    _scaleZoom(zoom) {
        const scale = math.clamp(this._orbitController.zoom / (ZOOM_SCALE_MULT * this.sceneSize), this.zoomScaleMin, 1);
        return zoom * scale * this.zoomSpeed * this.sceneSize;
    }

    /**
     * @private
     */
    _addDesktopInputs() {
        const { key, button, mouse, wheel } = this._desktopInput.frame();
        const [forward, back, left, right, up, down, shift, ctrl] = key;

        // left mouse button, middle mouse button, mouse wheel
        const switchToOrbit = button[0] === 1 || button[1] === 1 || wheel[0] !== 0;

        // right mouse button or any key
        const switchToFly = button[2] === 1 ||
            forward === 1 || back === 1 || left === 1 || right === 1 || up === 1 || down === 1;

        if (switchToOrbit) {
            this.mode = CameraControls.MODE_ORBIT;
        } else if (switchToFly) {
            this.mode = CameraControls.MODE_FLY;
        }

        // update state
        this._state.axis.add(tmpV1.set(right - left, up - down, forward - back));
        this._state.shift += shift;
        this._state.ctrl += ctrl;
        for (let i = 0; i < this._state.mouse.length; i++) {
            this._state.mouse[i] += button[i];
        }

        this._frame.move.add(this._scaleMove(tmpV1.copy(this._state.axis).normalize()));
        this._frame.rotate.add(tmpVa.fromArray(mouse).mulScalar(this.rotateSpeed));

        const _pan = (!!this._state.shift || !!this._state.mouse[1]) && this.enablePanning;
        this._frame.drag.add(tmpVa.fromArray(mouse).mulScalar(_pan ? 1 : this.rotateSpeed));
        this._frame.zoom += this._scaleZoom(wheel[0]);
        this._frame.pan ||= _pan;
    }

    /**
     * @private
     */
    _addMobileInputs() {
        if (this._mobileInput instanceof MultiTouchInput) {
            const { touch, pinch, count } = this._mobileInput.frame();
            this._state.touches += count[0];

            const _pan = this._state.touches > 1 && this.enablePanning;
            this._frame.drag.add(tmpVa.fromArray(touch).mulScalar(_pan ? 1 : this.rotateSpeed));
            this._frame.zoom += this._scaleZoom(pinch[0]) * this.zoomPinchSens;
            this._frame.pan ||= _pan;
        }

        if (this._mobileInput instanceof JoystickTouchInput) {
            const { stick, touch } = this._mobileInput.frame();

            this._frame.rotate.add(tmpVa.fromArray(touch).mulScalar(this.rotateSpeed));
            this._frame.move.add(this._scaleMove(tmpV1.set(stick[0], 0, -stick[1])));
        }

        if (this._mobileInput instanceof JoystickDoubleInput) {
            const { leftStick, rightStick } = this._mobileInput.frame();

            this._frame.rotate.add(tmpVa.fromArray(rightStick).mulScalar(this.rotateSpeed * this.rotateJoystickSens));
            this._frame.move.add(this._scaleMove(tmpV1.set(leftStick[0], 0, -leftStick[1])));
        }
    }

    /**
     * @private
     */
    _addGamepadInputs() {
        const { leftStick, rightStick } = this._gamepadInput.frame();

        const right = this._applyDeadZone(tmpVa.set(rightStick[0], -rightStick[1]));
        this._frame.rotate.add(right.mulScalar(this.rotateSpeed * this.rotateJoystickSens));

        const left = this._applyDeadZone(tmpVa.fromArray(leftStick));
        this._frame.move.add(this._scaleMove(tmpV1.set(left.x, 0, left.y)));
    }

    /**
     * @param {number} dt - The time delta.
     */
    _updateController(dt) {
        if (this._controller instanceof OrbitController) {
            tmpM1.copy(this._controller.update(this._frame, this._camera, dt));
            this._camera.entity.setPosition(tmpM1.getTranslation());
            this._camera.entity.setEulerAngles(tmpM1.getEulerAngles());
        }

        if (this._controller instanceof FlyController) {
            tmpM1.copy(this._controller.update(this._frame, dt));
            this._camera.entity.setPosition(tmpM1.getTranslation());
            this._camera.entity.setEulerAngles(tmpM1.getEulerAngles());
        }
    }

    /**
     * @param {Vec3} point - The focus point.
     * @param {boolean} [resetZoom] - Whether to reset the zoom.
     */
    focus(point, resetZoom = false) {
        this.mode = CameraControls.MODE_ORBIT;

        if (this._controller instanceof OrbitController) {
            if (resetZoom) {
                const start = tmpV1.copy(this._camera.entity.forward)
                .mulScalar(-this._startZoomDist)
                .add(point);
                this._controller.focus(point, start);
            } else {
                this._controller.focus(point);
            }
        }
    }

    /**
     * @param {Vec3} point - The focus point.
     * @param {boolean} [resetZoom] - Whether to reset the zoom.
     */
    look(point, resetZoom = false) {
        this.mode = CameraControls.MODE_ORBIT;

        if (this._controller instanceof OrbitController) {
            if (resetZoom) {
                const start = tmpV1.copy(this._camera.entity.getPosition())
                .sub(point)
                .normalize()
                .mulScalar(this._startZoomDist)
                .add(point);
                this._controller.focus(point, start);
            } else {
                this._controller.focus(point, this._camera.entity.getPosition());
            }
        }
    }

    /**
     * @param {Vec3} point - The focus point.
     * @param {Vec3} start - The start point.
     */
    reset(point, start) {
        this.mode = CameraControls.MODE_ORBIT;

        if (this._controller instanceof OrbitController) {
            this._controller.focus(point, start);
        }
    }

    /**
     * @param {number} dt - The time delta.
     */
    update(dt) {
        if (this.app.xr?.active) {
            return;
        }

        this._resetFrame();

        // accumulate inputs
        this._addDesktopInputs();
        this._addMobileInputs();
        this._addGamepadInputs();

        // update controller
        this._updateController(dt);
    }

    destroy() {
        this._desktopInput.destroy();
        this._orbitMobileInput.destroy();
        this._flyMobileTouchInput.destroy();
        this._flyMobileGamepadInput.destroy();
        this._gamepadInput.destroy();

        this._flyController.destroy();
        this._orbitController.destroy();
    }
}

export { CameraControls };

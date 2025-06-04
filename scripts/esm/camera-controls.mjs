import {
    math,
    DualGestureSource,
    FlyController,
    GamepadSource,
    KeyboardMouseSource,
    MultiTouchSource,
    OrbitController,
    Pose,
    Script,
    Vec2,
    Vec3,
    InputDelta
} from 'playcanvas';

/** @import { CameraComponent, EventHandler, InputController } from 'playcanvas' */

/**
 * @typedef {object} CameraControlsState
 * @property {Vec3} axis - The axis.
 * @property {number} shift - The shift.
 * @property {number} ctrl - The ctrl.
 * @property {number[]} mouse - The mouse.
 * @property {number} touches - The touches.
 */

const tmpV1 = new Vec3();
const tmpO1 = new Pose();

const ZOOM_SCALE_MULT = 10;

/**
 * @param {number[]} stick - The stick
 * @param {number} low - The low dead zone
 * @param {number} high - The high dead zone
 */
const applyDeadZone = (stick, low, high) => {
    const mag = Math.sqrt(stick[0] * stick[0] + stick[1] * stick[1]);
    if (mag < low) {
        stick.fill(0);
        return;
    }
    const scale = (mag - low) / (high - low);
    stick[0] *= scale / mag;
    stick[1] *= scale / mag;
};

class CameraControls extends Script {
    static scriptName = 'cameraControls';

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
    // @ts-ignore
    _camera;

    /**
     * @type {boolean}
     * @private
     */
    _enableOrbit = true;

    /**
     * @type {boolean}
     * @private
     */
    _enableFly = true;

    /**
     * @type {number}
     * @private
     */
    _startZoomDist = 0;

    /**
     * @type {Vec2}
     * @private
     */
    _pitchRange = new Vec2(-360, 360);

    /**
     * @type {Vec2}
     * @private
     */
    _yawRange = new Vec2(-360, 360);

    /**
     * @type {Vec2}
     * @private
     */
    _zoomRange = new Vec2();

    /**
     * @type {KeyboardMouseSource}
     * @private
     */
    _desktopInput = new KeyboardMouseSource();

    /**
     * @type {MultiTouchSource}
     * @private
     */
    _orbitMobileInput = new MultiTouchSource();

    /**
     * @type {DualGestureSource}
     * @private
     */
    _flyMobileInput = new DualGestureSource();

    /**
     * @type {GamepadSource}
     * @private
     */
    _gamepadInput = new GamepadSource();

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
     * @type {InputController}
     * @private
     */
    // @ts-ignore
    _controller;

    /**
     * @type {CameraControls.MODE_ORBIT|CameraControls.MODE_FLY}
     * @private
     */
    // @ts-ignore
    _mode;

    /**
     * @type {{ move: InputDelta, rotate: InputDelta, pan: InputDelta }}
     * @private
     */
    _frame = {
        move: new InputDelta(3),
        rotate: new InputDelta(3),
        pan: new InputDelta(1)
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
     * Whether to skip the update.
     *
     * @attribute
     * @title Skip Update
     * @type {boolean}
     */
    skipUpdate = false;

    /**
     * Enable panning.
     *
     * @attribute
     * @title Enable Panning
     * @type {boolean}
     */
    enablePan = true;

    /**
     * The scene size. The zoom, pan and fly speeds are relative to this size.
     *
     * @attribute
     * @title Scene Size
     * @type {number}
     */
    sceneSize = 100;

    /**
     * The rotation speed.
     *
     * @attribute
     * @title Rotate Speed
     * @type {number}
     */
    rotateSpeed = 0.2;

    /**
     * The rotation joystick sensitivity.
     *
     * @attribute
     * @title Rotate Joystick Sensitivity
     * @type {number}
     */
    rotateJoystickSens = 2;

    /**
     * The fly move speed relative to the scene size.
     *
     * @attribute
     * @title Move Speed
     * @type {number}
     */
    moveSpeed = 2;

    /**
     * The fast fly move speed relative to the scene size.
     *
     * @attribute
     * @title Move Fast Speed
     * @type {number}
     */
    moveFastSpeed = 4;

    /**
     * The slow fly move speed relative to the scene size.
     *
     * @attribute
     * @title Move Slow Speed
     * @type {number}
     */
    moveSlowSpeed = 1;

    /**
     * The zoom speed relative to the scene size.
     *
     * @attribute
     * @title Zoom Speed
     * @type {number}
     */
    zoomSpeed = 0.005;

    /**
     * The touch zoom pinch sensitivity.
     *
     * @attribute
     * @title Zoom
     * @type {number}
     */
    zoomPinchSens = 5;

    /**
     * The minimum scale the camera can zoom (absolute value).
     *
     * @attribute
     * @title Zoom Scale Min
     * @type {number}
     */
    zoomScaleMin = 0.001;

    /**
     * The gamepad dead zone.
     *
     * @attribute
     * @title Gamepad Dead Zone
     * @type {Vec2}
     */
    gamepadDeadZone = new Vec2(0.3, 0.6);

    /**
     * The joystick event name for the base position.
     * The event name is appended with the side: 'left' or 'right'.
     *
     * @attribute
     * @title Joystick Base Event Name
     * @type {string}
     */
    joystickBaseEventName = 'joystick:base';

    /**
     * The joystick event name for the stick position.
     * The event name is appended with the side: 'left' or 'right'.
     *
     * @attribute
     * @title Joystick Stick Event Name
     * @type {string}
     */
    joystickStickEventName = 'joystick:stick';

    /**
     * The joystick event name for the reset event.
     * The event name is appended with the side: 'left' or 'right'.
     *
     * @attribute
     * @title Joystick Reset Event Name
     * @type {string}
     */
    joystickResetEventName = 'joystick:reset';

    /**
     * @type {number}
     * @private
     */
    get _moveMult() {
        const speed = this._state.shift ?
            this.moveFastSpeed : this._state.ctrl ? this.moveSlowSpeed : this.moveSpeed;
        return speed * this.sceneSize;
    }

    /**
     * @type {number}
     * @private
     */
    get _zoomMult() {
        const zoom = this._orbitController.zoom / (ZOOM_SCALE_MULT * this.sceneSize);
        const scale = math.clamp(zoom, this.zoomScaleMin, 1);
        return scale * this.zoomSpeed * this.sceneSize;
    }

    initialize() {
        if (!this.entity.camera) {
            console.error('CameraControls: camera component not found');
            return;
        }
        this._camera = this.entity.camera;

        // set orbit controller camera
        this._orbitController.camera = this._camera;

        // attach input
        this._desktopInput.attach(this.app.graphicsDevice.canvas);
        this._orbitMobileInput.attach(this.app.graphicsDevice.canvas);
        this._flyMobileInput.attach(this.app.graphicsDevice.canvas);
        this._gamepadInput.attach(this.app.graphicsDevice.canvas);

        // expose ui events
        this._exposeJoystickEvents(this._flyMobileInput.leftJoystick, 'left');
        this._exposeJoystickEvents(this._flyMobileInput.rightJoystick, 'right');

        // mode
        this._setMode(this._mode ?? CameraControls.MODE_ORBIT);

        // destroy
        this.on('destroy', this._destroy, this);

        console.log('CameraControls: initialized');
    }

    /**
     * Enable orbit camera controls.
     *
     * @attribute
     * @title Enable Orbit
     * @type {boolean}
     */
    set enableOrbit(enable) {
        this._enableOrbit = enable;

        if (!this._enableOrbit && this._mode === CameraControls.MODE_ORBIT) {
            this._setMode(CameraControls.MODE_FLY);
        }
    }

    get enableOrbit() {
        return this._enableOrbit;
    }

    /**
     * Enable fly camera controls.
     *
     * @attribute
     * @title Enable Fly
     * @type {boolean}
     */
    set enableFly(enable) {
        this._enableFly = enable;

        if (!this._enableFly && this._mode === CameraControls.MODE_FLY) {
            this._setMode(CameraControls.MODE_ORBIT);
        }
    }

    get enableFly() {
        return this._enableFly;
    }

    /**
     * The focus point.
     *
     * @attribute
     * @title Focus Point
     * @type {Vec3}
     */
    set focusPoint(point) {
        this._setMode(CameraControls.MODE_ORBIT);

        if (this._controller instanceof OrbitController) {
            const start = this._camera.entity.getPosition();
            this._startZoomDist = start.distance(point);
            this._controller.reset(point, start, false);
            this.update(0);
        }
    }

    get focusPoint() {
        this._setMode(CameraControls.MODE_ORBIT);

        if (this._controller instanceof OrbitController) {
            return this._controller.focus;
        }
        return this._camera.entity.getPosition();
    }

    /**
     * The focus damping. A higher value means more damping. A value of 0 means no damping.
     * The damping is applied to the orbit mode.
     *
     * @attribute
     * @title Rotate Damping
     * @type {number}
     */
    set focusDamping(damping) {
        this._orbitController.focusDamping = damping;
    }

    get focusDamping() {
        return this._orbitController.focusDamping;
    }

    /**
     * The rotate damping. In the range 0 to 1, where a value of 0 means no damping and 1 means full
     * damping. The damping is applied to both the fly and orbit modes.
     *
     * @attribute
     * @title Rotate Damping
     * @type {number}
     */
    set rotateDamping(damping) {
        this._flyController.rotateDamping = damping;
        this._orbitController.rotateDamping = damping;
    }

    get rotateDamping() {
        return this._orbitController.rotateDamping;
    }

    /**
     * The move damping. In the range 0 to 1, where a value of 0 means no damping and 1 means full
     * damping. The damping is applied to the fly mode and the orbit mode when panning.
     *
     * @attribute
     * @title Move Damping
     * @type {number}
     */
    set moveDamping(damping) {
        this._flyController.moveDamping = damping;
    }

    get moveDamping() {
        return this._flyController.moveDamping;
    }

    /**
     * The zoom damping. In the range 0 to 1, where a value of 0 means no damping and 1 means full
     * damping. The damping is applied to the orbit mode.
     *
     * @attribute
     * @title Zoom Damping
     * @type {number}
     */
    set zoomDamping(damping) {
        this._orbitController.zoomDamping = damping;
    }

    get zoomDamping() {
        return this._orbitController.zoomDamping;
    }

    /**
     * The pitch range. In the range -360 to 360 degrees. The pitch range is applied to the fly mode
     * and the orbit mode.
     *
     * @attribute
     * @title Pitch Range
     * @type {Vec2}
     */
    set pitchRange(range) {
        this._pitchRange.x = math.clamp(range.x, -360, 360);
        this._pitchRange.y = math.clamp(range.y, -360, 360);
        this._flyController.pitchRange = this._pitchRange;
        this._orbitController.pitchRange = this._pitchRange;
    }

    get pitchRange() {
        return this._pitchRange;
    }

    /**
     * The yaw range. In the range -360 to 360 degrees. The pitch range is applied to the fly mode
     * and the orbit mode.
     *
     * @attribute
     * @title Yaw Range
     * @type {Vec2}
     */
    set yawRange(range) {
        this._yawRange.x = math.clamp(range.x, -360, 360);
        this._yawRange.y = math.clamp(range.y, -360, 360);
        this._flyController.yawRange = this._yawRange;
        this._orbitController.yawRange = this._yawRange;
    }

    get yawRange() {
        return this._yawRange;
    }

    /**
     * The zoom range.
     *
     * @attribute
     * @title Zoom Range
     * @type {Vec2}
     */
    set zoomRange(range) {
        this._zoomRange.x = range.x;
        this._zoomRange.y = range.y <= range.x ? Infinity : range.y;
        this._orbitController.zoomRange = this._zoomRange;
    }

    get zoomRange() {
        return this._zoomRange;
    }

    /**
     * The layout of the mobile input. The layout can be one of the following:
     *
     * - `joystick-joystick`: Two virtual joysticks.
     * - `joystick-touch`: One virtual joystick and one touch.
     * - `touch-joystick`: One touch and one virtual joystick.
     * - `touch-touch`: Two touches.
     *
     * Default is `joystick-touch`.
     *
     * @attribute
     * @title Use Virtual Gamepad
     * @type {string}
     */
    set mobileInputLayout(layout) {
        if (!/(?:joystick|touch)-(?:joystick|touch)/.test(layout)) {
            console.warn(`CameraControls: invalid mobile input layout: ${layout}`);
            return;
        }
        if (this._flyMobileInput.layout !== layout) {
            // update layout
            this._flyMobileInput.layout = layout;

            // reattach input (clears pointer events)
            this._flyMobileInput.detach();
            this._flyMobileInput.attach(this.app.graphicsDevice.canvas);

            // reset state
            this._resetState();
        }
    }

    get mobileInputLayout() {
        return this._flyMobileInput.layout;
    }

    /**
     * @private
     */
    _destroy() {
        this._desktopInput.destroy();
        this._orbitMobileInput.destroy();
        this._flyMobileInput.destroy();
        this._gamepadInput.destroy();

        this._flyController.destroy();
        this._orbitController.destroy();
    }

    /**
     * @param {EventHandler} joystick - The joystick.
     * @param {string} side - The chirality.
     * @private
     */
    _exposeJoystickEvents(joystick, side) {
        joystick.on('position:base', (x, y) => {
            if (this._mode !== CameraControls.MODE_FLY) {
                return;
            }
            this.app.fire(`${this.joystickBaseEventName}:${side}`, x, y);
        });
        joystick.on('position:stick', (x, y) => {
            if (this._mode !== CameraControls.MODE_FLY) {
                return;
            }
            this.app.fire(`${this.joystickStickEventName}:${side}`, x, y);
        });
        joystick.on('reset', () => {
            if (this._mode !== CameraControls.MODE_FLY) {
                return;
            }
            this.app.fire(`${this.joystickResetEventName}:${side}`);
        });
    }

    /**
     * @param {CameraControls.MODE_ORBIT|CameraControls.MODE_FLY} mode - The mode.
     * @private
     */
    _setMode(mode) {
        // override mode depending on enabled features
        switch (true) {
            case this.enableFly && !this.enableOrbit: {
                mode = CameraControls.MODE_FLY;
                break;
            }
            case !this.enableFly && this.enableOrbit: {
                mode = CameraControls.MODE_ORBIT;
                break;
            }
            case !this.enableFly && !this.enableOrbit: {
                console.warn('CameraControls: both fly and orbit modes are disabled');
                return;
            }
        }

        // check if mode is the same
        if (this._mode === mode) {
            return;
        }
        this._mode = mode;

        // detach old controller
        if (this._controller) {
            this._controller.detach();
        }

        // calculate new pose and focus
        const position = this._camera.entity.getPosition();
        const rotation = this._camera.entity.getRotation();
        const focus = rotation.transformVector(Vec3.FORWARD, tmpV1).mulScalar(this._orbitController.zoom).add(position);
        const pose = tmpO1.set(position, rotation.getEulerAngles());

        // attach new controller
        this._controller = this._mode === CameraControls.MODE_ORBIT ? this._orbitController : this._flyController;
        this._controller.attach(pose, focus);
    }

    /**
     * @private
     */
    _resetFrame() {
        this._frame.move.flush();
        this._frame.rotate.flush();
        this._frame.pan.flush();
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
     * @private
     */
    _accumulateInputs() {
        const { key, button, mouse, wheel } = this._desktopInput.frame();
        const { touch, pinch, count } = this._orbitMobileInput.frame();
        const { leftInput, rightInput } = this._flyMobileInput.frame();
        const { leftStick, rightStick } = this._gamepadInput.frame();

        // destructure keys
        const [forward, back, left, right, down, up, /** space */, shift, ctrl] = key;

        // apply dead zone to gamepad sticks
        applyDeadZone(leftStick, this.gamepadDeadZone.x, this.gamepadDeadZone.y);
        applyDeadZone(rightStick, this.gamepadDeadZone.x, this.gamepadDeadZone.y);

        // left mouse button, middle mouse button, mouse wheel
        const switchToOrbit = button[0] === 1 || button[1] === 1 || wheel[0] !== 0;

        // right mouse button or any key
        const switchToFly = button[2] === 1 ||
            forward === 1 || back === 1 || left === 1 || right === 1 || up === 1 || down === 1;

        if (switchToOrbit) {
            this._setMode(CameraControls.MODE_ORBIT);
        } else if (switchToFly) {
            this._setMode(CameraControls.MODE_FLY);
        }

        // update state
        this._state.axis.add(tmpV1.set(right - left, up - down, forward - back));
        this._state.shift += shift;
        this._state.ctrl += ctrl;
        for (let i = 0; i < this._state.mouse.length; i++) {
            this._state.mouse[i] += button[i];
        }
        this._state.touches += count[0];

        const orbit = +(this._mode === CameraControls.MODE_ORBIT);
        const axis = tmpV1.copy(this._state.axis).normalize();
        const pan = +(orbit && this.enablePan && (this._state.shift || this._state.mouse[1] || this._state.touches > 1));
        const lookJoystick = +(this._flyMobileInput.layout.endsWith('joystick'));

        // update desktop
        this._frame.move.add([
            axis.x * this._moveMult,
            axis.y * this._moveMult,
            axis.z * this._moveMult + wheel[0] * this._zoomMult
        ]);
        this._frame.rotate.add([
            mouse[0] * (pan ? 1 : this.rotateSpeed),
            mouse[1] * (pan ? 1 : this.rotateSpeed),
            0
        ]);
        this._frame.pan.add([
            pan
        ]);

        // update mobile
        this._frame.move.add([
            orbit ? 0 : (leftInput[0] * this._moveMult),
            0,
            orbit ? (pinch[0] * this._zoomMult * this.zoomPinchSens) : (-leftInput[1] * this._moveMult)
        ]);
        this._frame.rotate.add([
            orbit ? (touch[0] * (pan ? 1 : this.rotateSpeed)) : (rightInput[0] * (this.rotateSpeed + lookJoystick * this.rotateJoystickSens)),
            orbit ? (touch[1] * (pan ? 1 : this.rotateSpeed)) : (rightInput[1] * (this.rotateSpeed + lookJoystick * this.rotateJoystickSens)),
            0
        ]);
        this._frame.pan.add([
            orbit * pan
        ]);

        // update gamepad
        this._frame.move.add([
            leftStick[0] * this._moveMult,
            0,
            -leftStick[1] * this._moveMult
        ]);
        this._frame.rotate.add([
            rightStick[0] * this.rotateSpeed * this.rotateJoystickSens,
            -rightStick[1] * this.rotateSpeed * this.rotateJoystickSens,
            0
        ]);
    }

    /**
     * @param {number} dt - The time delta.
     * @private
     */
    _updateController(dt) {
        const pose = this._controller.update(this._frame, dt);
        this._camera.entity.setPosition(pose.position);
        this._camera.entity.setEulerAngles(pose.angles);
    }

    /**
     * @param {Vec3} point - The focus point.
     * @param {boolean} [resetZoom] - Whether to reset the zoom.
     */
    focus(point, resetZoom = false) {
        this._setMode(CameraControls.MODE_ORBIT);

        if (this._controller instanceof OrbitController) {
            const zoomDist = resetZoom ?
                this._startZoomDist : this._camera.entity.getPosition().distance(point);
            const start = tmpV1.copy(this._camera.entity.forward)
            .mulScalar(-zoomDist)
            .add(point);
            this._controller.reset(point, start);
        }
    }

    /**
     * @param {Vec3} point - The focus point.
     * @param {boolean} [resetZoom] - Whether to reset the zoom.
     */
    look(point, resetZoom = false) {
        this._setMode(CameraControls.MODE_ORBIT);

        if (this._controller instanceof OrbitController) {
            const start = resetZoom ?
                tmpV1.copy(this._camera.entity.getPosition())
                .sub(point)
                .normalize()
                .mulScalar(this._startZoomDist)
                .add(point) : this._camera.entity.getPosition();
            this._controller.reset(point, start);
        }
    }

    /**
     * @param {Vec3} point - The focus point.
     * @param {Vec3} start - The start point.
     */
    reset(point, start) {
        this._setMode(CameraControls.MODE_ORBIT);

        if (this._controller instanceof OrbitController) {
            this._controller.reset(point, start);
        }
    }

    /**
     * @param {number} dt - The time delta.
     */
    update(dt) {
        this._resetFrame();

        // accumulate inputs
        this._accumulateInputs();

        if (this.skipUpdate) {
            return;
        }

        if (this.app.xr?.active) {
            return;
        }

        // update controller
        this._updateController(dt);
    }
}

export { CameraControls };

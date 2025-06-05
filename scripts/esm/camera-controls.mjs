import {
    math,
    DualGestureSource,
    FlyController,
    GamepadSource,
    KeyboardMouseSource,
    MultiTouchSource,
    OrbitController,
    Script,
    Vec2,
    Vec3,
    InputDelta,
    PROJECTION_PERSPECTIVE,
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
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();
const tmpVa = new Vec2();

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

        // set orbit controller defaults
        this._orbitController.camera = this._camera;
        this._orbitController.zoomRange = new Vec2(0, Infinity);

        // attach input
        this._desktopInput.attach(this.app.graphicsDevice.canvas);
        this._orbitMobileInput.attach(this.app.graphicsDevice.canvas);
        this._flyMobileInput.attach(this.app.graphicsDevice.canvas);
        this._gamepadInput.attach(this.app.graphicsDevice.canvas);

        // expose ui events
        this._exposeJoystickEvents(this._flyMobileInput.leftJoystick, 'left');
        this._exposeJoystickEvents(this._flyMobileInput.rightJoystick, 'right');

        // mode
        this._setMode(CameraControls.MODE_ORBIT);

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
            const position = this._camera.entity.getPosition();
            this._startZoomDist = position.distance(point);
            this._controller.reset(position, point, false);
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
        const focus = this._camera.entity.getRotation()
        .transformVector(Vec3.FORWARD, tmpV1)
        .mulScalar(this._orbitController.zoom)
        .add(position);

        // attach new controller
        this._controller = this._mode === CameraControls.MODE_ORBIT ? this._orbitController : this._flyController;
        this._controller.attach(position, focus);
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
     * @param {number} dx - The mouse delta x value.
     * @param {number} dy - The mouse delta y value.
     * @param {number} dz - The world space zoom delta value.
     * @param {Vec3} [out] - The output vector to store the pan result.
     * @returns {Vec3} - The pan vector in world space.
     * @private
     */
    _screenToWorld(dx, dy, dz, out = new Vec3()) {
        const { system, fov, aspectRatio, horizontalFov, projection, orthoHeight } = this._camera;
        const { width, height } = system.app.graphicsDevice;

        // normalize deltas to device coord space
        out.set(
            -(dx / width) * 2,
            (dy / height) * 2,
            0
        );

        // calculate size of the view frustum at the current distance
        const size = tmpV2.set(0, 0, 0);
        if (projection === PROJECTION_PERSPECTIVE) {
            const slice = dz * Math.tan(0.5 * fov * math.DEG_TO_RAD);
            if (horizontalFov) {
                size.set(
                    slice,
                    slice / aspectRatio,
                    0
                );
            } else {
                size.set(
                    slice * aspectRatio,
                    slice,
                    0
                );
            }
        } else {
            size.set(
                orthoHeight * aspectRatio,
                orthoHeight,
                0
            );
        }

        // convert half size to full size
        size.mulScalar(2);

        // scale by device coord space
        out.mul(size);

        return out;
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

        // right mouse button or any movement key
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

        // flags
        const orbit = +(this._mode === CameraControls.MODE_ORBIT);
        const fly = 1 - orbit;
        const pan = +(this.enablePan &&
            (this._state.shift || this._state.mouse[1] || this._state.touches > 1));

        // update desktop
        const desktopKeyMove = this._state.axis.clone().normalize().mulScalar(this._moveMult);
        const desktopPanMove = this._screenToWorld(mouse[0], mouse[1], this._orbitController.zoom);
        const desktopWheelMove = new Vec3(0, 0, wheel[0]).mulScalar(this._zoomMult);
        const desktopMouseRotate = new Vec3(mouse[0], mouse[1], 0).mulScalar(this.rotateSpeed);
        this._frame.move.add([
            fly * (1 - pan) * desktopKeyMove.x + orbit * pan * desktopPanMove.x,
            fly * (1 - pan) * desktopKeyMove.y + orbit * pan * desktopPanMove.y,
            fly * (1 - pan) * desktopKeyMove.z + orbit * desktopWheelMove.z
        ]);
        this._frame.rotate.add([
            (1 - pan) * desktopMouseRotate.x,
            (1 - pan) * desktopMouseRotate.y,
            (1 - pan) * desktopMouseRotate.z
        ]);

        // update mobile
        const mobileInputMove = new Vec3(leftInput[0], 0, -leftInput[1]).mulScalar(this._moveMult);
        const mobilePanMove = this._screenToWorld(touch[0], touch[1], this._orbitController.zoom);
        const mobilePinchMove = new Vec3(0, 0, pinch[0]).mulScalar(this._zoomMult *
            this.zoomPinchSens);
        const mobileTouchRotate = new Vec3(touch[0], touch[1], 0).mulScalar(this.rotateSpeed +
            +(this._flyMobileInput.layout.endsWith('joystick')) * this.rotateJoystickSens);
        const mobileInputRotate = new Vec3(rightInput[0], rightInput[1], 0).mulScalar(this.rotateSpeed +
            +(this._flyMobileInput.layout.endsWith('joystick')) * this.rotateJoystickSens);
        this._frame.move.add([
            fly * (1 - pan) * mobileInputMove.x + orbit * pan * mobilePanMove.x,
            fly * (1 - pan) * mobileInputMove.y + orbit * pan * mobilePanMove.y,
            fly * (1 - pan) * mobileInputMove.z + orbit * mobilePinchMove.z
        ]);
        this._frame.rotate.add([
            orbit * (1 - pan) * mobileTouchRotate.x + fly * (1 - pan) * mobileInputRotate.x,
            orbit * (1 - pan) * mobileTouchRotate.y + fly * (1 - pan) * mobileInputRotate.y,
            orbit * (1 - pan) * mobileTouchRotate.z + fly * (1 - pan) * mobileInputRotate.z
        ]);

        // update gamepad
        const gamepadStickMove = tmpV1.set(leftStick[0], 0, -leftStick[1]).mulScalar(this._moveMult);
        const gamepadStickRotate = new Vec3(rightStick[0], rightStick[1], 0).mulScalar(this.rotateSpeed *
            this.rotateJoystickSens);
        this._frame.move.add([
            fly * (1 - pan) * gamepadStickMove.x,
            fly * (1 - pan) * gamepadStickMove.y,
            fly * (1 - pan) * gamepadStickMove.z
        ]);
        this._frame.rotate.add([
            fly * (1 - pan) * gamepadStickRotate.x,
            fly * (1 - pan) * gamepadStickRotate.y,
            fly * (1 - pan) * gamepadStickRotate.z
        ]);
    }

    /**
     * @param {Vec3} focus - The focus point.
     * @param {boolean} [resetZoom] - Whether to reset the zoom.
     */
    focus(focus, resetZoom = false) {
        this._setMode(CameraControls.MODE_ORBIT);

        if (this._controller instanceof OrbitController) {
            const zoomDist = resetZoom ?
                this._startZoomDist : this._camera.entity.getPosition().distance(focus);
            const position = tmpV1.copy(this._camera.entity.forward)
            .mulScalar(-zoomDist)
            .add(focus);
            this._controller.reset(position, focus);
        }
    }

    /**
     * @param {Vec3} focus - The focus point.
     * @param {boolean} [resetZoom] - Whether to reset the zoom.
     */
    look(focus, resetZoom = false) {
        this._setMode(CameraControls.MODE_ORBIT);

        if (this._controller instanceof OrbitController) {
            const position = resetZoom ?
                tmpV1.copy(this._camera.entity.getPosition())
                .sub(focus)
                .normalize()
                .mulScalar(this._startZoomDist)
                .add(focus) : this._camera.entity.getPosition();
            this._controller.reset(position, focus);
        }
    }

    /**
     * @param {Vec3} focus - The focus point.
     * @param {Vec3} position - The start point.
     */
    reset(focus, position) {
        this._setMode(CameraControls.MODE_ORBIT);

        if (this._controller instanceof OrbitController) {
            this._controller.reset(position, focus);
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
        const pose = this._controller.update(this._frame, dt);
        this._camera.entity.setPosition(pose.position);
        this._camera.entity.setEulerAngles(pose.angles);
    }
}

export { CameraControls };

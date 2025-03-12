import {
    GamepadInput,
    JoystickDoubleInput,
    JoystickTouchInput,
    KeyboardMouseInput,
    FirstPersonController,
    Script,
    Mat4,
    Vec2,
    Vec3
} from 'playcanvas';

/** @import { CameraComponent, RigidBodyComponent, EventHandler } from 'playcanvas' */

/**
 * @typedef {object} CameraControlsFrame
 * @property {Vec3} move - The move delta.
 * @property {Vec2} rotate - The rotate delta.
 */

/**
 * @typedef {object} CameraControlsState
 * @property {Vec3} axis - The axis.
 * @property {number} space - The space.
 * @property {number} shift - The shift.
 * @property {number} ctrl - The ctrl.
 * @property {number[]} mouse - The mouse.
 * @property {number} touches - The touches.
 */

const tmpM1 = new Mat4();
const tmpVa = new Vec2();
const tmpV1 = new Vec3();

class FirstPersonControls extends Script {
    /**
     * @type {CameraComponent | null}
     * @private
     */
    _camera = null;

    /**
     * @type {RigidBodyComponent}
     * @private
     */
    _rigidbody;

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
     * @type {JoystickDoubleInput | JoystickTouchInput}
     * @private
     */
    _mobileInput;

    /**
     * @type {JoystickTouchInput}
     * @private
     */
    _mobileTouchInput = new JoystickTouchInput();

    /**
     * @type {JoystickDoubleInput}
     * @private
     */
    _mobileGamepadInput = new JoystickDoubleInput();

    /**
     * @type {GamepadInput}
     * @private
     */
    _gamepadInput = new GamepadInput();

    /**
     * @type {FirstPersonController}
     * @private
     */
    _controller = new FirstPersonController();

    /**
     * @type {CameraControlsFrame}
     * @private
     */
    _frame = {
        move: new Vec3(),
        rotate: new Vec2()
    };

    /**
     * @type {CameraControlsState}
     * @private
     */
    _state = {
        axis: new Vec3(),
        space: 0,
        shift: 0,
        ctrl: 0,
        mouse: [0, 0, 0],
        touches: 0
    };

    _position = new Vec3();

    _jumping = false;

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
     * The fly move speed.
     *
     * @attribute
     * @title Move Speed
     * @type {number}
     */
    moveSpeed = 5;

    /**
     * The fast fly move speed.
     *
     * @attribute
     * @title Move Fast Speed
     * @type {number}
     */
    moveFastSpeed = 10;

    /**
     * The slow fly move speed.
     *
     * @attribute
     * @title Move Slow Speed
     * @type {number}
     */
    moveSlowSpeed = 3;

    jumpForce = 850;

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

    initialize() {
        if (!this.entity.rigidbody) {
            console.error('FirstPersonControls: rigidbody component not found');
            return;
        }
        this._rigidbody = this.entity.rigidbody;

        // destroy
        this.on('destroy', this._destroy, this);
    }

    set camera(camera) {
        if (!camera) {
            console.error('FirstPersonControls: camera component not found');
            return;
        }
        this._camera = camera;

        // attach input
        this._desktopInput.attach(this.app.graphicsDevice.canvas);
        this._gamepadInput.attach(this.app.graphicsDevice.canvas);

        // expose ui events
        this._exposeJoystickEvents(this._mobileTouchInput.joystick, 'left');
        this._exposeJoystickEvents(this._mobileGamepadInput.leftJoystick, 'left');
        this._exposeJoystickEvents(this._mobileGamepadInput.rightJoystick, 'right');

        // input attach
        this._reattachMobileInput();

        // controller attach
        this._controller.attach(this._camera.entity.getWorldTransform());
    }

    get camera() {
        return this._camera;
    }

    /**
     * The rotate damping. A higher value means more damping. A value of 0 means no damping.
     * The damping is applied to both the fly and orbit modes.
     *
     * @attribute
     * @title Rotate Damping
     * @type {number}
     */
    set rotateDamping(damping) {
        this._controller.rotateDamping = damping;
    }

    get rotateDamping() {
        return this._controller.rotateDamping;
    }

    /**
     * The move damping. A higher value means more damping. A value of 0 means no damping.
     * The damping is applied to the fly mode and the orbit mode when panning.
     *
     * @attribute
     * @title Move Damping
     * @type {number}
     */
    set moveDamping(damping) {
        this._controller.moveDamping = damping;
    }

    get moveDamping() {
        return this._controller.moveDamping;
    }

    /**
     * Whether to use the virtual gamepad or touch joystick for mobile fly mode.
     *
     * @attribute
     * @title Use Virtual Gamepad
     * @type {boolean}
     */
    set useVirtualGamepad(use) {
        this._useVirtualGamepad = use;
        this._reattachMobileInput();
    }

    get useVirtualGamepad() {
        return this._useVirtualGamepad;
    }

    get grounded() {
        const start = this.entity.getPosition();
        const end = tmpV1.copy(start).add(Vec3.DOWN);
        end.y -= 0.1;
        const system = this.app.systems.rigidbody;
        if (!system) {
            return false;
        }
        return !!system.raycastFirst(start, end);
    }

    /**
     * @private
     */
    _destroy() {
        this._desktopInput.destroy();
        this._mobileTouchInput.destroy();
        this._mobileGamepadInput.destroy();
        this._gamepadInput.destroy();

        this._controller.destroy();
    }

    /**
     * @param {EventHandler} joystick - The joystick.
     * @param {string} side - The chirality.
     * @private
     */
    _exposeJoystickEvents(joystick, side) {
        joystick.on('position:base', (x, y) => {
            this.app.fire(`${this.joystickBaseEventName}:${side}`, x, y);
        });
        joystick.on('position:stick', (x, y) => {
            this.app.fire(`${this.joystickStickEventName}:${side}`, x, y);
        });
        joystick.on('reset', () => {
            this.app.fire(`${this.joystickResetEventName}:${side}`);
        });
    }

    /**
     * @private
     */
    _reattachMobileInput() {
        const mobileInput = this._useVirtualGamepad ? this._mobileGamepadInput : this._mobileTouchInput;
        if (mobileInput !== this._mobileInput) {
            if (this._mobileInput) {
                this._mobileInput.detach();
            }
            this._mobileInput = mobileInput;
            this._mobileInput.attach(this.app.graphicsDevice.canvas);

            // reset state
            this._resetState();
        }
    }

    /**
     * @private
     */
    _resetFrame() {
        this._frame.move.set(0, 0, 0);
        this._frame.rotate.set(0, 0);
    }

    /**
     * @private
     */
    _resetState() {
        this._state.axis.set(0, 0, 0);
        this._state.space = 0;
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
        if (mag < this.gamepadDeadZone.x) {
            return stick.set(0, 0);
        }
        const scale = (mag - this.gamepadDeadZone.x) / (this.gamepadDeadZone.y - this.gamepadDeadZone.x);
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
        return move.mulScalar(speed);
    }

    /**
     * @private
     */
    _addDesktopInputs() {
        const { key, button, mouse } = this._desktopInput.frame();
        const [forward, back, left, right, /** up */, /** down */, space, shift, ctrl] = key;

        // update state
        this._state.axis.add(tmpV1.set(right - left, 0, forward - back));
        this._state.space += space;
        this._state.shift += shift;
        this._state.ctrl += ctrl;
        for (let i = 0; i < this._state.mouse.length; i++) {
            this._state.mouse[i] += button[i];
        }

        this._frame.move.add(this._scaleMove(tmpV1.copy(this._state.axis).normalize()));
        this._frame.rotate.add(tmpVa.fromArray(mouse).mulScalar(this.rotateSpeed));
    }

    /**
     * @private
     */
    _addMobileInputs() {
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
     * @private
     */
    _jump() {
        if (this._rigidbody.linearVelocity.y < 0) {
            this._jumping = false;
        }
        if (this._state.space && !this._jumping && this.grounded) {
            this._jumping = true;
            this._rigidbody.applyImpulse(0, this.jumpForce, 0);
        }
    }

    /**
     * @param {number} dt - The time delta.
     * @private
     */
    _updateController(dt) {
        if (!this._camera) {
            return;
        }

        // camera update
        tmpM1.copy(this._controller.update(this._frame, dt));
        this._camera.entity.setEulerAngles(tmpM1.getEulerAngles());

        // rigidbody update
        this._jump();
        const position = tmpM1.getTranslation();
        const velocity = tmpV1.sub2(position, this._position).divScalar(dt);
        velocity.y = this._rigidbody.linearVelocity.y;
        this._rigidbody.linearVelocity = velocity;
        this._position.copy(position);
    }

    /**
     * @param {number} dt - The time delta.
     */
    update(dt) {
        if (this.app.xr?.active) {
            return;
        }

        if (!this._camera) {
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
}

export { FirstPersonControls };

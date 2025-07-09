import { math, Script, Vec2, Vec3, Mat4 } from 'playcanvas';

/** @import { AppBase, GraphicsDevice, Entity, RigidBodyComponent } from 'playcanvas' */

const LOOK_MAX_ANGLE = 90;

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpM1 = new Mat4();

/**
 * Utility function for both touch and gamepad handling of deadzones. Takes a 2-axis joystick
 * position in the range -1 to 1 and applies an upper and lower radial deadzone, remapping values in
 * the legal range from 0 to 1.
 *
 * @param {Vec2} pos - The joystick position.
 * @param {Vec2} remappedPos - The remapped joystick position.
 * @param {number} deadZoneLow - The lower dead zone.
 * @param {number} deadZoneHigh - The upper dead zone.
 */
const applyRadialDeadZone = (pos, remappedPos, deadZoneLow, deadZoneHigh) => {
    const magnitude = pos.length();

    if (magnitude > deadZoneLow) {
        const legalRange = 1 - deadZoneHigh - deadZoneLow;
        const normalizedMag = Math.min(1, (magnitude - deadZoneLow) / legalRange);
        remappedPos.copy(pos).mulScalar(normalizedMag / magnitude);
    } else {
        remappedPos.set(0, 0);
    }
};

class KeyboardMouseInput {
    /**
     * @private
     * @type {AppBase}
     */
    _app;

    /**
     * @type {HTMLCanvasElement}
     * @private
     */
    _canvas;

    /**
     * @type {boolean}
     * @private
     */
    _enabled = true;

    /**
     * @param {AppBase} app - The application.
     */
    constructor(app) {
        this._app = app;
        this._canvas = app.graphicsDevice.canvas;

        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);

        this._bind();
    }

    set enabled(value) {
        if (value === this._enabled) {
            return;
        }
        this._enabled = value ?? this._enabled;

        if (this._enabled) {
            this._bind();
        } else {
            this._unbind();
        }
    }

    get enabled() {
        return this._enabled;
    }

    /**
     * @private
     */
    _bind() {
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('mousedown', this._onMouseDown);
        window.addEventListener('mousemove', this._onMouseMove);
    }

    /**
     * @private
     */
    _unbind() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
        window.removeEventListener('mousedown', this._onMouseDown);
        window.removeEventListener('mousemove', this._onMouseMove);
    }

    /**
     * @param {string} key - The key pressed.
     * @param {number} val - The key value.
     * @private
     */
    _handleKey(key, val) {
        switch (key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                this._app.fire('cc:move:forward', val);
                break;
            case 's':
            case 'arrowdown':
                this._app.fire('cc:move:backward', val);
                break;
            case 'a':
            case 'arrowleft':
                this._app.fire('cc:move:left', val);
                break;
            case 'd':
            case 'arrowright':
                this._app.fire('cc:move:right', val);
                break;
            case ' ':
                this._app.fire('cc:jump', !!val);
                break;
            case 'shift':
                this._app.fire('cc:sprint', !!val);
                break;
        }
    }

    /**
     * @param {KeyboardEvent} e - The keyboard event.
     * @private
     */
    _onKeyDown(e) {
        if (document.pointerLockElement !== this._canvas) {
            return;
        }

        if (e.repeat) {
            return;
        }
        this._handleKey(e.key, 1);
    }

    /**
     * @param {KeyboardEvent} e - The keyboard event.
     * @private
     */
    _onKeyUp(e) {
        if (e.repeat) {
            return;
        }
        this._handleKey(e.key, 0);
    }

    /**
     * @param {MouseEvent} e - The mouse event.
     * @private
     */
    _onMouseDown(e) {
        if (e.target === this._canvas && document.pointerLockElement !== this._canvas) {
            this._canvas.requestPointerLock();
        }
    }

    /**
     * @param {MouseEvent} e - The mouse event.
     * @private
     */
    _onMouseMove(e) {
        if (document.pointerLockElement !== this._canvas) {
            return;
        }

        const movementX = e.movementX || 0;
        const movementY = e.movementY || 0;

        this._app.fire('cc:look', movementX, movementY);
    }

    destroy() {
        this._unbind();
    }
}

class MobileInput {
    /**
     * @type {AppBase}
     * @private
     */
    _app;

    /**
     * @type {GraphicsDevice}
     * @private
     */
    _device;

    /**
     * @type {HTMLCanvasElement}
     * @private
     */
    _canvas;

    /**
     * @type {number}
     * @private
     */
    _lastRightTap = 0;

    /**
     * @type {ReturnType<typeof setTimeout> | null}
     * @private
     */
    _jumpTimeout = null;

    /**
     * @type {number}
     * @private
     */
    _lastForward = 0;

    /**
     * @type {number}
     * @private
     */
    _lastStrafe = 0;

    /**
     * @type {Vec2}
     * @private
     */
    _remappedPos = new Vec2();

    /**
     * @type {{ identifier: number, center: Vec2; pos: Vec2 }}
     * @private
     */
    _leftStick = {
        identifier: -1,
        center: new Vec2(),
        pos: new Vec2()
    };

    /**
     * @type {{ identifier: number, center: Vec2; pos: Vec2 }}
     * @private
     */
    _rightStick = {
        identifier: -1,
        center: new Vec2(),
        pos: new Vec2()
    };

    /**
     * @type {boolean}
     * @private
     */
    _enabled = true;

    /**
     * @type {number}
     */
    deadZone = 0.3;

    /**
     * @type {number}
     */
    turnSpeed = 30;

    /**
     * @type {number}
     */
    radius = 50;

    /**
     * @type {number}
     */
    doubleTapInterval = 300;

    /**
     * @param {AppBase} app - The application.
     */
    constructor(app) {
        this._app = app;

        this._device = this._app.graphicsDevice;
        this._canvas = this._device.canvas;

        this._onTouchStart = this._onTouchStart.bind(this);
        this._onTouchMove = this._onTouchMove.bind(this);
        this._onTouchEnd = this._onTouchEnd.bind(this);

        this._bind();
    }

    set enabled(value) {
        if (value === this._enabled) {
            return;
        }
        this._enabled = value ?? this._enabled;

        if (this._enabled) {
            this._bind();
        } else {
            this._unbind();
        }
    }

    get enabled() {
        return this._enabled;
    }

    /**
     * @private
     */
    _bind() {
        this._canvas.addEventListener('touchstart', this._onTouchStart, false);
        this._canvas.addEventListener('touchmove', this._onTouchMove, false);
        this._canvas.addEventListener('touchend', this._onTouchEnd, false);
    }

    /**
     * @private
     */
    _unbind() {
        this._canvas.removeEventListener('touchstart', this._onTouchStart, false);
        this._canvas.removeEventListener('touchmove', this._onTouchMove, false);
        this._canvas.removeEventListener('touchend', this._onTouchEnd, false);
    }

    /**
     * @private
     * @param {TouchEvent} e - The touch event.
     */
    _onTouchStart(e) {
        e.preventDefault();

        const xFactor = this._device.width / this._canvas.clientWidth;
        const yFactor = this._device.height / this._canvas.clientHeight;

        const touches = e.changedTouches;
        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];

            if (touch.pageX <= this._canvas.clientWidth / 2 && this._leftStick.identifier === -1) {
                // If the user touches the left half of the screen, create a left virtual joystick...
                this._leftStick.identifier = touch.identifier;
                this._leftStick.center.set(touch.pageX, touch.pageY);
                this._leftStick.pos.set(0, 0);
                this._app.fire('leftjoystick:enable', touch.pageX * xFactor, touch.pageY * yFactor);
            } else if (touch.pageX > this._canvas.clientWidth / 2 && this._rightStick.identifier === -1) {
                // ...otherwise create a right virtual joystick
                this._rightStick.identifier = touch.identifier;
                this._rightStick.center.set(touch.pageX, touch.pageY);
                this._rightStick.pos.set(0, 0);
                this._app.fire('rightjoystick:enable', touch.pageX * xFactor, touch.pageY * yFactor);

                // See how long since the last tap of the right virtual joystick to detect a double tap (jump)
                const now = Date.now();
                if (now - this._lastRightTap < this.doubleTapInterval) {
                    if (this._jumpTimeout) {
                        clearTimeout(this._jumpTimeout);
                    }
                    this._app.fire('cc:jump', true);
                    this._jumpTimeout = setTimeout(() => this._app.fire('cc:jump', false), 50);
                }
                this._lastRightTap = now;
            }
        }
    }

    /**
     * @private
     * @param {TouchEvent} e - The touch event.
     */
    _onTouchMove(e) {
        e.preventDefault();

        const xFactor = this._device.width / this._canvas.clientWidth;
        const yFactor = this._device.height / this._canvas.clientHeight;

        const touches = e.changedTouches;
        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];

            // Update the current positions of the two virtual joysticks
            if (touch.identifier === this._leftStick.identifier) {
                this._leftStick.pos.set(touch.pageX, touch.pageY);
                this._leftStick.pos.sub(this._leftStick.center);
                this._leftStick.pos.mulScalar(1 / this.radius);
                this._app.fire('leftjoystick:move', touch.pageX * xFactor, touch.pageY * yFactor);
            } else if (touch.identifier === this._rightStick.identifier) {
                this._rightStick.pos.set(touch.pageX, touch.pageY);
                this._rightStick.pos.sub(this._rightStick.center);
                this._rightStick.pos.mulScalar(1 / this.radius);
                this._app.fire('rightjoystick:move', touch.pageX * xFactor, touch.pageY * yFactor);
            }
        }
    }

    /**
     * @private
     * @param {TouchEvent} e - The touch event.
     */
    _onTouchEnd(e) {
        e.preventDefault();

        const touches = e.changedTouches;
        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];

            // If this touch is one of the sticks, get rid of it...
            if (touch.identifier === this._leftStick.identifier) {
                this._leftStick.identifier = -1;
                this._app.fire('cc:move:forward', 0);
                this._app.fire('cc:move:backward', 0);
                this._app.fire('cc:move:left', 0);
                this._app.fire('cc:move:right', 0);
                this._app.fire('leftjoystick:disable');
            } else if (touch.identifier === this._rightStick.identifier) {
                this._rightStick.identifier = -1;
                this._app.fire('rightjoystick:disable');
            }
        }
    }

    update() {
        if (!this.enabled) {
            return;
        }

        // Moving
        if (this._leftStick.identifier !== -1) {
            // Apply a lower radial dead zone. We don't need an upper zone like with a real joypad
            applyRadialDeadZone(this._leftStick.pos, this._remappedPos, this.deadZone, 0);

            const forward = -this._remappedPos.y;
            if (this._lastForward !== forward) {
                if (forward > 0) {
                    this._app.fire('cc:move:forward', Math.abs(forward));
                    this._app.fire('cc:move:backward', 0);
                }
                if (forward < 0) {
                    this._app.fire('cc:move:forward', 0);
                    this._app.fire('cc:move:backward', Math.abs(forward));
                }
                if (forward === 0) {
                    this._app.fire('cc:move:forward', 0);
                    this._app.fire('cc:move:backward', 0);
                }
                this._lastForward = forward;
            }

            const strafe = this._remappedPos.x;
            if (this._lastStrafe !== strafe) {
                if (strafe > 0) {
                    this._app.fire('cc:move:left', 0);
                    this._app.fire('cc:move:right', Math.abs(strafe));
                }
                if (strafe < 0) {
                    this._app.fire('cc:move:left', Math.abs(strafe));
                    this._app.fire('cc:move:right', 0);
                }
                if (strafe === 0) {
                    this._app.fire('cc:move:left', 0);
                    this._app.fire('cc:move:right', 0);
                }
                this._lastStrafe = strafe;
            }
        }

        // Looking
        if (this._rightStick.identifier !== -1) {
            // Apply a lower radial dead zone. We don't need an upper zone like with a real joypad
            applyRadialDeadZone(this._rightStick.pos, this._remappedPos, this.deadZone, 0);

            const movX = this._remappedPos.x * this.turnSpeed;
            const movY = this._remappedPos.y * this.turnSpeed;
            this._app.fire('cc:look', movX, movY);
        }
    }

    destroy() {
        this._unbind();
    }
}

class GamePadInput {
    /**
     * @type {AppBase}
     * @private
     */
    _app;

    /**
     * @type {ReturnType<typeof setTimeout> | null}
     * @private
     */
    _jumpTimeout = null;

    /**
     * @type {number}
     * @private
     */
    _lastForward = 0;

    /**
     * @type {number}
     * @private
     */
    _lastStrafe = 0;

    /**
     * @type {boolean}
     * @private
     */
    _lastJump = false;

    /**
     * @type {Vec2}
     * @private
     */
    _remappedPos = new Vec2();

    /**
     * @type {{ center: Vec2; pos: Vec2 }}
     * @private
     */
    _leftStick = {
        center: new Vec2(),
        pos: new Vec2()
    };

    /**
     * @type {{ center: Vec2; pos: Vec2 }}
     * @private
     */
    _rightStick = {
        center: new Vec2(),
        pos: new Vec2()
    };

    /**
     * @type {boolean}
     * @private
     */
    _enabled = true;

    /**
     * @type {number}
     */
    deadZoneLow = 0.1;

    /**
     * @type {number}
     */
    deadZoneHigh = 0.1;

    /**
     * @type {number}
     */
    turnSpeed = 30;

    /**
     * @param {AppBase} app - The application.
     */
    constructor(app) {
        this._app = app;
    }

    set enabled(value) {
        if (value === this._enabled) {
            return;
        }
        this._enabled = value ?? this._enabled;
    }

    get enabled() {
        return this._enabled;
    }

    update() {
        if (!this.enabled) {
            return;
        }

        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];

        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];

            // Only proceed if we have at least 2 sticks
            if (gamepad && gamepad.mapping === 'standard' && gamepad.axes.length >= 4) {
                // Moving (left stick)
                this._leftStick.pos.set(gamepad.axes[0], gamepad.axes[1]);
                applyRadialDeadZone(this._leftStick.pos, this._remappedPos, this.deadZoneLow, this.deadZoneHigh);

                const forward = -this._remappedPos.y;
                if (this._lastForward !== forward) {
                    if (forward > 0) {
                        this._app.fire('cc:move:forward', Math.abs(forward));
                        this._app.fire('cc:move:backward', 0);
                    }
                    if (forward < 0) {
                        this._app.fire('cc:move:forward', 0);
                        this._app.fire('cc:move:backward', Math.abs(forward));
                    }
                    if (forward === 0) {
                        this._app.fire('cc:move:forward', 0);
                        this._app.fire('cc:move:backward', 0);
                    }
                    this._lastForward = forward;
                }

                const strafe = this._remappedPos.x;
                if (this._lastStrafe !== strafe) {
                    if (strafe > 0) {
                        this._app.fire('cc:move:left', 0);
                        this._app.fire('cc:move:right', Math.abs(strafe));
                    }
                    if (strafe < 0) {
                        this._app.fire('cc:move:left', Math.abs(strafe));
                        this._app.fire('cc:move:right', 0);
                    }
                    if (strafe === 0) {
                        this._app.fire('cc:move:left', 0);
                        this._app.fire('cc:move:right', 0);
                    }
                    this._lastStrafe = strafe;
                }

                // Looking (right stick)
                this._rightStick.pos.set(gamepad.axes[2], gamepad.axes[3]);
                applyRadialDeadZone(this._rightStick.pos, this._remappedPos, this.deadZoneLow, this.deadZoneHigh);

                const movX = this._remappedPos.x * this.turnSpeed;
                const movY = this._remappedPos.y * this.turnSpeed;
                this._app.fire('cc:look', movX, movY);

                // Jumping (bottom button of right cluster)
                if (gamepad.buttons[0].pressed && !this._lastJump) {
                    if (this._jumpTimeout) {
                        clearTimeout(this._jumpTimeout);
                    }
                    this._app.fire('cc:jump', true);
                    this._jumpTimeout = setTimeout(() => this._app.fire('cc:jump', false), 50);
                }
                this._lastJump = gamepad.buttons[0].pressed;
            }
        }
    }

    destroy() {
        this.enabled = false;
    }
}

class FirstPersonController extends Script {
    static scriptName = 'firstPersonController';

    /**
     * @type {RigidBodyComponent}
     * @private
     */
    _rigidbody;

    /**
     * @type {boolean}
     * @private
     */
    _jumping = false;

    /**
     * @type {KeyboardMouseInput}
     * @private
     */
    _keyboardMouseInput;

    /**
     * @type {MobileInput}
     * @private
     */
    _mobileInput;

    /**
     * @type {number}
     * @private
     */
    _mobileDeadZone = 0.3;

    /**
     * @type {number}
     * @private
     */
    _mobileTurnSpeed = 30;

    /**
     * @type {number}
     * @private
     */
    _mobileRadius = 50;

    /**
     * @type {number}
     * @private
     */
    _mobileDoubleTapInterval = 300;

    /**
     * @type {GamePadInput}
     * @private
     */
    _gamePadInput;

    /**
     * @type {number}
     * @private
     */
    _gamePadDeadZoneLow = 0.1;

    /**
     * @type {number}
     * @private
     */
    _gamePadDeadZoneHigh = 0.1;

    /**
     * @type {number}
     * @private
     */
    _gamePadTurnSpeed = 30;

    /**
     * @type {Vec2}
     */
    look = new Vec2();

    /**
     * @type {Record<string, boolean | number>}
     */
    controls = {
        forward: 0,
        backward: 0,
        left: 0,
        right: 0,
        jump: false,
        sprint: false
    };

    /**
     * @attribute
     * @type {Entity}
     */
    camera;

    /**
     * @attribute
     * @title Look Sensitivity
     * @description The sensitivity of the look controls.
     * @type {number}
     */
    lookSens = 0.08;

    /**
     * @attribute
     * @title Ground Speed
     * @description The speed of the character when on the ground.
     * @type {number}
     */
    speedGround = 50;

    /**
     * @attribute
     * @title Air Speed
     * @description The speed of the character when in the air.
     * @type {number}
     */
    speedAir = 5;

    /**
     * @attribute
     * @title Sprint Multiplier
     * @description The multiplier applied to the speed when sprinting.
     * @type {number}
     */
    sprintMult = 1.5;

    /**
     * @attribute
     * @title Velocity Damping Ground
     * @description The damping applied to the velocity when on the ground.
     * @type {number}
     */
    velocityDampingGround = 0.99;

    /**
     * @attribute
     * @title Velocity Damping Air
     * @description The damping applied to the velocity when in the air.
     * @type {number}
     */
    velocityDampingAir = 0.99925;

    /**
     * @attribute
     * @title Jump Force
     * @description The force applied when jumping.
     * @type {number}
     */
    jumpForce = 600;

    initialize() {
        // input
        this._keyboardMouseInput = new KeyboardMouseInput(this.app);
        this._mobileInput = new MobileInput(this.app);
        this._gamePadInput = new GamePadInput(this.app);

        this.on('enable', () => {
            this._keyboardMouseInput.enabled = true;
            this._mobileInput.enabled = true;
            this._gamePadInput.enabled = true;
        });
        this.on('disable', () => {
            this._keyboardMouseInput.enabled = false;
            this._mobileInput.enabled = false;
            this._gamePadInput.enabled = false;
        });

        if (!this.camera) {
            this.camera = this.entity.findComponent('camera').entity;
            if (!this.camera) {
                throw new Error('FirstPersonController expects a camera entity');
            }
        }
        if (!this.entity.collision) {
            this.entity.addComponent('collision', {
                type: 'capsule',
                radius: 0.5,
                height: 2
            });
        }
        if (!this.entity.rigidbody) {
            this.entity.addComponent('rigidbody', {
                type: 'dynamic',
                mass: 100,
                linearDamping: 0,
                angularDamping: 0,
                linearFactor: Vec3.ONE,
                angularFactor: Vec3.ZERO,
                friction: 0.5,
                restitution: 0
            });
        }
        this._rigidbody = this.entity.rigidbody;

        this.mobileDeadZone = this._mobileDeadZone;
        this.mobileTurnSpeed = this._mobileTurnSpeed;
        this.gamePadDeadZoneLow = this._gamePadDeadZoneLow;
        this.gamePadDeadZoneHigh = this._gamePadDeadZoneHigh;
        this.gamePadTurnSpeed = this._gamePadTurnSpeed;

        this.app.on('cc:look', (movX, movY) => {
            this.look.x = math.clamp(this.look.x - movY * this.lookSens, -LOOK_MAX_ANGLE, LOOK_MAX_ANGLE);
            this.look.y -= movX * this.lookSens;
        });
        this.app.on('cc:move:forward', (val) => {
            this.controls.forward = val;
        });
        this.app.on('cc:move:backward', (val) => {
            this.controls.backward = val;
        });
        this.app.on('cc:move:left', (val) => {
            this.controls.left = val;
        });
        this.app.on('cc:move:right', (val) => {
            this.controls.right = val;
        });
        this.app.on('cc:jump', (state) => {
            this.controls.jump = state;
        });
        this.app.on('cc:sprint', (state) => {
            this.controls.sprint = state;
        });

        this.on('destroy', this.destroy, this);
    }

    /**
     * @attribute
     * @title Mobile Dead Zone
     * @description Radial thickness of inner dead zone of the virtual joysticks. This dead zone ensures the virtual joysticks report a value of 0 even if a touch deviates a small amount from the initial touch.
     * @type {number}
     * @range [0, 0.4]
     */
    set mobileDeadZone(value) {
        this._mobileDeadZone = value ?? this._mobileDeadZone;
        if (this._mobileInput) {
            this._mobileInput.deadZone = this._mobileDeadZone;
        }
    }

    get mobileDeadZone() {
        return this._mobileDeadZone;
    }

    /**
     * @attribute
     * @title Mobile Turn Speed
     * @description Maximum turn speed in degrees per second
     * @type {number}
     */
    set mobileTurnSpeed(value) {
        this._mobileTurnSpeed = value ?? this._mobileTurnSpeed;
        if (this._mobileInput) {
            this._mobileInput.turnSpeed = this._mobileTurnSpeed;
        }
    }

    get mobileTurnSpeed() {
        return this._mobileTurnSpeed;
    }

    /**
     * @attribute
     * @title Mobile Radius
     * @description The radius of the virtual joystick in CSS pixels.
     * @type {number}
     */
    set mobileRadius(value) {
        this._mobileRadius = value ?? this._mobileRadius;
    }

    get mobileRadius() {
        return this._mobileRadius;
    }

    /**
     * @attribute
     * @title Mobile Double Tap Interval
     * @description The time in milliseconds between two taps of the right virtual joystick for a double tap to register. A double tap will trigger a cc:jump.
     * @type {number}
     */
    set mobileDoubleTapInterval(value) {
        this._mobileDoubleTapInterval = value ?? this._mobileDoubleTapInterval;
    }

    get mobileDoubleTapInterval() {
        return this._mobileDoubleTapInterval;
    }

    /**
     * @attribute
     * @title GamePad Dead Zone Low
     * @description Radial thickness of inner dead zone of pad's joysticks. This dead zone ensures that all pads report a value of 0 for each joystick axis when untouched.
     * @type {number}
     * @range [0, 0.4]
     */
    set gamePadDeadZoneLow(value) {
        this._gamePadDeadZoneLow = value ?? this._gamePadDeadZoneLow;
        if (this._gamePadInput) {
            this._gamePadInput.deadZoneLow = this._gamePadDeadZoneLow;
        }
    }

    get gamePadDeadZoneLow() {
        return this._gamePadDeadZoneLow;
    }

    /**
     * @attribute
     * @title GamePad Dead Zone High
     * @description Radial thickness of outer dead zone of pad's joysticks. This dead zone ensures that all pads can reach the -1 and 1 limits of each joystick axis.
     * @type {number}
     * @range [0, 0.4]
     */
    set gamePadDeadZoneHigh(value) {
        this._gamePadDeadZoneHigh = value ?? this._gamePadDeadZoneHigh;
        if (this._gamePadInput) {
            this._gamePadInput.deadZoneHigh = this._gamePadDeadZoneHigh;
        }
    }

    get gamePadDeadZoneHigh() {
        return this._gamePadDeadZoneHigh;
    }

    /**
     * @attribute
     * @title GamePad Turn Speed
     * @description Maximum turn speed in degrees per second
     * @type {number}
     */
    set gamePadTurnSpeed(value) {
        this._gamePadTurnSpeed = value ?? this._gamePadTurnSpeed;
        if (this._gamePadInput) {
            this._gamePadInput.turnSpeed = this._gamePadTurnSpeed;
        }
    }

    get gamePadTurnSpeed() {
        return this._gamePadTurnSpeed;
    }

    /**
     * @private
     */
    _checkIfGrounded() {
        const start = this.entity.getPosition();
        const end = tmpV1.copy(start).add(Vec3.DOWN);
        end.y -= 0.1;
        this._grounded = !!this._rigidbody.system.raycastFirst(start, end);
    }

    /**
     * @private
     */
    _jump() {
        if (this._rigidbody.linearVelocity.y < 0) {
            this._jumping = false;
        }
        if (this.controls.jump && !this._jumping && this._grounded) {
            this._jumping = true;
            this._rigidbody.applyImpulse(0, this.jumpForce, 0);
        }
    }

    /**
     * @private
     */
    _look() {
        this.camera.setLocalEulerAngles(this.look.x, this.look.y, 0);
    }

    /**
     * @param {number} dt - The delta time.
     */
    _move(dt) {
        tmpM1.setFromAxisAngle(Vec3.UP, this.look.y);
        const dir = tmpV1.set(0, 0, 0);
        if (this.controls.forward) {
            dir.add(tmpV2.set(0, 0, -this.controls.forward));
        }
        if (this.controls.backward) {
            dir.add(tmpV2.set(0, 0, this.controls.backward));
        }
        if (this.controls.left) {
            dir.add(tmpV2.set(-this.controls.left, 0, 0));
        }
        if (this.controls.right) {
            dir.add(tmpV2.set(this.controls.right, 0, 0));
        }
        tmpM1.transformVector(dir, dir);

        let speed = this._grounded ? this.speedGround : this.speedAir;
        if (this.controls.sprint) {
            speed *= this.sprintMult;
        }

        const accel = dir.mulScalar(speed * dt);
        const velocity = this._rigidbody.linearVelocity.add(accel);

        const damping = this._grounded ? this.velocityDampingGround : this.velocityDampingAir;
        const mult = Math.pow(damping, dt * 1e3);
        velocity.x *= mult;
        velocity.z *= mult;

        this._rigidbody.linearVelocity = velocity;
    }

    /**
     * @param {number} dt - The delta time.
     */
    update(dt) {
        this._mobileInput.update();
        this._gamePadInput.update();

        this._checkIfGrounded();
        this._jump();
        this._look();
        this._move(dt);
    }

    destroy() {
        this._keyboardMouseInput.destroy();
        this._mobileInput.destroy();
        this._gamePadInput.destroy();
    }
}

export { FirstPersonController };

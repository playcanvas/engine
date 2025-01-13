/* eslint-disable-next-line import/no-unresolved */
import { math, Script, Vec2, Vec3, Mat4 } from 'playcanvas';

/** @import { GraphicsDevice, Entity, RigidBodyComponent } from 'playcanvas' */

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
        remappedPos.copy(pos).scale(normalizedMag / magnitude);
    } else {
        remappedPos.set(0, 0);
    }
};

class KeyboardMouseInput extends Script {
    /**
     * @type {HTMLCanvasElement}
     * @private
     */
    _canvas;

    /**
     * @param {object} args - The script arguments.
     */
    constructor(args) {
        super(args);
        this._canvas = this.app.graphicsDevice.canvas;

        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);

        this.on('enable', () => this._bind());
        this.on('disable', () => this._unbind());
        this._bind();
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
                this.app.fire('cc:move:forward', val);
                break;
            case 's':
            case 'arrowdown':
                this.app.fire('cc:move:backward', val);
                break;
            case 'a':
            case 'arrowleft':
                this.app.fire('cc:move:left', val);
                break;
            case 'd':
            case 'arrowright':
                this.app.fire('cc:move:right', val);
                break;
            case ' ':
                this.app.fire('cc:jump', !!val);
                break;
            case 'shift':
                this.app.fire('cc:sprint', !!val);
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

    _onMouseDown(e) {
        if (document.pointerLockElement !== this._canvas) {
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

        this.app.fire('cc:look', movementX, movementY);
    }

    destroy() {
        this._unbind();
    }
}

class MobileInput extends Script {
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
     * @attribute
     * @title Dead Zone
     * @description Radial thickness of inner dead zone of the virtual joysticks. This dead zone ensures the virtual joysticks report a value of 0 even if a touch deviates a small amount from the initial touch.
     * @type {number}
     * @range [0, 0.4]
     */
    deadZone = 0.3;

    /**
     * @attribute
     * @title Turn Speed
     * @description Maximum turn speed in degrees per second
     * @type {number}
     */
    turnSpeed = 30;

    /**
     * @attribute
     * @title Radius
     * @description The radius of the virtual joystick in CSS pixels.
     * @type {number}
     */
    radius = 50;

    /**
     * @attribute
     * @title Double Tap Interval
     * @description The time in milliseconds between two taps of the right virtual joystick for a double tap to register. A double tap will trigger a cc:jump.
     * @type {number}
     */
    doubleTapInterval = 300;

    /**
     * @param {object} args - The script arguments.
     */
    constructor(args) {
        super(args);
        const {
            deadZone,
            turnSpeed,
            radius,
            doubleTapInterval
        } = args.attributes;

        this.deadZone = deadZone ?? this.deadZone;
        this.turnSpeed = turnSpeed ?? this.turnSpeed;
        this.radius = radius ?? this.radius;
        this.doubleTapInterval = doubleTapInterval ?? this.doubleTapInterval;

        this._device = this.app.graphicsDevice;
        this._canvas = this._device.canvas;

        this._onTouchStart = this._onTouchStart.bind(this);
        this._onTouchMove = this._onTouchMove.bind(this);
        this._onTouchEnd = this._onTouchEnd.bind(this);

        this.on('enable', () => this._bind());
        this.on('disable', () => this._unbind());
        this._bind();
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
                this.app.fire('leftjoystick:enable', touch.pageX * xFactor, touch.pageY * yFactor);
            } else if (touch.pageX > this._canvas.clientWidth / 2 && this._rightStick.identifier === -1) {
                // ...otherwise create a right virtual joystick
                this._rightStick.identifier = touch.identifier;
                this._rightStick.center.set(touch.pageX, touch.pageY);
                this._rightStick.pos.set(0, 0);
                this.app.fire('rightjoystick:enable', touch.pageX * xFactor, touch.pageY * yFactor);

                // See how long since the last tap of the right virtual joystick to detect a double tap (jump)
                const now = Date.now();
                if (now - this._lastRightTap < this.doubleTapInterval) {
                    if (this._jumpTimeout) {
                        clearTimeout(this._jumpTimeout);
                    }
                    this.app.fire('cc:jump', true);
                    this._jumpTimeout = setTimeout(() => this.app.fire('cc:jump', false), 50);
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
                this._leftStick.pos.scale(1 / this.radius);
                this.app.fire('leftjoystick:move', touch.pageX * xFactor, touch.pageY * yFactor);
            } else if (touch.identifier === this._rightStick.identifier) {
                this._rightStick.pos.set(touch.pageX, touch.pageY);
                this._rightStick.pos.sub(this._rightStick.center);
                this._rightStick.pos.scale(1 / this.radius);
                this.app.fire('rightjoystick:move', touch.pageX * xFactor, touch.pageY * yFactor);
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
                this.app.fire('cc:move:forward', 0);
                this.app.fire('cc:move:backward', 0);
                this.app.fire('cc:move:left', 0);
                this.app.fire('cc:move:right', 0);
                this.app.fire('leftjoystick:disable');
            } else if (touch.identifier === this._rightStick.identifier) {
                this._rightStick.identifier = -1;
                this.app.fire('rightjoystick:disable');
            }
        }
    }

    update() {
        // Moving
        if (this._leftStick.identifier !== -1) {
            // Apply a lower radial dead zone. We don't need an upper zone like with a real joypad
            applyRadialDeadZone(this._leftStick.pos, this._remappedPos, this.deadZone, 0);

            const forward = -this._remappedPos.y;
            if (this._lastForward !== forward) {
                if (forward > 0) {
                    this.app.fire('cc:move:forward', Math.abs(forward));
                    this.app.fire('cc:move:backward', 0);
                }
                if (forward < 0) {
                    this.app.fire('cc:move:forward', 0);
                    this.app.fire('cc:move:backward', Math.abs(forward));
                }
                if (forward === 0) {
                    this.app.fire('cc:move:forward', 0);
                    this.app.fire('cc:move:backward', 0);
                }
                this._lastForward = forward;
            }

            const strafe = this._remappedPos.x;
            if (this._lastStrafe !== strafe) {
                if (strafe > 0) {
                    this.app.fire('cc:move:left', 0);
                    this.app.fire('cc:move:right', Math.abs(strafe));
                }
                if (strafe < 0) {
                    this.app.fire('cc:move:left', Math.abs(strafe));
                    this.app.fire('cc:move:right', 0);
                }
                if (strafe === 0) {
                    this.app.fire('cc:move:left', 0);
                    this.app.fire('cc:move:right', 0);
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
            this.app.fire('cc:look', movX, movY);
        }
    }

    destroy() {
        this._unbind();
    }
}

class GamePadInput extends Script {
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
     * @attribute
     * @title Dead Zone Low
     * @description Radial thickness of inner dead zone of pad's joysticks. This dead zone ensures that all pads report a value of 0 for each joystick axis when untouched.
     * @type {number}
     * @range [0, 0.4]
     */
    deadZoneLow = 0.1;

    /**
     * @attribute
     * @title Dead Zone High
     * @description Radial thickness of outer dead zone of pad's joysticks. This dead zone ensures that all pads can reach the -1 and 1 limits of each joystick axis.
     * @type {number}
     * @range [0, 0.4]
     */
    deadZoneHigh = 0.1;

    /**
     * @attribute
     * @title Turn Speed
     * @description Maximum turn speed in degrees per second
     * @type {number}
     */
    turnSpeed = 30;

    /**
     * @param {object} args - The script arguments.
     */
    constructor(args) {
        super(args);
        const {
            deadZoneLow,
            deadZoneHigh,
            turnSpeed
        } = args.attributes;

        this.deadZoneLow = deadZoneLow ?? this.deadZoneLow;
        this.deadZoneHigh = deadZoneHigh ?? this.deadZoneHigh;
        this.turnSpeed = turnSpeed ?? this.turnSpeed;
    }

    update() {
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
                        this.app.fire('cc:move:forward', Math.abs(forward));
                        this.app.fire('cc:move:backward', 0);
                    }
                    if (forward < 0) {
                        this.app.fire('cc:move:forward', 0);
                        this.app.fire('cc:move:backward', Math.abs(forward));
                    }
                    if (forward === 0) {
                        this.app.fire('cc:move:forward', 0);
                        this.app.fire('cc:move:backward', 0);
                    }
                    this._lastForward = forward;
                }

                const strafe = this._remappedPos.x;
                if (this._lastStrafe !== strafe) {
                    if (strafe > 0) {
                        this.app.fire('cc:move:left', 0);
                        this.app.fire('cc:move:right', Math.abs(strafe));
                    }
                    if (strafe < 0) {
                        this.app.fire('cc:move:left', Math.abs(strafe));
                        this.app.fire('cc:move:right', 0);
                    }
                    if (strafe === 0) {
                        this.app.fire('cc:move:left', 0);
                        this.app.fire('cc:move:right', 0);
                    }
                    this._lastStrafe = strafe;
                }

                // Looking (right stick)
                this._rightStick.pos.set(gamepad.axes[2], gamepad.axes[3]);
                applyRadialDeadZone(this._rightStick.pos, this._remappedPos, this.deadZoneLow, this.deadZoneHigh);

                const movX = this._remappedPos.x * this.turnSpeed;
                const movY = this._remappedPos.y * this.turnSpeed;
                this.app.fire('cc:look', movX, movY);

                // Jumping (bottom button of right cluster)
                if (gamepad.buttons[0].pressed && !this._lastJump) {
                    if (this._jumpTimeout) {
                        clearTimeout(this._jumpTimeout);
                    }
                    this.app.fire('cc:jump', true);
                    this._jumpTimeout = setTimeout(() => this.app.fire('cc:jump', false), 50);
                }
                this._lastJump = gamepad.buttons[0].pressed;
            }
        }
    }
}

class FirstPersonController extends Script {
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

    /**
     * @param {object} args - The script arguments.
     */
    constructor(args) {
        super(args);
        const {
            camera,
            lookSens,
            speedGround,
            speedAir,
            sprintMult,
            velocityDampingGround,
            velocityDampingAir,
            jumpForce
        } = args.attributes;

        this.camera = camera;
        this.lookSens = lookSens ?? this.lookSens;
        this.speedGround = speedGround ?? this.speedGround;
        this.speedAir = speedAir ?? this.speedAir;
        this.sprintMult = sprintMult ?? this.sprintMult;
        this.velocityDampingGround = velocityDampingGround ?? this.velocityDampingGround;
        this.velocityDampingAir = velocityDampingAir ?? this.velocityDampingAir;
        this.jumpForce = jumpForce ?? this.jumpForce;

        if (!camera) {
            throw new Error('No camera entity found');
        }
        if (!this.entity.rigidbody) {
            throw new Error('No rigidbody component found');
        }
        this._rigidbody = this.entity.rigidbody;

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
        this._checkIfGrounded();
        this._jump();
        this._look();
        this._move(dt);
    }
}

export {
    KeyboardMouseInput,
    MobileInput,
    GamePadInput,
    FirstPersonController
};

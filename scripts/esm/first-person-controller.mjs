import {
    math,
    InputFrame,
    KeyboardMouseSource,
    DualGestureSource,
    GamepadSource,
    Quat,
    Script,
    Vec3
} from 'playcanvas';

/** @import { Entity, RigidBodyComponent, RigidBodyComponentSystem } from 'playcanvas' */

/**
 * @typedef {object} FirstPersonControllerState
 * @property {Vec3} axis - The movement axis.
 * @property {number[]} mouse - The mouse position.
 * @property {number} a - The 'A' button state.
 * @property {number} space - The space key state.
 * @property {number} shift - The shift key state.
 * @property {number} ctrl - The ctrl key state.
 */

const EPSILON = 0.0001;

const v = new Vec3();

const forward = new Vec3();
const right = new Vec3();

const offset = new Vec3();
const rotation = new Quat();

const frame = new InputFrame({
    move: [0, 0, 0],
    rotate: [0, 0, 0],
    jump: [0]
});

/**
 * Calculate the damp rate.
 *
 * @param {number} damping - The damping.
 * @param {number} dt - The delta time.
 * @returns {number} - The lerp rate.
 */
export const damp = (damping, dt) => 1 - Math.pow(damping, dt * 1000);

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

class FirstPersonController extends Script {
    static scriptName = 'firstPersonController';

    /**
     * @type {boolean}
     * @private
     */
    _ready = false;

    /**
     * @type {RigidBodyComponent}
     * @private
     */
    // @ts-ignore
    _rigidbody;

    /**
     * @type {KeyboardMouseSource}
     * @private
     */
    _desktopInput = new KeyboardMouseSource({ pointerLock: true });

    /**
     * @type {DualGestureSource}
     * @private
     */
    _mobileInput = new DualGestureSource();

    /**
     * @type {GamepadSource}
     * @private
     */
    _gamepadInput = new GamepadSource();

    /**
     * @type {FirstPersonControllerState}
     * @private
     */
    _state = {
        axis: new Vec3(),
        mouse: [0, 0, 0],
        a: 0,
        space: 0,
        shift: 0,
        ctrl: 0
    };

    /**
     * @type {Vec3}
     * @private
     */
    _angles = new Vec3();

    /**
     * @type {boolean}
     * @private
     */
    _grounded = false;

    /**
     * @type {boolean}
     * @private
     */
    _jumping = false;

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
     * @attribute
     * @title Camera
     * @description The camera entity that will be used for looking around.
     * @type {Entity}
     */
    // @ts-ignore
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

    /**
     * The joystick event name for the UI position for the base and stick elements.
     * The event name is appended with the side: ':left' or ':right'.
     *
     * @attribute
     * @title Joystick Base Event Name
     * @type {string}
     */
    joystickEventName = 'joystick';

    initialize() {
        if (!this.camera) {
            throw new Error('FirstPersonController: Camera entity is required.');
        }

        // check collision and rigidbody
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
        this._rigidbody = /** @type {RigidBodyComponent} */ (this.entity.rigidbody);

        // attach input
        this._desktopInput.attach(this.app.graphicsDevice.canvas);
        this._mobileInput.attach(this.app.graphicsDevice.canvas);
        this._gamepadInput.attach(this.app.graphicsDevice.canvas);

        // expose ui events
        this._mobileInput.on('joystick:position:left', ([bx, by, sx, sy]) => {
            this.app.fire(`${this.joystickEventName}:left`, bx, by, sx, sy);
        });
        this._mobileInput.on('joystick:position:right', ([bx, by, sx, sy]) => {
            this.app.fire(`${this.joystickEventName}:right`, bx, by, sx, sy);
        });

        this.on('destroy', this.destroy, this);

        this._ready = true;
    }

    /**
     * @attribute
     * @title Mobile Dead Zone
     * @description Radial thickness of inner dead zone of the virtual joysticks. This dead zone ensures the virtual joysticks report a value of 0 even if a touch deviates a small amount from the initial touch.
     * @type {number}
     * @range [0, 0.4]
     * @default 0.3
     */
    set mobileDeadZone(value) {
        this._mobileDeadZone = value ?? this._mobileDeadZone;
    }

    get mobileDeadZone() {
        return this._mobileDeadZone;
    }

    /**
     * @attribute
     * @title Mobile Turn Speed
     * @description Maximum turn speed in degrees per second
     * @type {number}
     * @default 30
     */
    set mobileTurnSpeed(value) {
        this._mobileTurnSpeed = value ?? this._mobileTurnSpeed;
    }

    get mobileTurnSpeed() {
        return this._mobileTurnSpeed;
    }

    /**
     * @attribute
     * @title Mobile Radius
     * @description The radius of the virtual joystick in CSS pixels.
     * @type {number}
     * @default 50
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
     * @default 300
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
     * @default 0.1
     */
    set gamePadDeadZoneLow(value) {
        this._gamePadDeadZoneLow = value ?? this._gamePadDeadZoneLow;
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
     * @default 0.1
     */
    set gamePadDeadZoneHigh(value) {
        this._gamePadDeadZoneHigh = value ?? this._gamePadDeadZoneHigh;
    }

    get gamePadDeadZoneHigh() {
        return this._gamePadDeadZoneHigh;
    }

    /**
     * @attribute
     * @title GamePad Turn Speed
     * @description Maximum turn speed in degrees per second
     * @type {number}
     * @default 30
     */
    set gamePadTurnSpeed(value) {
        this._gamePadTurnSpeed = value ?? this._gamePadTurnSpeed;
    }

    get gamePadTurnSpeed() {
        return this._gamePadTurnSpeed;
    }

    /**
     * @param {InputFrame<{ move: number[], rotate: number[], jump: number[] }>} frame - The input frame.
     * @param {number} dt - The delta time.
     * @private
     */
    _updateController(frame, dt) {
        const { move, rotate, jump } = frame.read();

        // jump
        if (this._rigidbody.linearVelocity.y < 0) {
            this._jumping = false;
        }
        if (jump[0] && !this._jumping && this._grounded) {
            this._jumping = true;
            this._rigidbody.applyImpulse(0, this.jumpForce, 0);
        }

        // rotate
        this._angles.add(v.set(-rotate[1], -rotate[0], 0));
        this._angles.x = math.clamp(this._angles.x, -90, 90);
        this.camera.setLocalEulerAngles(this._angles);

        // move
        rotation.setFromEulerAngles(0, this._angles.y, 0);
        rotation.transformVector(Vec3.FORWARD, forward);
        rotation.transformVector(Vec3.RIGHT, right);
        offset.set(0, 0, 0);
        offset.add(forward.mulScalar(move[2]));
        offset.add(right.mulScalar(move[0]));
        const velocity = this._rigidbody.linearVelocity.add(offset);
        const alpha = damp(this._grounded ? this.velocityDampingGround : this.velocityDampingAir, dt);
        velocity.x = math.lerp(velocity.x, 0, alpha);
        velocity.z = math.lerp(velocity.z, 0, alpha);
        this._rigidbody.linearVelocity = velocity;
    }

    /**
     * @param {number} dt - The delta time.
     */
    update(dt) {
        if (!this._ready) {
            return;
        }

        const { keyCode } = KeyboardMouseSource;
        const { buttonCode } = GamepadSource;

        const { key, button, mouse } = this._desktopInput.read();
        const { leftInput, rightInput, doubleTap } = this._mobileInput.read();
        const { buttons, leftStick, rightStick } = this._gamepadInput.read();

        // apply dead zone to gamepad sticks
        applyDeadZone(leftStick, this.gamePadDeadZoneLow, this.gamePadDeadZoneHigh);
        applyDeadZone(rightStick, this.gamePadDeadZoneLow, this.gamePadDeadZoneHigh);

        // update state
        this._state.axis.add(v.set(
            (key[keyCode.D] - key[keyCode.A]) + (key[keyCode.RIGHT] - key[keyCode.LEFT]),
            (key[keyCode.E] - key[keyCode.Q]),
            (key[keyCode.W] - key[keyCode.S]) + (key[keyCode.UP] - key[keyCode.DOWN])
        ));
        for (let i = 0; i < this._state.mouse.length; i++) {
            this._state.mouse[i] += button[i];
        }
        this._state.a += buttons[buttonCode.A];
        this._state.space += key[keyCode.SPACE];
        this._state.shift += key[keyCode.SHIFT];
        this._state.ctrl += key[keyCode.CTRL];

        // check if grounded
        const start = this.entity.getPosition();
        const end = v.copy(start).add(Vec3.DOWN);
        end.y -= 0.1;
        const system = /** @type {RigidBodyComponentSystem} */ (this._rigidbody.system);
        this._grounded = !!system.raycastFirst(start, end);

        const moveMult = (this._grounded ? this.speedGround : this.speedAir) * dt;
        const rotateMult = this.lookSens * 60 * dt;
        const rotateTouchMult = this._mobileTurnSpeed * dt;
        const rotateJoystickMult = this.gamePadTurnSpeed * dt;

        const { deltas } = frame;

        // desktop move
        v.set(0, 0, 0);
        const keyMove = this._state.axis.clone().normalize();
        v.add(keyMove.mulScalar(moveMult * (this._state.shift ? this.sprintMult : 1)));
        deltas.move.append([v.x, v.y, v.z]);

        // desktop rotate
        v.set(0, 0, 0);
        const mouseRotate = new Vec3(mouse[0], mouse[1], 0);
        v.add(mouseRotate.mulScalar(rotateMult));
        deltas.rotate.append([v.x, v.y, v.z]);

        // desktop jump
        deltas.jump.append([this._state.space]);

        // mobile move
        v.set(0, 0, 0);
        const flyMove = new Vec3(leftInput[0], 0, -leftInput[1]);
        flyMove.mulScalar(2);
        const mag = flyMove.length();
        if (mag > 1) {
            flyMove.normalize();
        }
        v.add(flyMove.mulScalar(moveMult * (mag > 2 - EPSILON ? this.sprintMult : 1)));
        deltas.move.append([v.x, v.y, v.z]);

        // mobile rotate
        v.set(0, 0, 0);
        const mobileRotate = new Vec3(rightInput[0], rightInput[1], 0);
        v.add(mobileRotate.mulScalar(rotateTouchMult));
        deltas.rotate.append([v.x, v.y, v.z]);

        // mobile jump
        deltas.jump.append([doubleTap[0]]);

        // gamepad move
        v.set(0, 0, 0);
        const stickMove = new Vec3(leftStick[0], 0, -leftStick[1]);
        v.add(stickMove.mulScalar(moveMult));
        deltas.move.append([v.x, v.y, v.z]);

        // gamepad rotate
        v.set(0, 0, 0);
        const stickRotate = new Vec3(rightStick[0], rightStick[1], 0);
        v.add(stickRotate.mulScalar(rotateJoystickMult));
        deltas.rotate.append([v.x, v.y, v.z]);

        // gamepad jump
        deltas.jump.append([this._state.a]);

        // update controller
        this._updateController(frame, dt);
    }

    destroy() {
        this._desktopInput.destroy();
        this._mobileInput.destroy();
        this._gamepadInput.destroy();
    }
}

export { FirstPersonController };

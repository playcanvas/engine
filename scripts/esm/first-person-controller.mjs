import {
    math,
    BODYMASK_ALL,
    CHARACTER_GROUP,
    CharacterController,
    GamePads,
    Gestures,
    InputFrame,
    Keyboard,
    Mouse,
    PAD_FACE_1,
    Script,
    Vec3
} from 'playcanvas';

/** @import { Entity, RigidBodyComponent } from 'playcanvas' */

const EPSILON = 0.0001;

// the mass of the former dynamic body, so a jump force gives the same jump velocity
const MASS = 100;

const tmpV = new Vec3();

const leftStick = [0, 0];
const rightStick = [0, 0];

/**
 * @param {Keyboard} keyboard - The keyboard.
 * @param {string} code - The `KeyboardEvent.code`.
 * @returns {number} 1 while the key is held, otherwise 0.
 */
const key = (keyboard, code) => +keyboard.isPressed(code);

/**
 * A physics-based first-person character controller, driven by keyboard and mouse (with pointer
 * lock), dual-gesture touch input or a gamepad. Movement drives a kinematic capsule through a
 * {@link CharacterController}: damped ground and air movement, sprinting and jumping, sliding
 * along walls and slopes. Capsule collision and rigid body components are created on the entity
 * if not already present, and the rigid body is made kinematic in {@link CHARACTER_GROUP}.
 *
 * The {@link FirstPersonController#camera} attribute must be set to a child camera entity, which
 * receives the look rotation. A physics library such as Ammo must be loaded.
 *
 * @example
 * playerEntity.addComponent('script');
 * playerEntity.script.create(FirstPersonController, {
 *     properties: {
 *         camera: cameraEntity,
 *         jumpForce: 850
 *     }
 * });
 * @category Controllers
 */
class FirstPersonController extends Script {
    static scriptName = 'firstPersonController';

    /**
     * @type {CharacterController|null}
     * @private
     */
    _controller = null;

    /**
     * @type {InputFrame}
     * @private
     */
    _frame = new InputFrame(CharacterController.fields);

    /**
     * @type {Keyboard}
     * @private
     */
    // @ts-ignore
    _keyboard;

    /**
     * @type {Mouse}
     * @private
     */
    // @ts-ignore
    _mouse;

    /**
     * @type {Gestures}
     * @private
     */
    // @ts-ignore
    _gestures;

    /**
     * The gamepads owned by the script, when the app has none.
     *
     * @type {GamePads|null}
     * @private
     */
    _gamepads = null;

    /**
     * @type {(event: PointerEvent) => void}
     * @private
     */
    // @ts-ignore
    _onPointerDown;

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
                type: 'kinematic',
                friction: 0.5,
                restitution: 0
            });
        }

        // setting the type resets the group and mask, so it goes first
        const rigidbody = /** @type {RigidBodyComponent} */ (this.entity.rigidbody);
        rigidbody.type = 'kinematic';
        rigidbody.group = CHARACTER_GROUP;
        rigidbody.mask = BODYMASK_ALL;

        // devices
        const canvas = this.app.graphicsDevice.canvas;
        this._keyboard = new Keyboard(window);
        this._mouse = new Mouse(canvas, { pointer: true });
        this._gestures = new Gestures(canvas, { layout: 'joystick-touch' });
        if (!this.app.gamepads) {
            this._gamepads = new GamePads();
        }

        // pointer lock on click
        this._onPointerDown = (event) => {
            if (event.pointerType === 'mouse' && document.pointerLockElement !== canvas) {
                canvas.requestPointerLock?.();
            }
        };
        canvas.addEventListener('pointerdown', this._onPointerDown);

        // expose ui events
        this._gestures.on('joystick:position:left', ([bx, by, sx, sy]) => {
            this.app.fire(`${this.joystickEventName}:left`, bx, by, sx, sy);
        });
        this._gestures.on('joystick:position:right', ([bx, by, sx, sy]) => {
            this.app.fire(`${this.joystickEventName}:right`, bx, by, sx, sy);
        });

        this._controller = new CharacterController(this.entity);

        // start looking where the camera faces
        const forward = this.camera.getLocalRotation().transformVector(Vec3.FORWARD, tmpV);
        this.look(Math.asin(math.clamp(forward.y, -1, 1)) * math.RAD_TO_DEG, Math.atan2(-forward.x, -forward.z) * math.RAD_TO_DEG);

        this.on('destroy', this.destroy, this);
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
     * Sets the look direction. The camera faces it right away and input turns from it.
     *
     * @param {number} pitch - The pitch in degrees, clamped to -90 to 90.
     * @param {number} yaw - The yaw in degrees.
     * @example
     * playerEntity.script.firstPersonController.look(-10, 35);
     */
    look(pitch, yaw) {
        pitch = math.clamp(pitch, -90, 90);
        const look = /** @type {number[]} */ (this._frame.input.look);
        look[0] = pitch;
        look[1] = yaw;
        this.camera?.setLocalEulerAngles(pitch, yaw, 0);

        const controller = this._controller;
        if (controller) {
            const state = controller.state;
            state.look = [pitch, yaw];
            controller.state = state;
        }
    }

    /**
     * Writes the device input into the frame. The look is absolute, so turn rates and drags are
     * accumulated into it here.
     *
     * @param {number} dt - The delta time.
     * @private
     */
    _map(dt) {
        const { _keyboard: keyboard, _mouse: mouse, _gestures: gestures } = this;
        const gamepads = this.app.gamepads ?? this._gamepads;
        const { input } = this._frame;
        const move = /** @type {number[]} */ (input.move);
        const look = /** @type {number[]} */ (input.look);
        let jump = false;
        let sprint = false;

        // keyboard and mouse only once the pointer is locked
        if (document.pointerLockElement === this.app.graphicsDevice.canvas) {
            move[0] = key(keyboard, 'KeyD') - key(keyboard, 'KeyA') + key(keyboard, 'ArrowRight') - key(keyboard, 'ArrowLeft');
            move[1] = key(keyboard, 'KeyW') - key(keyboard, 'KeyS') + key(keyboard, 'ArrowUp') - key(keyboard, 'ArrowDown');
            jump = keyboard.isPressed('Space');
            sprint = keyboard.isPressed('ShiftLeft') || keyboard.isPressed('ShiftRight');
            look[0] -= mouse.movement[1] * this.lookSens;
            look[1] -= mouse.movement[0] * this.lookSens;
        } else {
            move[0] = move[1] = 0;
        }

        // half joystick deflection moves at full speed and full deflection sprints
        const { x, y } = gestures.leftJoystick.value;
        const mag = Math.sqrt(x * x + y * y) * 2;
        const scale = mag > 1 ? 2 / mag : 2;
        move[0] += x * scale;
        move[1] -= y * scale;
        sprint ||= mag > 2 - EPSILON;
        jump ||= gestures.doubleTaps > 0;
        look[0] -= gestures.right[1] * this._mobileTurnSpeed * dt;
        look[1] -= gestures.right[0] * this._mobileTurnSpeed * dt;

        // the high dead zone is a thickness from the rim
        if (gamepads) {
            const low = this._gamePadDeadZoneLow;
            const high = 1 - this._gamePadDeadZoneHigh;
            for (const pad of gamepads.current) {
                if (pad.mapping !== 'standard') {
                    continue;
                }
                jump ||= pad.isPressed(PAD_FACE_1);
                const axes = pad.axes;
                if (axes.length < 4) {
                    continue;
                }
                leftStick[0] = axes[0];
                leftStick[1] = axes[1];
                rightStick[0] = axes[2];
                rightStick[1] = axes[3];
                GamePads.applyDeadZone(leftStick, low, high);
                GamePads.applyDeadZone(rightStick, low, high);
                move[0] += leftStick[0];
                move[1] -= leftStick[1];
                look[0] -= rightStick[1] * this._gamePadTurnSpeed * dt;
                look[1] -= rightStick[0] * this._gamePadTurnSpeed * dt;
            }
        }

        move[0] = math.clamp(move[0], -1, 1);
        move[1] = math.clamp(move[1], -1, 1);
        look[0] = math.clamp(look[0], -90, 90);
        input.jump = jump;
        input.sprint = sprint;
    }

    /**
     * @param {number} dt - The delta time.
     */
    update(dt) {
        const controller = this._controller;
        if (!controller) {
            return;
        }

        // forward settings
        controller.speedGround = this.speedGround;
        controller.speedAir = this.speedAir;
        controller.sprintMult = this.sprintMult;
        controller.velocityDampingGround = this.velocityDampingGround;
        controller.velocityDampingAir = this.velocityDampingAir;
        controller.jumpSpeed = this.jumpForce / MASS;
        controller.gravity = this.app.systems.rigidbody.gravity.y;

        this._map(dt);
        controller.step(this._frame.capture(dt));

        // step moves the entity, so the camera keeps its authored offset and only takes the look
        this.camera.setLocalEulerAngles(controller.update(dt).angles);

        this._keyboard.update();
        this._mouse.update();
        this._gestures.update();
        this._gamepads?.update();
    }

    destroy() {
        this.app.graphicsDevice.canvas.removeEventListener('pointerdown', this._onPointerDown);
        this._keyboard.detach();
        this._mouse.detach();
        this._gestures.destroy();
        this._gamepads?.destroy();
        this._controller?.destroy();
    }
}

export { FirstPersonController };

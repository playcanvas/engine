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
    Quat,
    Script,
    Vec3
} from 'playcanvas';

/** @import { Entity, RigidBodyComponent } from 'playcanvas' */

const EPSILON = 0.0001;

// the mass of the former dynamic body, so a jump force gives the same jump velocity
const MASS = 100;

// the longest step the controller applies, used to turn its displacement into a speed
const MAX_STEP_DT = 0.1;

// the camera collision ray ignores characters, including this one
const CAMERA_RAY_OPTIONS = { filterCollisionMask: BODYMASK_ALL ^ CHARACTER_GROUP };

// scratch
const v = new Vec3();
const v2 = new Vec3();
const v3 = new Vec3();
const v4 = new Vec3();
const forward = new Vec3();
const tmpQ = new Quat();

const leftStick = [0, 0];
const rightStick = [0, 0];

/**
 * Calculate the damp rate.
 *
 * @param {number} damping - The damping factor (smaller = snappier).
 * @param {number} dt - The delta time.
 * @returns {number} - The lerp factor in 0..1.
 */
const damp = (damping, dt) => 1 - Math.pow(damping, dt * 1000);

/**
 * Lerp between two angles taking the shortest arc.
 *
 * @param {number} from - Source angle in degrees.
 * @param {number} to - Target angle in degrees.
 * @param {number} alpha - Lerp factor in 0..1.
 * @returns {number} The interpolated angle in degrees.
 */
const lerpAngle = (from, to, alpha) => {
    const delta = (((to - from) % 360) + 540) % 360 - 180;
    return from + delta * alpha;
};

/**
 * @param {Keyboard} keyboard - The keyboard.
 * @param {string} code - The `KeyboardEvent.code`.
 * @returns {number} 1 while the key is held, otherwise 0.
 */
const key = (keyboard, code) => +keyboard.isPressed(code);

/**
 * A reusable third-person character controller.
 *
 * The script is attached to a character controller entity with a capsule collision shape. Its
 * rigid body is made kinematic in {@link CHARACTER_GROUP} and moved by a
 * {@link CharacterController}. A physics library such as Ammo must be loaded. It reads keyboard /
 * mouse (with pointer lock) / touch / gamepad input and:
 *
 * - Moves the character along the ground relative to the camera yaw, with damped ground and air
 *   movement, sprinting, jumping and sliding along walls and slopes.
 * - Rotates an optional {@link characterModel} child entity to face the
 *   movement direction.
 * - Orbits a separate {@link camera} entity around the character at a
 *   configurable distance and elevation, with smooth follow and wall collision
 *   avoidance via raycast.
 * - Fires script events that consumers can use to drive animations:
 *   - `speed` (integer 0/1/2): idle / walk / jog buckets when the bucket changes
 *   - `jump`: fired once each time the character jumps
 * @category Controllers
 */
class ThirdPersonController extends Script {
    static scriptName = 'thirdPersonController';

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
     * The jump input of the previous frame, to find the press the controller jumps on.
     *
     * @type {boolean}
     * @private
     */
    _prevJump = false;

    /**
     * The character position before the last step.
     *
     * @type {Vec3}
     * @private
     */
    _prevPos = new Vec3();

    /**
     * Current camera yaw in degrees (around character).
     *
     * @type {number}
     * @private
     */
    _yaw = 0;

    /**
     * Current camera pitch in degrees (around character). Positive looks down
     * at the character from above; the default starts the camera elevated and
     * angled down at the character from behind.
     *
     * @type {number}
     * @private
     */
    _pitch = 35;

    /**
     * Current smoothed character model yaw in degrees.
     *
     * @type {number}
     * @private
     */
    _modelYaw = 0;

    /**
     * Smoothed camera world position.
     *
     * @type {Vec3}
     * @private
     */
    _camPos = new Vec3();

    /**
     * Smoothed look-at point.
     *
     * @type {Vec3}
     * @private
     */
    _camLookAt = new Vec3();

    /**
     * @type {boolean}
     * @private
     */
    _camInitialized = false;

    /**
     * @type {number}
     * @private
     */
    _lastSpeedBucket = 0;

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
     * @description The camera entity that is orbited around the character. Must
     * be a top-level entity (not parented to the character controller) so the
     * controller can position it freely each frame.
     * @type {Entity}
     */
    // @ts-ignore
    camera;

    /**
     * @attribute
     * @title Character Model
     * @description Optional child entity that holds the visible character mesh.
     * If provided, the controller will smoothly rotate this entity around Y to
     * face the movement direction.
     * @type {Entity}
     */
    // @ts-ignore
    characterModel;

    /**
     * @attribute
     * @title Look Sensitivity
     * @description The mouse sensitivity for orbiting the camera.
     * @type {number}
     */
    lookSens = 0.15;

    /**
     * @attribute
     * @title Invert Look Y
     * @description When true, vertical mouse movement is inverted (mouse up
     * tilts the camera down and vice versa).
     * @type {boolean}
     */
    invertLookY = false;

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
     * @description The vertical impulse applied when the character jumps.
     * @type {number}
     */
    jumpForce = 600;

    /**
     * @attribute
     * @title Initial Pitch
     * @description Camera pitch (degrees) used on the first frame, clamped to
     * `[pitchMin, pitchMax]`. Positive values position the camera higher,
     * looking down at the character.
     * @type {number}
     */
    initialPitch = 35;

    /**
     * @attribute
     * @title Pitch Min
     * @description Lowest pitch angle (degrees). Negative looks up at character
     * from below, positive looks down.
     * @type {number}
     */
    pitchMin = -30;

    /**
     * @attribute
     * @title Pitch Max
     * @description Highest pitch angle (degrees, looking down at character).
     * @type {number}
     */
    pitchMax = 75;

    /**
     * @attribute
     * @title Camera Distance
     * @description Distance from the character to the camera, in world units.
     * @type {number}
     */
    cameraDistance = 5;

    /**
     * @attribute
     * @title Camera Distance Min
     * @description Closest the camera can zoom in to (mouse scroll wheel
     * controls zoom within `[cameraDistanceMin, cameraDistanceMax]`).
     * @type {number}
     */
    cameraDistanceMin = 1.5;

    /**
     * @attribute
     * @title Camera Distance Max
     * @description Farthest the camera can zoom out to.
     * @type {number}
     */
    cameraDistanceMax = 15;

    /**
     * @attribute
     * @title Zoom Speed
     * @description Mouse scroll wheel sensitivity. Larger values zoom faster
     * per notch of the wheel.
     * @type {number}
     */
    zoomSpeed = 0.01;

    /**
     * @attribute
     * @title Zoom Damping
     * @description Damping factor used to smooth scroll-wheel zoom. This is
     * the fraction of "distance to target" retained per millisecond, so values
     * close to `1` are smooth/laggy and values close to `0` are snappy. `0`
     * disables smoothing entirely (instant zoom).
     * @range [0, 1]
     * @type {number}
     */
    zoomDamping = 0.997;

    /**
     * Target camera distance the actual `cameraDistance` lerps toward each
     * frame; mutated by the scroll wheel.
     *
     * @type {number}
     * @private
     */
    _targetCameraDistance = 5;

    /**
     * @attribute
     * @title Camera Height
     * @description Vertical offset of the camera target above the character
     * pivot, in world units. The camera looks at the character position raised
     * by this amount, and orbits around that point.
     * @type {number}
     */
    cameraHeight = 1.2;

    /**
     * @attribute
     * @title Camera Min Height Above Character
     * @description Minimum Y offset (in world units) the camera is allowed to
     * sit relative to the character entity. The final camera Y is clamped to
     * `characterY + cameraMinHeightAboveCharacter`, so for the default value
     * of `0` the camera will never drop below the character's pivot Y. Use
     * positive values to keep the camera above head height, negative values
     * to allow it to dip toward the feet.
     * @type {number}
     */
    cameraMinHeightAboveCharacter = 0;

    /**
     * @attribute
     * @title Camera Min Distance
     * @description When the camera collides with geometry, it is clamped no
     * closer than this distance from the character.
     * @type {number}
     */
    cameraMinDistance = 0.4;

    /**
     * @attribute
     * @title Camera Collision Padding
     * @description Extra clearance applied to the camera position when a wall
     * is detected, to keep the camera from sitting flush against geometry.
     * @type {number}
     */
    cameraCollisionPadding = 0.25;

    /**
     * @attribute
     * @title Camera Collision Damping
     * @description Damping factor used to smooth the camera's reaction to
     * walls coming between the camera and the character. This is the fraction
     * of "distance to target" retained per millisecond, so values close to `1`
     * are smooth/laggy and values close to `0` snap immediately. `0` disables
     * smoothing for the collision response.
     * @range [0, 1]
     * @type {number}
     */
    cameraCollisionDamping = 0.99;

    /**
     * Smoothed effective camera distance (lerps toward the raycast-clamped
     * distance each frame). Initialized in `initialize()`.
     *
     * @type {number}
     * @private
     */
    _clampedDistance = 5;

    /**
     * @attribute
     * @title Camera Position Damping
     * @description Damping factor for camera follow smoothing. Smaller values
     * produce a snappier camera; larger values produce a laggier camera. A
     * value of 0 disables smoothing entirely.
     * @range [0, 1]
     * @type {number}
     */
    cameraPositionDamping = 0.0005;

    /**
     * @attribute
     * @title Camera Look-At Damping
     * @description Damping factor for the smoothed look-at point follow.
     * @range [0, 1]
     * @type {number}
     */
    cameraLookAtDamping = 0.00001;

    /**
     * @attribute
     * @title Model Turn Smoothing
     * @description Damping factor for the character model's rotation toward the
     * movement direction. Smaller values produce a snappier turn.
     * @range [0, 1]
     * @type {number}
     */
    modelTurnSmoothing = 0.000005;

    /**
     * @attribute
     * @title Model Yaw Offset
     * @description Yaw offset in degrees applied to the character model's
     * facing direction. Use this to correct for models whose forward axis is
     * not -Z (e.g. set to 180 for a model whose forward is +Z).
     * @type {number}
     */
    modelYawOffset = 0;

    /**
     * @attribute
     * @title Walk Speed Threshold
     * @description Horizontal speed (units/sec) above which the controller
     * reports `speed` bucket 1 (walk) via the `speed` event.
     * @type {number}
     */
    walkSpeedThreshold = 0.5;

    /**
     * @attribute
     * @title Jog Speed Threshold
     * @description Horizontal speed (units/sec) above which the controller
     * reports `speed` bucket 2 (jog/run) via the `speed` event.
     * @type {number}
     */
    jogSpeedThreshold = 4;

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
            throw new Error('ThirdPersonController: Camera entity is required.');
        }

        // collision and rigidbody defaults
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
        this._mouse = new Mouse(canvas, { capture: true });
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

        // expose ui events for mobile virtual joysticks
        this._gestures.on('joystick:position:left', ([bx, by, sx, sy]) => {
            this.app.fire(`${this.joystickEventName}:left`, bx, by, sx, sy);
        });
        this._gestures.on('joystick:position:right', ([bx, by, sx, sy]) => {
            this.app.fire(`${this.joystickEventName}:right`, bx, by, sx, sy);
        });

        this._controller = new CharacterController(this.entity);

        // initial camera yaw from where the camera entity faces, which holds past 90 degrees
        // unlike its euler angles
        const camForward = this.camera.forward;
        this._yaw = Math.atan2(-camForward.x, -camForward.z) * math.RAD_TO_DEG;
        this._pitch = math.clamp(this.initialPitch, this.pitchMin, this.pitchMax);
        this._targetCameraDistance = this.cameraDistance;
        this._clampedDistance = this.cameraDistance;

        // initial character model yaw - face away from the camera (so the
        // camera starts behind the character looking at its back). This is
        // computed from the camera yaw using the same atan2 formula that the
        // running update uses on velocity, so it produces a value that won't
        // jump when the character first starts moving forward.
        if (this.characterModel) {
            tmpQ.setFromEulerAngles(0, this._yaw, 0);
            tmpQ.transformVector(Vec3.FORWARD, forward);
            this._modelYaw = Math.atan2(forward.x, forward.z) * math.RAD_TO_DEG + this.modelYawOffset;
            this.characterModel.setLocalEulerAngles(0, this._modelYaw, 0);
        }

        this.on('destroy', this.destroy, this);
    }

    /**
     * @attribute
     * @title Mobile Dead Zone
     * @description Radial thickness of inner dead zone of the virtual joysticks.
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
     * @description Maximum turn speed in degrees per second.
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
     * @description Milliseconds between two taps of the right virtual joystick
     * for a double-tap to register as a jump.
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
     * @description Inner dead zone of pad joysticks.
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
     * @description Outer dead zone of pad joysticks.
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
     * @description Maximum gamepad turn speed in degrees per second.
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
     * Moves the character to a position, such as a spawn point, and stops it. The camera follows
     * without easing across the gap. Use this instead of `entity.setPosition`, which the next
     * update undoes.
     *
     * @param {Vec3} position - The world space position of the body centre.
     * @example
     * playerEntity.script.thirdPersonController.teleport(new Vec3(0, 1, 0));
     */
    teleport(position) {
        this._controller?.teleport(position);
        this._camInitialized = false;
    }

    /**
     * Writes the device input into the frame and turns the camera orbit. The look yaw is the
     * camera yaw, so movement is relative to the camera.
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
        let yaw = 0;
        let pitch = 0;

        // keyboard and mouse only once the pointer is locked
        if (document.pointerLockElement === this.app.graphicsDevice.canvas) {
            move[0] = key(keyboard, 'KeyD') - key(keyboard, 'KeyA') + key(keyboard, 'ArrowRight') - key(keyboard, 'ArrowLeft');
            move[1] = key(keyboard, 'KeyW') - key(keyboard, 'KeyS') + key(keyboard, 'ArrowUp') - key(keyboard, 'ArrowDown');
            jump = keyboard.isPressed('Space');
            sprint = keyboard.isPressed('ShiftLeft') || keyboard.isPressed('ShiftRight');
            yaw += mouse.movement[0] * this.lookSens;
            pitch += mouse.movement[1] * this.lookSens;
        } else {
            move[0] = move[1] = 0;
        }

        // scroll down zooms out; the wheel moves a target distance the camera glides toward
        if (mouse.wheel !== 0) {
            this._targetCameraDistance = math.clamp(
                this._targetCameraDistance + mouse.wheel * this.zoomSpeed,
                this.cameraDistanceMin,
                this.cameraDistanceMax
            );
        }

        // half joystick deflection moves at full speed and full deflection sprints
        const { x, y } = gestures.leftJoystick.value;
        const mag = Math.sqrt(x * x + y * y) * 2;
        const scale = mag > 1 ? 2 / mag : 2;
        move[0] += x * scale;
        move[1] -= y * scale;
        sprint ||= mag > 2 - EPSILON;
        jump ||= gestures.doubleTaps > 0;
        yaw += gestures.right[0] * this._mobileTurnSpeed * dt;
        pitch += gestures.right[1] * this._mobileTurnSpeed * dt;

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
                yaw += rightStick[0] * this._gamePadTurnSpeed * dt;
                pitch += rightStick[1] * this._gamePadTurnSpeed * dt;
            }
        }

        // camera orbit
        this._yaw -= yaw;
        this._pitch = math.clamp(this._pitch - (this.invertLookY ? -1 : 1) * pitch, this.pitchMin, this.pitchMax);

        move[0] = math.clamp(move[0], -1, 1);
        move[1] = math.clamp(move[1], -1, 1);
        look[1] = this._yaw;
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

        // the controller jumps on a press while grounded
        const jump = /** @type {boolean} */ (this._frame.input.jump);
        const jumped = jump && !this._prevJump && controller.state.grounded;
        this._prevJump = jump;

        const prev = this._prevPos.copy(this.entity.getPosition());
        controller.step(this._frame.capture(dt));
        if (jumped) {
            this.fire('jump');
        }

        // horizontal velocity from the step's displacement
        const charPos = this.entity.getPosition();
        const inv = dt > 0 ? 1 / Math.min(dt, MAX_STEP_DT) : 0;
        const vx = (charPos.x - prev.x) * inv;
        const vz = (charPos.z - prev.z) * inv;
        const horizSpeed = Math.sqrt(vx * vx + vz * vz);

        // character model yaw: smoothly turn toward horizontal velocity
        if (this.characterModel) {
            if (horizSpeed > this.walkSpeedThreshold * 0.5) {
                // movement direction in world space; convert to yaw, plus a
                // per-model offset so models with a different forward axis can
                // be aligned without rotating the mesh data.
                const targetYaw = Math.atan2(vx, vz) * math.RAD_TO_DEG + this.modelYawOffset;
                const a = damp(this.modelTurnSmoothing, dt);
                this._modelYaw = lerpAngle(this._modelYaw, targetYaw, a);
            }
            this.characterModel.setLocalEulerAngles(0, this._modelYaw, 0);
        }

        // animation speed bucket
        let bucket = 0;
        if (horizSpeed >= this.jogSpeedThreshold) {
            bucket = 2;
        } else if (horizSpeed >= this.walkSpeedThreshold) {
            bucket = 1;
        }
        if (bucket !== this._lastSpeedBucket) {
            this._lastSpeedBucket = bucket;
            this.fire('speed', bucket);
        }

        // ---- camera positioning ----

        // pivot = character + cameraHeight on Y; camera orbits this point
        const pivot = v.copy(charPos);
        pivot.y += this.cameraHeight;

        // smooth wheel zoom: lerp the actual cameraDistance toward the target
        const zoomA = damp(this.zoomDamping, dt);
        this.cameraDistance = math.lerp(this.cameraDistance, this._targetCameraDistance, zoomA);

        // desired camera offset from pivot using current yaw/pitch.
        // Negative pitch in the rotation so the convention is: positive pitch
        // raises the camera above the pivot looking down; negative pitch drops
        // the camera below the pivot looking up.
        const orbitQ = tmpQ.setFromEulerAngles(-this._pitch, this._yaw, 0);
        const back = orbitQ.transformVector(Vec3.BACK, v2);

        // wall collision: raycast from pivot to where the camera WOULD sit at
        // its full desired distance, then smoothly track the resulting clamped
        // distance so that the camera eases in/out behind walls rather than
        // snapping when geometry comes between the camera and the character.
        const probePos = v3.copy(pivot).add(v4.copy(back).mulScalar(this.cameraDistance));
        const hit = this.app.systems.rigidbody.raycastFirst(pivot, probePos, CAMERA_RAY_OPTIONS);
        let targetClamped = this.cameraDistance;
        if (hit) {
            const hitDist = v4.copy(hit.point).sub(pivot).length();
            const safeDist = Math.max(hitDist - this.cameraCollisionPadding, this.cameraMinDistance);
            targetClamped = Math.min(targetClamped, safeDist);
        }
        const collA = damp(this.cameraCollisionDamping, dt);
        this._clampedDistance = math.lerp(this._clampedDistance, targetClamped, collA);

        const finalPos = v3.copy(pivot).add(back.mulScalar(this._clampedDistance));

        // clamp the camera Y so it never drops below a configurable offset
        // relative to the character (prevents the orbit from putting the
        // camera lower than the character itself when the player pitches down).
        const minY = charPos.y + this.cameraMinHeightAboveCharacter;
        if (finalPos.y < minY) {
            finalPos.y = minY;
        }

        if (!this._camInitialized) {
            this._camPos.copy(finalPos);
            this._camLookAt.copy(pivot);
            this._camInitialized = true;
        } else {
            const posA = damp(this.cameraPositionDamping, dt);
            this._camPos.lerp(this._camPos, finalPos, posA);
            const lookA = damp(this.cameraLookAtDamping, dt);
            this._camLookAt.lerp(this._camLookAt, pivot, lookA);
        }

        this.camera.setPosition(this._camPos);
        this.camera.lookAt(this._camLookAt);

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

export { ThirdPersonController };

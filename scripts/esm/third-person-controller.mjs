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
 * @typedef {object} ThirdPersonControllerState
 * @property {Vec3} axis - The movement axis.
 * @property {number[]} mouse - The mouse delta.
 * @property {number} a - The 'A' button state.
 * @property {number} space - The space key state.
 * @property {number} shift - The shift key state.
 * @property {number} ctrl - The ctrl key state.
 */

const EPSILON = 0.0001;

// scratch
const v = new Vec3();
const v2 = new Vec3();
const v3 = new Vec3();
const v4 = new Vec3();
const forward = new Vec3();
const right = new Vec3();
const offset = new Vec3();
const tmpQ = new Quat();

const frame = new InputFrame({
    move: [0, 0, 0],
    rotate: [0, 0, 0],
    jump: [0]
});

/**
 * Calculate the damp rate.
 *
 * @param {number} damping - The damping factor (smaller = snappier).
 * @param {number} dt - The delta time.
 * @returns {number} - The lerp factor in 0..1.
 */
export const damp = (damping, dt) => 1 - Math.pow(damping, dt * 1000);

/**
 * @param {number[]} stick - The stick.
 * @param {number} low - The low dead zone.
 * @param {number} high - The high dead zone.
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
 * A reusable third-person character controller.
 *
 * The script is attached to a character controller entity (a dynamic rigidbody
 * with a capsule collision shape). It reads keyboard / mouse / touch / gamepad
 * input and:
 *
 * - Moves the character along the ground using a velocity-based capsule.
 * - Rotates an optional {@link characterModel} child entity to face the
 *   movement direction.
 * - Orbits a separate {@link camera} entity around the character at a
 *   configurable distance and elevation, with smooth follow and wall collision
 *   avoidance via raycast.
 * - Fires script events that consumers can use to drive animations:
 *   - `speed` (integer 0/1/2): idle / walk / jog buckets when the bucket changes
 *   - `jump`: fired once each time the character jumps
 */
class ThirdPersonController extends Script {
    static scriptName = 'thirdPersonController';

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
     * @type {ThirdPersonControllerState}
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
     * distance each frame). Initialised in `initialize()`.
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

        // expose ui events for mobile virtual joysticks
        this._mobileInput.on('joystick:position:left', ([bx, by, sx, sy]) => {
            this.app.fire(`${this.joystickEventName}:left`, bx, by, sx, sy);
        });
        this._mobileInput.on('joystick:position:right', ([bx, by, sx, sy]) => {
            this.app.fire(`${this.joystickEventName}:right`, bx, by, sx, sy);
        });

        // initial camera yaw from the camera entity, if it already faces character
        const camEuler = this.camera.getEulerAngles();
        this._yaw = camEuler.y;
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

        this._ready = true;
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
            this.fire('jump');
        }

        // camera orbit (mouse rotates camera around character; W/S becomes
        // forward/back along camera's flat yaw)
        this._yaw -= rotate[0];
        this._pitch -= (this.invertLookY ? -1 : 1) * rotate[1];
        this._pitch = math.clamp(this._pitch, this.pitchMin, this.pitchMax);

        // movement direction relative to camera yaw only
        tmpQ.setFromEulerAngles(0, this._yaw, 0);
        tmpQ.transformVector(Vec3.FORWARD, forward);
        tmpQ.transformVector(Vec3.RIGHT, right);
        offset.set(0, 0, 0);
        offset.add(forward.mulScalar(move[2]));
        offset.add(right.mulScalar(move[0]));

        const velocity = this._rigidbody.linearVelocity.add(offset);
        const alpha = damp(this._grounded ? this.velocityDampingGround : this.velocityDampingAir, dt);
        velocity.x = math.lerp(velocity.x, 0, alpha);
        velocity.z = math.lerp(velocity.z, 0, alpha);
        this._rigidbody.linearVelocity = velocity;

        // character model yaw: smoothly turn toward horizontal velocity
        const horizSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
        if (this.characterModel) {
            if (horizSpeed > this.walkSpeedThreshold * 0.5) {
                // movement direction in world space; convert to yaw, plus a
                // per-model offset so models with a different forward axis can
                // be aligned without rotating the mesh data.
                const targetYaw = Math.atan2(velocity.x, velocity.z) * math.RAD_TO_DEG + this.modelYawOffset;
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
        const charPos = this.entity.getPosition();

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
        const sys = /** @type {RigidBodyComponentSystem} */ (this._rigidbody.system);
        const probePos = v3.copy(pivot).add(v4.copy(back).mulScalar(this.cameraDistance));
        const hit = sys.raycastFirst(pivot, probePos);
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

        const { key, button, mouse, wheel } = this._desktopInput.read();
        const { leftInput, rightInput, doubleTap } = this._mobileInput.read();
        const { buttons, leftStick, rightStick } = this._gamepadInput.read();

        applyDeadZone(leftStick, this.gamePadDeadZoneLow, this.gamePadDeadZoneHigh);
        applyDeadZone(rightStick, this.gamePadDeadZoneLow, this.gamePadDeadZoneHigh);

        // mouse scroll wheel zoom (wheel[0] is deltaY: positive when scrolling
        // down -> zoom out; negative when scrolling up -> zoom in). The wheel
        // mutates a TARGET distance which the actual cameraDistance smoothly
        // lerps toward each frame in _updateController, giving a glide-zoom.
        if (wheel[0] !== 0) {
            this._targetCameraDistance = math.clamp(
                this._targetCameraDistance + wheel[0] * this.zoomSpeed,
                this.cameraDistanceMin,
                this.cameraDistanceMax
            );
        }

        // update state
        this._state.axis.add(v.set(
            (key[keyCode.D] - key[keyCode.A]) + (key[keyCode.RIGHT] - key[keyCode.LEFT]),
            0,
            (key[keyCode.W] - key[keyCode.S]) + (key[keyCode.UP] - key[keyCode.DOWN])
        ));
        for (let i = 0; i < this._state.mouse.length; i++) {
            this._state.mouse[i] += button[i];
        }
        this._state.a += buttons[buttonCode.A];
        this._state.space += key[keyCode.SPACE];
        this._state.shift += key[keyCode.SHIFT];
        this._state.ctrl += key[keyCode.CTRL];

        // grounded raycast (matches FPS controller convention)
        const start = this.entity.getPosition();
        const end = v.copy(start).add(Vec3.DOWN);
        end.y -= 0.1;
        const sys = /** @type {RigidBodyComponentSystem} */ (this._rigidbody.system);
        this._grounded = !!sys.raycastFirst(start, end);

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

        this._updateController(frame, dt);
    }

    destroy() {
        this._desktopInput.destroy();
        this._mobileInput.destroy();
        this._gamepadInput.destroy();
    }
}

export { ThirdPersonController };

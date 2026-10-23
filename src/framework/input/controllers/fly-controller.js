import { Vec3 } from '../../../core/math/vec3.js';
import { Quat } from '../../../core/math/quat.js';
import { GamePads } from '../../../platform/input/game-pads.js';
import { MOUSEBUTTON_LEFT, MOUSEBUTTON_MIDDLE, MOUSEBUTTON_RIGHT } from '../../../platform/input/constants.js';
import { Mouse } from '../../../platform/input/mouse.js';
import { Pose } from '../pose.js';
import { InputController, damp, num, stepDt } from './input-controller.js';

/**
 * @import { InputFrame, InputSnapshot } from '../../../platform/input/input-frame.js'
 * @import { Keyboard } from '../../../platform/input/keyboard.js'
 * @import { InputDevices } from './input-controller.js'
 */

const offset = new Vec3();
const angles = new Vec3();
const rotation = new Quat();

const leftStick = [0, 0];
const rightStick = [0, 0];

/**
 * @param {Keyboard} keyboard - The keyboard.
 * @param {string} code - The `KeyboardEvent.code`.
 * @returns {number} 1 while the key is held, otherwise 0.
 */
const key = (keyboard, code) => +keyboard.isPressed(code);

/**
 * The fly controller. Free flight: `look` and `lookRate` turn the pose about yaw and pitch,
 * limited by {@link yawRange} and {@link pitchRange}, and `move` translates it along its own
 * right, up and forward axes, so movement follows where the camera looks. The display pose
 * follows with {@link rotateDamping} and {@link moveDamping}.
 *
 * @category Input
 * @alpha
 */
class FlyController extends InputController {
    /**
     * The frame fields: `move` is a held right/up/forward axis in -1 to 1, `fast` and `slow` are
     * held speed modifiers, `look` is a pointer delta in pixels and `lookRate` a held stick
     * deflection in -1 to 1.
     *
     * @type {InputFrame['fields']}
     */
    static fields = {
        move: { type: 'vec3', kind: 'held' },
        fast: { type: 'bool', kind: 'held' },
        slow: { type: 'bool', kind: 'held' },
        look: { type: 'vec2', kind: 'delta' },
        lookRate: { type: 'vec2', kind: 'held' }
    };

    /**
     * @type {Pose}
     * @private
     */
    _targetPose = new Pose();

    /**
     * The move speed in units per second.
     */
    moveSpeed = 10;

    /**
     * The move speed in units per second while `fast` is held.
     */
    moveFastSpeed = 20;

    /**
     * The move speed in units per second while `slow` is held.
     */
    moveSlowSpeed = 5;

    /**
     * The rotation speed in degrees per pixel of `look`.
     */
    rotateSpeed = 0.2;

    /**
     * The `lookRate` sensitivity, relative to `look` at 60 frames per second.
     */
    rotateJoystickSens = 2;

    /**
     * The left touch drag sensitivity, in `move` units per pixel dragged in a frame. A drag only
     * moves on the frames the finger moves, and `move` is limited to 1, so a drag of 10 pixels or
     * more per frame moves at full speed. Default is 0.1.
     */
    touchMoveSens = 0.1;

    /**
     * The gamepad stick dead zone as `[low, high]`, see {@link GamePads.applyDeadZone}.
     *
     * @type {number[]}
     */
    gamepadDeadZone = [0.3, 0.6];

    /**
     * The rotation damping. In the range 0 to 1, where a value of 0 means no damping and 1 means
     * full damping. Default is 0.98.
     */
    rotateDamping = 0.98;

    /**
     * The movement damping. In the range 0 to 1, where a value of 0 means no damping and 1 means
     * full damping. Default is 0.98.
     */
    moveDamping = 0.98;

    set pitchRange(value) {
        this._targetPose.pitchRange.copy(value);
        this._pose.copy(this._targetPose.rotate(Vec3.ZERO));
    }

    get pitchRange() {
        return this._targetPose.pitchRange;
    }

    set yawRange(value) {
        this._targetPose.yawRange.copy(value);
        this._pose.copy(this._targetPose.rotate(Vec3.ZERO));
    }

    get yawRange() {
        return this._targetPose.yawRange;
    }

    /**
     * Sets the authoritative state.
     *
     * @type {{ position: number[], angles: number[] }}
     */
    set state(value) {
        this._targetPose.position.fromArray(value.position);
        this._targetPose.angles.fromArray(value.angles);
    }

    /**
     * Gets a copy of the authoritative state.
     *
     * @type {{ position: number[], angles: number[] }}
     */
    get state() {
        const { position: p, angles: a } = this._targetPose;
        return { position: [p.x, p.y, p.z], angles: [a.x, a.y, a.z] };
    }

    /**
     * @param {InputDevices} devices - The devices to read.
     * @param {InputFrame} frame - The frame built from {@link FlyController.fields}.
     */
    map({ keyboard, mouse, gestures, gamepads }, frame) {
        const { input } = frame;
        const move = /** @type {number[]} */ (input.move);
        const look = /** @type {number[]} */ (input.look);
        const lookRate = /** @type {number[]} */ (input.lookRate);

        move.fill(0);
        lookRate.fill(0);
        input.fast = false;
        input.slow = false;

        if (keyboard) {
            move[0] = key(keyboard, 'KeyD') - key(keyboard, 'KeyA') + key(keyboard, 'ArrowRight') - key(keyboard, 'ArrowLeft');
            move[1] = key(keyboard, 'KeyE') - key(keyboard, 'KeyQ');
            move[2] = key(keyboard, 'KeyW') - key(keyboard, 'KeyS') + key(keyboard, 'ArrowUp') - key(keyboard, 'ArrowDown');
            input.fast = keyboard.isPressed('ShiftLeft') || keyboard.isPressed('ShiftRight');
            input.slow = keyboard.isPressed('ControlLeft') || keyboard.isPressed('ControlRight');
        }

        // hover moves are ignored, as by a drag-to-look camera
        if (mouse && (mouse.isPressed(MOUSEBUTTON_LEFT) || mouse.isPressed(MOUSEBUTTON_MIDDLE) || mouse.isPressed(MOUSEBUTTON_RIGHT) || Mouse.isPointerLocked())) {
            look[0] += mouse.movement[0];
            look[1] += mouse.movement[1];
        }

        if (gestures) {
            const { leftJoystick, rightJoystick, left, right } = gestures;
            move[0] += leftJoystick.value.x + left[0] * this.touchMoveSens;
            move[2] -= leftJoystick.value.y + left[1] * this.touchMoveSens;
            lookRate[0] += rightJoystick.value.x;
            lookRate[1] += rightJoystick.value.y;
            look[0] += right[0];
            look[1] += right[1];
        }

        if (gamepads) {
            const [low, high] = this.gamepadDeadZone;
            for (const pad of gamepads.current) {
                if (pad.mapping !== 'standard') {
                    continue;
                }
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
                move[2] -= leftStick[1];
                lookRate[0] += rightStick[0];
                lookRate[1] += rightStick[1];
            }
        }

        for (let i = 0; i < 3; i++) {
            move[i] = Math.min(Math.max(move[i], -1), 1);
        }
    }

    /**
     * @param {InputSnapshot} snapshot - The snapshot.
     */
    step(snapshot) {
        const dt = stepDt(snapshot);
        const { move, look, lookRate, fast, slow } = /** @type {InputSnapshot['input']} */ (snapshot.input ?? {});

        // rotate
        const rate = this.rotateSpeed * this.rotateJoystickSens * 60 * dt;
        this._targetPose.rotate(angles.set(
            -(num(look?.[1]) * this.rotateSpeed + num(lookRate?.[1]) * rate),
            -(num(look?.[0]) * this.rotateSpeed + num(lookRate?.[0]) * rate),
            0
        ));

        // move along the target axes, -z being forward
        offset.set(num(move?.[0]), num(move?.[1]), -num(move?.[2]));
        if (offset.lengthSq() > 1) {
            offset.normalize();
        }
        const speed = fast ? this.moveFastSpeed : slow ? this.moveSlowSpeed : this.moveSpeed;
        rotation.setFromEulerAngles(this._targetPose.angles).transformVector(offset, offset);
        this._targetPose.move(offset.mulScalar(speed * dt));
    }

    /**
     * @param {Pose} pose - The initial pose of the controller.
     * @param {boolean} [smooth] - Whether to smooth the transition.
     */
    attach(pose, smooth = true) {
        this._targetPose.copy(pose);

        if (!smooth) {
            this._pose.copy(this._targetPose);
        }
    }

    detach() {
        this._targetPose.copy(this._pose);
    }

    /**
     * @param {number} dt - The delta time in seconds.
     * @returns {Pose} The display pose.
     */
    update(dt) {
        return this._pose.lerp(
            this._pose,
            this._targetPose,
            damp(this.moveDamping, dt),
            damp(this.rotateDamping, dt)
        );
    }
}

export { FlyController };

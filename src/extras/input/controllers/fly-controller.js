import { Vec3 } from '../../../core/math/vec3.js';
import { Quat } from '../../../core/math/quat.js';
import { InputController } from '../input.js';
import { Pose } from '../pose.js';

/** @import { InputFrame } from '../input.js'; */

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpQ1 = new Quat();

/**
 * Calculate the damp rate.
 *
 * @param {number} damping - The damping.
 * @param {number} dt - The delta time.
 * @returns {number} - The lerp rate.
 */
const damp = (damping, dt) => 1 - Math.pow(damping, dt * 1000);

/**
 * The fly controller.
 *
 * @category Input Controller
 * @alpha
 */
class FlyController extends InputController {
    /**
     * @type {Pose}
     * @private
     */
    _targetPose = new Pose();

    /**
     * The rotation damping. In the range 0 to 1, where a value of 0 means no damping and 1 means
     * full damping. Default is 0.98.
     *
     * @type {number}
     */
    rotateDamping = 0.98;

    /**
     * The movement damping. In the range 0 to 1, where a value of 0 means no damping and 1 means
     * full damping. Default is 0.98.
     *
     * @type {number}
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
     * @param {InputFrame<{ move: number[], rotate: number[] }>} frame - The input frame.
     * @param {number} dt - The delta time.
     * @returns {Pose} - The controller pose.
     */
    update(frame, dt) {
        const { move, rotate } = frame.read();

        // rotate
        this._targetPose.rotate(tmpV1.set(-rotate[1], -rotate[0], 0));

        // move
        const rotation = tmpQ1.setFromEulerAngles(this._pose.angles);
        const forward = rotation.transformVector(Vec3.FORWARD, new Vec3());
        const right = rotation.transformVector(Vec3.RIGHT, new Vec3());
        const up = rotation.transformVector(Vec3.UP, new Vec3());
        tmpV1.set(0, 0, 0);
        tmpV1.add(tmpV2.copy(forward).mulScalar(move[2]));
        tmpV1.add(tmpV2.copy(right).mulScalar(move[0]));
        tmpV1.add(tmpV2.copy(up).mulScalar(move[1]));
        tmpV1.mulScalar(dt);
        this._targetPose.move(tmpV1);

        // smoothing
        return this._pose.lerp(
            this._pose,
            this._targetPose,
            damp(this.moveDamping, dt),
            damp(this.rotateDamping, dt)
        );
    }

    destroy() {
        this.detach();
    }
}

export { FlyController };

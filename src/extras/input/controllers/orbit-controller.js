import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { InputController } from '../input.js';
import { damp } from '../math.js';
import { Pose } from '../pose.js';

/** @import { InputFrame } from '../input.js'; */

const dir = new Vec3();
const offset = new Vec3();
const angles = new Vec3();

const rotation = new Quat();

/**
 * The orbit controller.
 *
 * @category Input Controller
 * @alpha
 */
class OrbitController extends InputController {
    /**
     * @type {Pose}
     * @private
     */
    _targetRootPose = new Pose();

    /**
     * @type {Pose}
     * @private
     */
    _rootPose = new Pose();

    /**
     * @type {Pose}
     * @private
     */
    _targetChildPose = new Pose();

    /**
     * @type {Pose}
     * @private
     */
    _childPose = new Pose();

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

    /**
     * The zoom damping. A higher value means more damping. A value of 0 means no damping.
     *
     * @type {number}
     */
    zoomDamping = 0.98;

    set pitchRange(range) {
        this._targetRootPose.pitchRange.copy(range);
        this._rootPose.copy(this._targetRootPose.rotate(Vec3.ZERO));
    }

    get pitchRange() {
        return this._targetRootPose.pitchRange;
    }

    set yawRange(range) {
        this._targetRootPose.yawRange.copy(range);
        this._rootPose.copy(this._targetRootPose.rotate(Vec3.ZERO));
    }

    get yawRange() {
        return this._targetRootPose.yawRange;
    }

    set zoomRange(range) {
        this._targetChildPose.zRange.copy(range);
        this._childPose.copy(this._targetChildPose.move(Vec3.ZERO));
    }

    get zoomRange() {
        return this._targetRootPose.zRange;
    }

    /**
     * @param {Pose} pose - The initial pose of the controller.
     * @param {boolean} [smooth] - Whether to smooth the transition.
     */
    attach(pose, smooth = true) {
        this._targetRootPose.set(pose.getFocus(dir), pose.angles, 0);
        this._targetChildPose.position.set(0, 0, pose.distance);

        if (!smooth) {
            this._rootPose.copy(this._targetRootPose);
            this._childPose.copy(this._targetChildPose);
        }
    }

    detach() {
        this._targetRootPose.copy(this._rootPose);
        this._targetChildPose.copy(this._childPose);
    }

    /**
     * @param {InputFrame<{ move: number[], rotate: number[] }>} frame - The input frame.
     * @param {number} dt - The delta time.
     * @returns {Pose} - The controller pose.
     */
    update(frame, dt) {
        const { move, rotate } = frame.read();

        // move
        offset.set(move[0], move[1], 0);
        rotation.setFromEulerAngles(this._rootPose.angles).transformVector(offset, offset);
        this._targetRootPose.move(offset);
        this._targetChildPose.move(offset.set(0, 0, move[2]));

        // rotate
        this._targetRootPose.rotate(angles.set(-rotate[1], -rotate[0], 0));

        // smoothing
        this._rootPose.lerp(
            this._rootPose,
            this._targetRootPose,
            damp(this.moveDamping, dt),
            damp(this.rotateDamping, dt),
            1
        );
        this._childPose.lerp(
            this._childPose,
            this._targetChildPose,
            damp(this.zoomDamping, dt),
            1,
            1
        );

        // calculate final pose
        rotation.setFromEulerAngles(this._rootPose.angles)
        .transformVector(this._childPose.position, offset)
        .add(this._rootPose.position);
        return this._pose.set(offset, this._rootPose.angles, this._childPose.position.length());
    }

    destroy() {
        this.detach();
    }
}

export { OrbitController };

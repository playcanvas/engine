import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { InputController } from '../input.js';
import { damp } from '../math.js';
import { Pose } from '../pose.js';

/** @import { InputFrame } from '../input.js'; */

const EPSILON = 0.001;

const dir = new Vec3();
const position = new Vec3();

const rotation = new Quat();

/**
 * The focus controller.
 *
 * @category Input Controller
 * @alpha
 */
class FocusController extends InputController {
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
     * The focus damping. In the range 0 to 1, where a value of 0 means no damping and 1 means
     * full damping. Default is 0.98.
     *
     * @type {number}
     */
    focusDamping = 0.98;

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

    complete() {
        return this._targetRootPose.equalsApprox(this._rootPose, EPSILON) &&
               this._targetChildPose.equalsApprox(this._childPose, EPSILON);
    }

    /**
     * @param {InputFrame<{ move: number[], rotate: number[] }>} frame - The input frame.
     * @param {number} dt - The delta time.
     * @returns {Pose} - The controller pose.
     */
    update(frame, dt) {
        // discard frame as inputs not used
        frame.read();

        // smoothing
        this._rootPose.lerp(
            this._rootPose,
            this._targetRootPose,
            damp(this.focusDamping, dt),
            damp(this.focusDamping, dt),
            1
        );
        this._childPose.lerp(
            this._childPose,
            this._targetChildPose,
            damp(this.focusDamping, dt),
            1,
            1
        );

        // calculate final pose
        rotation.setFromEulerAngles(this._rootPose.angles)
        .transformVector(this._childPose.position, position)
        .add(this._rootPose.position);
        return this._pose.set(position, this._rootPose.angles, this._childPose.position.length());
    }

    destroy() {
        this.detach();
    }
}

export { FocusController };

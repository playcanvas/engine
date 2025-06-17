import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { InputController } from '../input.js';
import { Pose } from '../pose.js';

/** @import { InputFrame } from '../input.js'; */

const tmpV1 = new Vec3();
const tmpQ1 = new Quat();

const EPSILON = 0.001;

/**
 * Calculate the damp rate.
 *
 * @param {number} damping - The damping.
 * @param {number} dt - The delta time.
 * @returns {number} - The lerp rate.
 */
const damp = (damping, dt) => 1 - Math.pow(damping, dt * 1000);

/**
 * The orbit controller.
 *
 * @category Input Controller
 * @alpha
 */
class OrbitController extends InputController {
    /**
     * @type {boolean}
     * @private
     */
    _focusing = false;

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

    get focus() {
        return this._rootPose.position;
    }

    get zoom() {
        return this._childPose.position.length();
    }

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
     * @param {Vec3} position - The controller position.
     * @param {Vec3} focus - The focus point.
     * @param {boolean} [smooth] - Whether to smooth the transition.
     */
    attach(position, focus, smooth = true) {
        this._targetRootPose.look(position, focus);
        this._targetRootPose.position.copy(focus);
        this._targetChildPose.position.set(0, 0, focus.distance(position));

        if (smooth) {
            this._focusing = true;
        } else {
            this._rootPose.copy(this._targetRootPose);
            this._childPose.copy(this._targetChildPose);
        }
    }

    detach() {
        this._targetRootPose.copy(this._rootPose);
        this._targetChildPose.copy(this._childPose);
        this._focusing = false;
    }

    /**
     * @param {InputFrame<{ move: number[], rotate: number[] }>} frame - The input frame.
     * @param {number} dt - The delta time.
     * @returns {Pose} - The controller pose.
     */
    update(frame, dt) {
        const { move, rotate } = frame.read();

        // check focus interrupt
        if (this._focusing) {
            const moveLen = Math.sqrt(move[0] * move[0] + move[1] * move[1]);
            const rotateLen = Math.sqrt(rotate[0] * rotate[0] + rotate[1] * rotate[1]);
            const zoomLen = Math.abs(move[2]);
            if (moveLen + rotateLen + zoomLen > 0) {
                this._targetRootPose.copy(this._rootPose);
                this._targetChildPose.copy(this._childPose);
                this._focusing = false;
            }
        }

        // move
        tmpV1.set(move[0], move[1], 0);
        const rotation = tmpQ1.setFromEulerAngles(this._rootPose.angles);
        rotation.transformVector(tmpV1, tmpV1);
        this._targetRootPose.move(tmpV1);
        this._targetChildPose.move(tmpV1.set(0, 0, move[2]));

        // rotate
        this._targetRootPose.rotate(tmpV1.set(-rotate[1], -rotate[0], 0));

        // smoothing
        this._rootPose.lerp(
            this._rootPose,
            this._targetRootPose,
            damp(this._focusing ? this.focusDamping : this.moveDamping, dt),
            damp(this._focusing ? this.focusDamping : this.rotateDamping, dt)
        );
        this._childPose.lerp(
            this._childPose,
            this._targetChildPose,
            damp(this._focusing ? this.focusDamping : this.zoomDamping, dt),
            1
        );

        // check focus ended
        if (this._focusing) {
            const rootDelta = this._rootPose.position.distance(this._targetRootPose.position) +
                this._rootPose.angles.distance(this._targetRootPose.angles);
            const childDelta = this._childPose.position.distance(this._targetChildPose.position) +
                this._childPose.angles.distance(this._targetChildPose.angles);
            if (rootDelta + childDelta < EPSILON) {
                this._focusing = false;
            }
        }

        // calculate final pose
        return this._pose.mul2(this._rootPose, this._childPose);
    }

    destroy() {
        this.detach();
    }
}

export { OrbitController };

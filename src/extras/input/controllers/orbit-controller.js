import { Vec3 } from '../../../core/math/vec3.js';
import { Ray } from '../../../core/shape/ray.js';
import { Plane } from '../../../core/shape/plane.js';
import { InputController } from '../input.js';
import { Pose } from '../pose.js';

/** @import { CameraComponent } from '../../../framework/components/camera/component.js' */
/** @import { InputDelta } from '../input.js'; */

const tmpV1 = new Vec3();
const tmpR1 = new Ray();
const tmpP1 = new Plane();
const tmpO1 = new Pose();

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
     * @type {CameraComponent | undefined}
     */
    camera;

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
        this._targetRootPose.rotate(Vec3.ZERO);
        this._rootPose.copy(this._targetRootPose);
    }

    get pitchRange() {
        return this._targetRootPose.pitchRange;
    }

    set yawRange(range) {
        this._targetRootPose.yawRange.copy(range);
        this._targetRootPose.rotate(Vec3.ZERO);
        this._rootPose.copy(this._targetRootPose);
    }

    get yawRange() {
        return this._targetRootPose.yawRange;
    }

    set zoomRange(range) {
        this._targetChildPose.zRange.copy(range);
        this._targetChildPose.move(Vec3.ZERO);
        this._childPose.copy(this._targetChildPose);
    }

    get zoomRange() {
        return this._targetRootPose.zRange;
    }

    /**
     * @param {InputDelta} rotate - The rotation input delta.
     * @param {Vec3} out - The output target pose.
     * @returns {Vec3} - The updated target pose.
     * @private
     */
    _pan(rotate, out) {
        if (!this.camera) {
            return out.set(0, 0, 0);
        }

        const v1 = new Vec3();
        const v2 = new Vec3();

        const position = tmpO1.mul2(this._rootPose, this._childPose).position;
        const focus = this.focus;

        const normal = out.sub2(position, focus).normalize();
        const plane = tmpP1.setFromPointNormal(focus, normal);

        const mouseStart = this.camera.screenToWorld(0, 0, 1);
        const mouseEnd = this.camera.screenToWorld(rotate.value[0], rotate.value[1], 1);

        plane.intersectsRay(tmpR1.set(position, mouseStart.sub(position).normalize()), v1);
        plane.intersectsRay(tmpR1.set(position, mouseEnd.sub(position).normalize()), v2);

        return out.sub2(v1, v2);
    }

    /**
     * @param {Vec3} position - The controller position.
     * @param {Vec3} focus - The focus point.
     * @param {boolean} [smooth] - Whether to smooth the transition.
     */
    reset(position, focus, smooth = true) {
        this._targetRootPose.position.copy(focus);
        this._targetRootPose.look(tmpV1.sub2(focus, position).normalize());
        this._targetChildPose.position.set(0, 0, focus.distance(position));

        if (smooth) {
            this._focusing = true;
        } else {
            this._rootPose.copy(this._targetRootPose);
            this._childPose.copy(this._targetChildPose);
        }
    }

    /**
     * @param {Vec3} position - The controller position.
     * @param {Vec3} focus - The focus point
     */
    attach(position, focus) {
        this.reset(focus, position, false);
    }

    detach() {
        this._targetRootPose.copy(this._rootPose);
        this._targetChildPose.copy(this._childPose);
        this._focusing = false;
    }

    /**
     * @param {object} frame - The input frame.
     * @param {InputDelta} frame.move - The move input delta.
     * @param {InputDelta} frame.rotate - The rotate input delta.
     * @param {InputDelta} frame.pan - The pan input delta.
     * @param {number} dt - The delta time.
     * @returns {Pose} - The controller pose.
     */
    update(frame, dt) {
        const { move, rotate, pan } = frame;

        // check focus interrupt
        if (this._focusing) {
            const moveLen = Math.sqrt(move.value[0] * move.value[0] + move.value[1] * move.value[1]);
            const rotateLen = Math.sqrt(rotate.value[0] * rotate.value[0] + rotate.value[1] * rotate.value[1]);
            const zoomLen = Math.abs(move.value[2]);
            if (moveLen + rotateLen + zoomLen > 0) {
                this._targetRootPose.copy(this._rootPose);
                this._targetChildPose.copy(this._childPose);
                this._focusing = false;
            }
        }

        // rotate / move
        if (pan.value[0]) {
            this._targetRootPose.move(this._pan(rotate, tmpV1));
        } else {
            this._targetRootPose.rotate(tmpV1.set(-rotate.value[1], -rotate.value[0], 0));
        }

        // zoom
        this._targetChildPose.move(tmpV1.set(0, 0, move.value[2]));

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
            const rootDelta = this._rootPose.distance(this._targetRootPose);
            const childDelta = this._childPose.distance(this._targetChildPose);
            if (rootDelta < EPSILON && childDelta < EPSILON) {
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

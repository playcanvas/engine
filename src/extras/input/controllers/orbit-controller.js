import { Vec3 } from '../../../core/math/vec3.js';
import { Quat } from '../../../core/math/quat.js';
import { Ray } from '../../../core/shape/ray.js';
import { Plane } from '../../../core/shape/plane.js';
import { InputController } from '../input.js';
import { Pose } from '../pose.js';

/** @import { CameraComponent } from '../../../framework/components/camera/component.js' */
/** @import { InputDelta } from '../input.js'; */

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpQ1 = new Quat();
const tmpR1 = new Ray();
const tmpP1 = new Plane();

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
    _targetPose = new Pose();

    /**
     * @type {Pose}
     * @private
     */
    _rootPose = new Pose();

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

    get focusPoint() {
        return this._rootPose.position;
    }

    get zoom() {
        return this._rootPose.distance;
    }

    set pitchRange(range) {
        this._targetPose.pitchRange.copy(range);
        this._targetPose.rotate(Vec3.ZERO);
        this._rootPose.copy(this._targetPose);
    }

    get pitchRange() {
        return this._targetPose.pitchRange;
    }

    set yawRange(range) {
        this._targetPose.yawRange.copy(range);
        this._targetPose.rotate(Vec3.ZERO);
        this._rootPose.copy(this._targetPose);
    }

    get yawRange() {
        return this._targetPose.yawRange;
    }

    set zoomRange(range) {
        this._targetPose.zoomRange.copy(range);
        this._targetPose.zoom(0);
        this._rootPose.distance = this._targetPose.distance;
    }

    get zoomRange() {
        return this._targetPose.zoomRange;
    }

    /**
     * @param {Vec3} out - The output vector to store the position.
     * @returns {Vec3} - The current position based on the root pose and zoom distance.
     * @private
     */
    _getPosition(out) {
        return tmpQ1.setFromEulerAngles(this._rootPose.angles)
        .transformVector(tmpV1.set(0, 0, this._rootPose.distance), out)
        .add(this._rootPose.position);
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

        const position = this._getPosition(tmpV2);
        const focus = this.focusPoint;

        const normal = out.sub2(position, focus).normalize();
        const plane = tmpP1.setFromPointNormal(focus, normal);

        const mouseStart = this.camera.screenToWorld(0, 0, 1);
        const mouseEnd = this.camera.screenToWorld(rotate.value[0], rotate.value[1], 1);

        plane.intersectsRay(tmpR1.set(position, mouseStart.sub(position).normalize()), v1);
        plane.intersectsRay(tmpR1.set(position, mouseEnd.sub(position).normalize()), v2);

        return out.sub2(v1, v2);
    }

    /**
     * @param {Vec3} point - The focus point.
     * @param {Vec3} [start] - The start point.
     * @param {boolean} [smooth] - Whether to smooth the transition.
     */
    focus(point, start, smooth = true) {
        this._targetPose.position.copy(point);

        if (start) {
            const offset = tmpV1.sub2(point, start);
            this._targetPose.distance = offset.length();
            this._targetPose.look(offset.normalize());
        }

        if (smooth) {
            this._focusing = true;
        } else {
            this._rootPose.copy(this._targetPose);
            this._rootPose.distance = this._targetPose.distance;
        }
    }

    /**
     * @param {Pose} pose - The pose to attach to.
     */
    attach(pose) {
        this.focus(Vec3.ZERO, pose.position, false);
    }

    detach() {
        this._targetPose.copy(this._rootPose);
        this._targetPose.distance = this._rootPose.distance;
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
            if (moveLen + rotateLen > 0) {
                this._targetPose.copy(this._rootPose);
                this._targetPose.distance = this._rootPose.distance;
                this._focusing = false;
            }
        }

        // rotate / move
        if (pan.value[0]) {
            this._targetPose.move(this._pan(rotate, tmpV1));
        } else {
            this._targetPose.rotate(tmpV1.set(-rotate.value[1], -rotate.value[0], 0));
        }

        // zoom
        this._targetPose.zoom(move.value[2]);

        // smoothing
        this._rootPose.lerp(
            this._rootPose,
            this._targetPose,
            damp(this._focusing ? this.focusDamping : this.moveDamping, dt),
            damp(this._focusing ? this.focusDamping : this.rotateDamping, dt),
            damp(this._focusing ? this.focusDamping : this.zoomDamping, dt)
        );

        // check focus ended
        if (this._focusing) {
            const moveDelta = this._rootPose.position.distance(this._targetPose.position);
            const rotateDelta = this._rootPose.angles.distance(this._targetPose.angles);
            const zoomDelta = Math.abs(this._rootPose.distance - this._targetPose.distance);
            if (moveDelta + rotateDelta + zoomDelta < EPSILON) {
                this._focusing = false;
            }
        }

        // calculate final pose
        return this._pose.set(this._getPosition(tmpV1), this._rootPose.angles, 0);
    }

    destroy() {
        this.detach();
    }
}

export { OrbitController };

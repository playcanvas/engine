import { Vec2 } from '../../../core/math/vec2.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Quat } from '../../../core/math/quat.js';
import { math } from '../../../core/math/math.js';
import { Ray } from '../../../core/shape/ray.js';
import { Plane } from '../../../core/shape/plane.js';
import { InputController } from '../input.js';
import { Pose } from '../pose.js';

/** @import { CameraComponent } from '../../../framework/components/camera/component.js' */
/** @import { InputDelta } from '../input.js'; */

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpVa = new Vec2();
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
     * @private
     * @type {number}
     */
    _targetZoomDist = 0;

    /**
     * @type {number}
     * @private
     */
    _zoomDist = 0;

    /**
     * @type {Vec2}
     * @private
     */
    _zoomRange = new Vec2(0, Infinity);

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

    /**
     * @type {Vec3}
     * @private
     */
    get _position() {
        return tmpQ1.setFromEulerAngles(this._rootPose.angles)
        .transformVector(tmpV1.set(0, 0, this._zoomDist), tmpV2)
        .add(this._rootPose.position);
    }

    get focusPoint() {
        return this._rootPose.position;
    }

    get zoom() {
        return this._zoomDist;
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
        this._zoomRange.copy(range);
        this._zoomDist = this._zoom(0);
    }

    get zoomRange() {
        return this._zoomRange;
    }

    /**
     * @param {number} val - The zoom value to add.
     * @returns {number} - The new zoom distance.
     * @private
     */
    _zoom(val) {
        this._targetZoomDist += val;
        this._targetZoomDist = math.clamp(this._targetZoomDist, this._zoomRange.x, this._zoomRange.y);
        return this._targetZoomDist;
    }

    /**
     * @param {CameraComponent} camera - The camera.
     * @param {Vec2} pos - The screen position.
     * @param {Vec3} out - The output point.
     * @returns {Vec3} - The world point.
     * @private
     */
    _screenToWorldPan(camera, pos, out) {
        const mouseW = camera.screenToWorld(pos.x, pos.y, 1);
        const position = this._position;
        const focus = this.focusPoint;

        const normal = tmpV1.sub2(position, focus).normalize();
        const plane = tmpP1.setFromPointNormal(focus, normal);
        const ray = tmpR1.set(position, mouseW.sub(position).normalize());

        plane.intersectsRay(ray, out);

        return out;
    }

    /**
     * @param {Vec3} point - The focus point.
     * @param {Vec3} [start] - The start point.
     * @param {boolean} [smooth] - Whether to smooth the transition.
     */
    focus(point, start, smooth = true) {
        this._targetPose.position.copy(point);

        if (start) {
            tmpV1.sub2(start, point);
            const elev = Math.atan2(tmpV1.y, Math.sqrt(tmpV1.x * tmpV1.x + tmpV1.z * tmpV1.z)) * math.RAD_TO_DEG;
            const azim = Math.atan2(tmpV1.x, tmpV1.z) * math.RAD_TO_DEG;
            this._targetPose.angles.set(-elev, azim, 0);

            this._targetZoomDist = tmpV1.sub2(start, point).length();
        }

        if (smooth) {
            this._focusing = true;
        } else {
            this._rootPose.copy(this._targetPose);
            this._zoomDist = this._targetZoomDist;
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
        this._targetZoomDist = this._zoomDist;
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
            const length = Math.sqrt(rotate[0] * rotate[0] + rotate[1] * rotate[1]);
            const inputDelta = length + Math.abs(move[2]);
            if (inputDelta > 0) {
                this._targetPose.copy(this._rootPose);
                this._targetZoomDist = this._zoomDist;
                this._focusing = false;
            }
        }

        if (pan.value[0]) {
            // pan
            if (this.camera) {
                const start = this._screenToWorldPan(this.camera, Vec2.ZERO, new Vec3());
                const end = this._screenToWorldPan(this.camera, tmpVa.fromArray(rotate.value), new Vec3());
                tmpV1.sub2(start, end);
                this._targetPose.position.add(tmpV1);
            }
        } else {
            // look
            this._targetPose.rotate(tmpV1.set(-rotate.value[1], -rotate.value[0], 0));
        }

        // zoom
        this._zoom(move.value[2]);

        // smoothing
        this._rootPose.lerp(
            this._rootPose,
            this._targetPose,
            damp(this._focusing ? this.focusDamping : this.moveDamping, dt),
            damp(this._focusing ? this.focusDamping : this.rotateDamping, dt)
        );
        this._zoomDist = math.lerp(
            this._zoomDist,
            this._targetZoomDist,
            damp(this._focusing ? this.focusDamping : this.zoomDamping, dt)
        );

        // check focus ended
        if (this._focusing) {
            const focusDelta = this._rootPose.position.distance(this._targetPose.position) +
                this._rootPose.angles.distance(this._targetPose.angles) +
                Math.abs(this._zoomDist - this._targetZoomDist);
            if (focusDelta < EPSILON) {
                this._focusing = false;
            }
        }

        // calculate final pose
        return this._pose.set(this._position, this._rootPose.angles);
    }

    destroy() {
        this.detach();
    }
}

export { OrbitController };

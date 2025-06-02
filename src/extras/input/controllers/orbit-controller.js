import { Vec2 } from '../../../core/math/vec2.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Quat } from '../../../core/math/quat.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { math } from '../../../core/math/math.js';
import { Ray } from '../../../core/shape/ray.js';
import { Plane } from '../../../core/shape/plane.js';
import { InputController } from '../input.js';

/** @import { CameraComponent } from '../../../framework/components/camera/component.js' */
/** @import { InputDelta } from '../input.js'; */

const tmpV1 = new Vec3();
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
     * @type {Vec3}
     * @private
     */
    _targetPosition = new Vec3();

    /**
     * @type {Vec3}
     * @private
     */
    _position = new Vec3();

    /**
     * @type {Vec3}
     * @private
     */
    _targetAngles = new Vec3();

    /**
     * @type {Vec3}
     * @private
     */
    _angles = new Vec3();

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
     * @type {Mat4}
     * @private
     */
    _orbitTransform = new Mat4();

    /**
     * @type {Mat4}
     * @private
     */
    _rootTransform = new Mat4();

    /**
     * @type {Vec2}
     * @private
     */
    _pitchRange = new Vec2(-Infinity, Infinity);

    /**
     * @type {Vec2}
     * @private
     */
    _yawRange = new Vec2(-Infinity, Infinity);

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

    get point() {
        return this._rootTransform.getTranslation();
    }

    get view() {
        return this._transform.getTranslation();
    }

    get zoom() {
        return this._zoomDist;
    }

    set pitchRange(range) {
        this._pitchRange.copy(range);
        this._clampAngles();
        this._smoothTransform(-1);
    }

    get pitchRange() {
        return this._pitchRange;
    }

    set yawRange(range) {
        this._yawRange.copy(range);
        this._clampAngles();
        this._smoothTransform(-1);
    }

    get yawRange() {
        return this._yawRange;
    }

    set zoomRange(range) {
        this._zoomRange.copy(range);
        this._clampZoom();
        this._smoothZoom(-1);
    }

    get zoomRange() {
        return this._zoomRange;
    }

    /**
     * @private
     */
    _clampAngles() {
        this._targetAngles.x = math.clamp(this._targetAngles.x, this._pitchRange.x, this._pitchRange.y);
        this._targetAngles.y = math.clamp(this._targetAngles.y, this._yawRange.x, this._yawRange.y);
    }

    /**
     * @private
     */
    _clampZoom() {
        this._targetZoomDist = math.clamp(this._targetZoomDist, this._zoomRange.x, this._zoomRange.y);
    }

    /**
     * @param {number[]} dv - The delta vector.
     * @private
     */
    _look(dv) {
        this._targetAngles.x -= dv[1];
        this._targetAngles.y -= dv[0];
        this._targetAngles.x %= 360;
        this._targetAngles.y %= 360;
        this._clampAngles();
    }

    /**
     * @param {number[]} dv - The delta vector.
     * @private
     */
    _pan(dv) {
        if (!this.camera) {
            return;
        }
        const start = this._screenToWorldPan(this.camera, Vec2.ZERO, new Vec3());
        const end = this._screenToWorldPan(this.camera, tmpVa.fromArray(dv), new Vec3());
        tmpV1.sub2(start, end);

        this._targetPosition.add(tmpV1);
    }

    /**
     * @param {number[]} dv - The delta value.
     * @private
     */
    _zoom(dv) {
        this._targetZoomDist += dv[0];
        this._clampZoom();
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
        const view = this.view;
        const point = this.point;

        const normal = tmpV1.sub2(view, point).normalize();
        const plane = tmpP1.setFromPointNormal(point, normal);
        const ray = tmpR1.set(view, mouseW.sub(view).normalize());

        plane.intersectsRay(ray, out);

        return out;
    }

    /**
     * @param {number} dt - The delta time.
     * @private
     */
    _smoothTransform(dt) {
        const ar = dt === -1 ? 1 : damp(this._focusing ? this.focusDamping : this.rotateDamping, dt);
        const am = dt === -1 ? 1 : damp(this._focusing ? this.focusDamping : this.moveDamping, dt);

        this._angles.x = math.lerpAngle(this._angles.x, this._targetAngles.x, ar) % 360;
        this._angles.y = math.lerpAngle(this._angles.y, this._targetAngles.y, ar) % 360;
        this._position.lerp(this._position, this._targetPosition, am);
        this._rootTransform.setTRS(this._position, tmpQ1.setFromEulerAngles(this._angles), Vec3.ONE);
    }

    /**
     * @private
     */
    _cancelSmoothTransform() {
        this._targetPosition.copy(this._position);
        this._targetAngles.copy(this._angles);
    }

    /**
     * @param {number} dt - The delta time.
     * @private
     */
    _smoothZoom(dt) {
        const a = dt === -1 ? 1 : damp(this._focusing ? this.focusDamping : this.zoomDamping, dt);
        this._zoomDist = math.lerp(this._zoomDist, this._targetZoomDist, a);
        this._orbitTransform.setTranslate(0, 0, this._zoomDist);
    }

    /**
     * @private
     */
    _cancelSmoothZoom() {
        this._targetZoomDist = this._zoomDist;
    }

    /**
     * @private
     */
    _checkEndFocus() {
        if (!this._focusing) {
            return;
        }
        const focusDelta = this._position.distance(this._targetPosition) +
            this._angles.distance(this._targetAngles) +
            Math.abs(this._zoomDist - this._targetZoomDist);
        if (focusDelta < EPSILON) {
            this._focusing = false;
        }
    }

    /**
     * @param {number[]} dv - The drag deltas.
     * @param {number[]} dw - The zoom delta.
     * @private
     */
    _checkCancelFocus(dv, dw) {
        if (!this._focusing) {
            return;
        }
        const length = dv[0] * dv[0] + dv[1] * dv[1];
        const inputDelta = length + Math.abs(dw[0]);
        if (inputDelta > 0) {
            this._cancelSmoothTransform();
            this._cancelSmoothZoom();
            this._focusing = false;
        }
    }

    /**
     * @param {Vec3} point - The focus point.
     * @param {Vec3} [start] - The start point.
     * @param {boolean} [smooth] - Whether to smooth the transition.
     */
    focus(point, start, smooth = true) {
        this._targetPosition.copy(point);

        if (start) {
            tmpV1.sub2(start, point);
            const elev = Math.atan2(tmpV1.y, Math.sqrt(tmpV1.x * tmpV1.x + tmpV1.z * tmpV1.z)) * math.RAD_TO_DEG;
            const azim = Math.atan2(tmpV1.x, tmpV1.z) * math.RAD_TO_DEG;
            this._targetAngles.set(-elev, azim, 0);

            this._targetZoomDist = tmpV1.length();
        }

        if (smooth) {
            this._focusing = true;
        } else {
            this._position.copy(this._targetPosition);
            this._angles.copy(this._targetAngles);
            this._zoomDist = this._targetZoomDist;

            this._smoothZoom(-1);
            this._smoothTransform(-1);
        }
    }

    /**
     * @param {Mat4} transform - The transform.
     */
    attach(transform) {
        this.focus(Vec3.ZERO, transform.getTranslation(), false);
    }

    detach() {
        this._cancelSmoothTransform();
        this._cancelSmoothZoom();
        this._focusing = false;
    }

    /**
     * @param {object} frame - The input frame.
     * @param {InputDelta} frame.drag - The drag input delta.
     * @param {InputDelta} frame.zoom - The zoom input delta.
     * @param {InputDelta} frame.pan - The pan input delta.
     * @param {number} dt - The delta time.
     * @returns {Mat4} - The camera transform.
     */
    update(frame, dt) {
        const { drag, zoom, pan } = frame;

        this._checkCancelFocus(drag.value, zoom.value);

        if (pan.value[0]) {
            this._pan(drag.value);
        } else {
            this._look(drag.value);
        }
        this._zoom(zoom.value);

        this._smoothTransform(dt);
        this._smoothZoom(dt);

        this._checkEndFocus();

        return this._transform.mul2(this._rootTransform, this._orbitTransform);
    }

    destroy() {
        this.detach();
    }
}

export { OrbitController };

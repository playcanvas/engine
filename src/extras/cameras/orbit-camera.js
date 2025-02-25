import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';
import { Mat4 } from '../../core/math/mat4.js';
import { math } from '../../core/math/math.js';
import { Ray } from '../../core/shape/ray.js';
import { Plane } from '../../core/shape/plane.js';
import { EventHandler } from '../../core/event-handler.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 */

/**
 * @typedef {object} OrbitInputFrame
 * @property {number[]} move - The move deltas.
 * @property {number[]} rotate - The rotate deltas.
 * @property {number[]} pointer - The pointer deltas.
 * @property {number[]} zoom - The zoom deltas.
 */

const tmpVa = new Vec2();
const tmpVb = new Vec2();
const tmpV1 = new Vec3();
const tmpQ1 = new Quat();
const tmpR1 = new Ray();
const tmpP1 = new Plane();

/**
 * Calculate the lerp rate.
 *
 * @param {number} damping - The damping.
 * @param {number} dt - The delta time.
 * @returns {number} - The lerp rate.
 */
const lerpRate = (damping, dt) => 1 - Math.pow(damping, dt * 1000);

class OrbitCamera extends EventHandler {
    /**
     * @private
     * @type {Vec3}
     */
    _targetPosition = new Vec3();

    /**
     * @private
     * @type {Vec3}
     */
    _position = new Vec3();

    /**
     * @private
     * @type {Vec3}
     */
    _targetAngles = new Vec3();

    /**
     * @private
     * @type {Vec3}
     */
    _angles = new Vec3();

    /**
     * @type {number}
     * @private
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
     * @type {Mat4}
     * @private
     */
    _transform = new Mat4();

    /**
     * The rotation speed.
     *
     * @type {number}
     */
    rotateSpeed = 0.2;

    /**
     * The rotation damping. A higher value means more damping. A value of 0 means no damping.
     *
     * @type {number}
     */
    rotateDamping = 0.98;

    /**
     * The movement damping. A higher value means more damping. A value of 0 means no damping.
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
     * The zoom speed relative to the scene size.
     *
     * @type {number}
     */
    zoomSpeed = 0.01;

    get point() {
        return this._rootTransform.getTranslation();
    }

    get view() {
        return this._transform.getTranslation();
    }

    /**
     * @param {number} dx - The dx value.
     * @param {number} dy - The dy value.
     * @private
     */
    _look(dx, dy) {
        this._targetAngles.x -= (dy || 0) * this.rotateSpeed;
        this._targetAngles.y -= (dx || 0) * this.rotateSpeed;
    }

    /**
     * @param {CameraComponent} camera - The camera.
     * @param {number} x - The x value.
     * @param {number} y - The y value.
     * @param {number} dx - The dx value.
     * @param {number} dy - The dy value.
     * @private
     */
    _pan(camera, x, y, dx, dy) {
        const start = this._screenToWorldPan(camera, tmpVa.set(x, y), new Vec3());
        const end = this._screenToWorldPan(camera, tmpVb.set(x + dx, y + dy), new Vec3());
        tmpV1.sub2(start, end);

        this._targetPosition.add(tmpV1);
    }

    /**
     * @param {number} delta - The delta value.
     * @private
     */
    _zoom(delta) {
        this._targetZoomDist += delta * this.zoomSpeed;
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
        const ar = dt === -1 ? 1 : lerpRate(this.rotateDamping, dt);
        const am = dt === -1 ? 1 : lerpRate(this.moveDamping, dt);

        this._angles.x = math.lerpAngle(this._angles.x % 360, this._targetAngles.x % 360, ar);
        this._angles.y = math.lerpAngle(this._angles.y % 360, this._targetAngles.y % 360, ar);
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
        const a = dt === -1 ? 1 : lerpRate(this.zoomDamping, dt);
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
     * @param {Vec3} view - The view point.
     * @param {Vec3} point - The focus point.
     */
    focus(view, point) {
        this._position.copy(point);
        this._targetPosition.copy(this._position);

        tmpV1.sub2(view, point);
        const elev = Math.atan2(tmpV1.y, Math.sqrt(tmpV1.x * tmpV1.x + tmpV1.z * tmpV1.z)) * math.RAD_TO_DEG;
        const azim = Math.atan2(tmpV1.x, tmpV1.z) * math.RAD_TO_DEG;
        this._angles.set(-elev, azim, 0);
        this._targetAngles.copy(this._angles);

        this._rootTransform.setTRS(point, tmpQ1.setFromEulerAngles(this._angles), Vec3.ONE);

        this._zoomDist = tmpV1.length();
        this._targetZoomDist = this._zoomDist;
        this._orbitTransform.setTranslate(0, 0, this._zoomDist);
    }

    /**
     * @param {Mat4} transform - The transform.
     */
    attach(transform) {
        this.focus(transform.getTranslation(), Vec3.ZERO);
    }

    detach() {
        this._cancelSmoothTransform();
        this._cancelSmoothZoom();
    }

    /**
     * @param {OrbitInputFrame} frame - The input frame.
     * @param {CameraComponent} camera - The camera.
     * @param {number} dt - The delta time.
     * @returns {Mat4} - The camera transform.
     */
    update(frame, camera, dt) {
        const { move, rotate, pointer, zoom } = frame;
        this._pan(camera, pointer[0], pointer[1], move[0], move[1]);
        this._look(rotate[0], rotate[1]);
        this._zoom(zoom[0]);

        this._smoothTransform(dt);
        this._smoothZoom(dt);

        return this._transform.mul2(this._rootTransform, this._orbitTransform);
    }

    destroy() {
        this.detach();
    }
}

export { OrbitCamera };

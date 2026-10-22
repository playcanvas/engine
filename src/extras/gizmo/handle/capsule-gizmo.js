import { math } from '../../../core/math/math.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { PROJECTION_PERSPECTIVE } from '../../../scene/constants.js';
import { ShapeGizmo } from './shape-gizmo.js';

/**
 * @import { CameraComponent } from '../../../framework/components/camera/component.js'
 * @import { Layer } from '../../../scene/layer.js'
 * @import { GizmoHandle } from './handle-gizmo.js'
 */

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();
const tmpV4 = new Vec3();
const tmpV5 = new Vec3();
const tmpV6 = new Vec3();
const tmpV7 = new Vec3();
const tmpV8 = new Vec3();
const tmpV9 = new Vec3();
const tmpV10 = new Vec3();
const tmpV11 = new Vec3();
const tmpV12 = new Vec3();
const tmpV13 = new Vec3();
const tmpV14 = new Vec3();
const sides = Array.from({ length: 4 }, () => new Vec3());

const MIN_SIZE = 0.005;

/**
 * Draws a capsule along its y-axis, with handles that drag its radius and its height, caps
 * included. A height edit keeps the center in place.
 *
 * ```javascript
 * const gizmo = new CapsuleGizmo(cameraComponent, layer);
 * gizmo.on('handle:move', () => {
 *     collision.radius = gizmo.radius;
 *     collision.height = gizmo.height;
 * });
 * ```
 *
 * Relevant Engine API examples:
 *
 * - [Shape Gizmos](https://playcanvas.github.io/#/gizmos/shape)
 *
 * @category Gizmo
 */
class CapsuleGizmo extends ShapeGizmo {
    /**
     * The radius of the capsule. Defaults to 0.5.
     *
     * @type {number}
     */
    radius = 0.5;

    /**
     * The height of the capsule, caps included, at least twice its radius. Defaults to 2.
     *
     * @type {number}
     */
    height = 2;

    /**
     * The first result of {@link CapsuleGizmo#_offset}.
     *
     * @private
     */
    _a = new Vec3();

    /**
     * The second result of {@link CapsuleGizmo#_offset}.
     *
     * @private
     */
    _b = new Vec3();

    /**
     * Creates a new CapsuleGizmo object.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The render layer.
     * @example
     * const gizmo = new CapsuleGizmo(camera, layer);
     */
    constructor(camera, layer) {
        super(camera, layer, 'gizmo:capsule');
    }

    /**
     * Places the capsule and its handles.
     *
     * @protected
     * @override
     */
    _drawShapes() {
        const renderer = this._renderer;
        const { position: c, rotation: r, radius } = this;
        const half = Math.max(0.5 * this.height, radius);
        const up = r.transformVector(Vec3.UP, tmpV1);
        const right = r.transformVector(Vec3.RIGHT, tmpV2);
        const forward = r.transformVector(Vec3.FORWARD, tmpV3);
        for (let i = 0; i < 4; i++) {
            sides[i].copy(i & 1 ? forward : right).mulScalar(i < 2 ? 1 : -1);
        }

        if (this._theme.fill.a > 0) {
            renderer.capsule(c, r, radius, 2 * half);
        }

        // rings where the caps meet the body
        const top = tmpV4.copy(up).mulScalar(half - radius).add(c);
        const bottom = tmpV5.copy(up).mulScalar(radius - half).add(c);
        renderer.ring(top, r, radius, 0.5, 0.35);
        renderer.ring(bottom, r, radius, 0.5, 0.35);
        for (let i = 0; i < 4; i++) {
            const a = this._offset(top, sides[i], radius, 0);
            const b = this._offset(bottom, sides[i], radius, 1);
            renderer.line(a, b, 0.5, 0.35);
        }
        for (let i = 0; i < 2; i++) {
            renderer.arc(top, sides[i], up, radius, 0, Math.PI, 0.5, 0.35);
            renderer.arc(bottom, sides[i], up, radius, Math.PI, 2 * Math.PI, 0.5, 0.35);
        }
        this._outline(top, bottom, up, radius);

        if (!this._detailed(c, radius)) {
            return;
        }
        for (let i = 0; i < 4; i++) {
            const pos = this._offset(c, sides[i], radius, 0);
            if (this._handle(pos, this._theme.primary, null, 'radius', i, c, sides[i])) {
                this._readoutAt(pos, 'r', this._theme.primary, radius);
            }
        }
        for (let i = 0; i < 2; i++) {
            const dir = i ? up.mulScalar(-1) : up;
            const pos = this._offset(c, dir, half, 0);
            if (this._handle(pos, this._theme.secondary, null, 'height', i, c, dir)) {
                this._readoutAt(pos, 'h', this._theme.secondary, 2 * half);
            }
        }
    }

    /**
     * Places the outline of the capsule as the camera sees it.
     *
     * @param {Vec3} top - The center of the top cap.
     * @param {Vec3} bottom - The center of the bottom cap.
     * @param {Vec3} up - The axis of the capsule.
     * @param {number} radius - The radius.
     * @private
     */
    _outline(top, bottom, up, radius) {
        const camera = this._camera;
        const perspective = camera.projection === PROJECTION_PERSPECTIVE;
        const eye = camera.entity.getPosition();
        const view = perspective ? tmpV6.sub2(eye, top) : tmpV6.copy(camera.entity.forward).mulScalar(-1);
        const along = view.dot(up);
        const length = top.distance(bottom);
        if (perspective) {
            const t = math.clamp(along + length, 0, length);
            if (tmpV7.copy(up).mulScalar(t).add(bottom).distance(eye) <= radius) {
                return;
            }
        }

        // the sides are where the view grazes the body
        const across = tmpV7.copy(up).mulScalar(-along).add(view);
        const dist = across.length();
        const cos = perspective ? radius / dist : 0;
        if (!(cos < 1) || dist < 1e-6) {
            this._capOutline(along > 0 ? top : bottom, up, null, radius);
            return;
        }
        across.mulScalar(1 / dist);
        const side = tmpV8.cross(up, across).mulScalar(radius * Math.sqrt(1 - cos * cos));
        const offset = tmpV9.copy(across).mulScalar(radius * cos);
        for (let i = 0; i < 2; i++) {
            side.mulScalar(-1);
            const a = this._offset(top, offset, 1, 0).add(side);
            const b = this._offset(bottom, offset, 1, 1).add(side);
            this._renderer.line(a, b, 1.1);
        }
        this._capOutline(top, up, across, radius, cos);
        this._capOutline(bottom, tmpV10.copy(up).mulScalar(-1), across, radius, cos);
    }

    /**
     * Places the outline of a cap beyond the body, or all of it when viewed along the axis.
     *
     * @param {Vec3} center - The center of the cap.
     * @param {Vec3} axis - The direction the cap faces.
     * @param {Vec3|null} across - The unit direction across the axis to the camera, or null.
     * @param {number} radius - The radius.
     * @param {number} [cos] - The cosine of where the sides meet the cap, from the direction across.
     * @private
     */
    _capOutline(center, axis, across, radius, cos = 0) {
        const camera = this._camera;
        const perspective = camera.projection === PROJECTION_PERSPECTIVE;
        const view = perspective ? tmpV11.sub2(camera.entity.getPosition(), center) : tmpV11.copy(camera.entity.forward).mulScalar(-1);
        const outline = tmpV12;
        const size = this._sphereSilhouette(center, radius, outline);
        if (!across) {
            this._renderer.circle(outline, view, size, 1.1);
            return;
        }

        // the arc runs over the cap between the sides
        view.normalize();
        const x = tmpV13.cross(axis, across);
        const y = tmpV14.copy(view).mulScalar(-view.dot(axis)).add(axis).normalize();
        const from = Math.atan2(radius * cos * across.dot(y), radius * Math.sqrt(1 - cos * cos));
        this._renderer.arc(outline, x, y, size, from, Math.PI - from, 1.1);
    }

    /**
     * @param {Vec3} point - The point.
     * @param {Vec3} dir - The direction.
     * @param {number} distance - The distance along the direction.
     * @param {number} slot - Which of the two results to write.
     * @returns {Vec3} The point moved along the direction.
     * @private
     */
    _offset(point, dir, distance, slot) {
        return (slot ? this._b : this._a).copy(dir).mulScalar(distance).add(point);
    }

    /**
     * Sets the radius or height from the handle's distance to the center.
     *
     * @param {GizmoHandle} handle - The dragged handle.
     * @param {Vec3} point - Where the handle is dragged to.
     * @protected
     * @override
     */
    _moveHandle(handle, point) {
        const dist = Math.max(tmpV1.sub2(point, handle.origin).dot(handle.dir), MIN_SIZE);
        if (handle.name === 'radius') {
            this.radius = this._snapLength(dist);
            this.height = Math.max(this.height, 2 * this.radius);
        } else {
            this.height = Math.max(this._snapLength(2 * dist), 2 * this.radius);
        }
    }
}

export { CapsuleGizmo };

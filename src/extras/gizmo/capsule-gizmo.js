import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { PROJECTION_PERSPECTIVE } from '../../scene/constants.js';
import { COLOR_AMBER, COLOR_CYAN } from './color.js';
import { ShapeGizmo } from './shape-gizmo.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { Layer } from '../../scene/layer.js'
 * @import { HelperHandle } from './helper-gizmo.js'
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
 * @param {number} value - The value.
 * @returns {string} The value with at most two decimals.
 */
const fmt = value => `${+value.toFixed(2)}`;

/**
 * Draws a capsule along its y-axis, its outline over faint rings where its caps meet its body, cap
 * arcs and lines along its sides, with handles around its middle that drag its radius and at its ends that drag its
 * height. The height spans the whole capsule, caps included, and keeps the center in place.
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
        const shapes = this._shapes;
        const { position: c, rotation: r, radius } = this;
        const half = Math.max(0.5 * this.height, radius);
        const up = r.transformVector(Vec3.UP, tmpV1);
        const right = r.transformVector(Vec3.RIGHT, tmpV2);
        const forward = r.transformVector(Vec3.FORWARD, tmpV3);
        for (let i = 0; i < 4; i++) {
            sides[i].copy(i & 1 ? forward : right).mulScalar(i < 2 ? 1 : -1);
        }

        if (this._theme.fill.a > 0) {
            shapes.capsule(c, r, radius, 2 * half);
        }

        // rings where the caps meet the body, the sides between them and the arcs over the caps
        const top = tmpV4.copy(up).mulScalar(half - radius).add(c);
        const bottom = tmpV5.copy(up).mulScalar(radius - half).add(c);
        shapes.ring(top, r, radius, 0.5, 0.35);
        shapes.ring(bottom, r, radius, 0.5, 0.35);
        for (let i = 0; i < 4; i++) {
            const a = this._offset(top, sides[i], radius, 0);
            const b = this._offset(bottom, sides[i], radius, 1);
            shapes.line(a, b, 0.5, 0.35);
        }
        for (let i = 0; i < 2; i++) {
            shapes.arc(top, sides[i], up, radius, 0, Math.PI, 0.5, 0.35);
            shapes.arc(bottom, sides[i], up, radius, Math.PI, 2 * Math.PI, 0.5, 0.35);
        }
        this._outline(top, bottom, up, radius);

        if (!this._detailed(c, radius)) {
            return;
        }
        for (let i = 0; i < 4; i++) {
            const pos = this._offset(c, sides[i], radius, 0);
            if (this._handle(pos, COLOR_AMBER, null, 'radius', i, c, sides[i])) {
                this._readoutAt(pos, 'r', COLOR_AMBER, fmt(radius));
            }
        }
        for (let i = 0; i < 2; i++) {
            const dir = i ? up.mulScalar(-1) : up;
            const pos = this._offset(c, dir, half, 0);
            if (this._handle(pos, COLOR_CYAN, null, 'height', i, c, dir)) {
                this._readoutAt(pos, 'h', COLOR_CYAN, fmt(2 * half));
            }
        }
    }

    /**
     * Places the outline of the capsule as the camera sees it: the lines where the camera looks
     * past its body, and the arcs where it looks past its caps.
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

        // the sides are where the view across the axis grazes the body
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
            this._shapes.line(a, b, 1.1);
        }
        this._capOutline(top, up, across, radius, cos);
        this._capOutline(bottom, tmpV10.copy(up).mulScalar(-1), across, radius, cos);
    }

    /**
     * Places the outline of a cap, the part of the outline of its sphere beyond the body, or all of
     * it when the camera looks along the axis.
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
        const ratio = perspective ? radius / view.length() : 0;

        // the outline of a sphere is a circle nearer the camera and smaller than the sphere
        const outline = tmpV12.copy(view).mulScalar(ratio * ratio).add(center);
        const size = radius * Math.sqrt(1 - ratio * ratio);
        if (!across) {
            this._shapes.circle(outline, view, size, 1.1);
            return;
        }

        // the arc runs over the end of the cap, between where the sides meet it
        view.normalize();
        const x = tmpV13.cross(axis, across);
        const y = tmpV14.copy(view).mulScalar(-view.dot(axis)).add(axis).normalize();
        const from = Math.atan2(radius * cos * across.dot(y), radius * Math.sqrt(1 - cos * cos));
        this._shapes.arc(outline, x, y, size, from, Math.PI - from, 1.1);
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

    /** @private */
    _a = new Vec3();

    /** @private */
    _b = new Vec3();

    /**
     * Sets the radius or height from how far the handle is dragged from the center.
     *
     * @param {HelperHandle} handle - The dragged handle.
     * @param {Vec3} point - Where the handle is dragged to.
     * @protected
     * @override
     */
    _moveHandle(handle, point) {
        const dist = Math.max(tmpV1.sub2(point, handle.origin).dot(handle.dir), MIN_SIZE);
        if (handle.name === 'radius') {
            this.radius = dist;
            this.height = Math.max(this.height, 2 * dist);
        } else {
            this.height = Math.max(2 * dist, 2 * this.radius);
        }
    }
}

export { CapsuleGizmo };

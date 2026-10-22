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
const sides = Array.from({ length: 4 }, () => new Vec3());

const MIN_SIZE = 0.005;

/**
 * Draws a cylinder along its y-axis, with handles that drag its radius and its height. A height
 * edit keeps the center in place.
 *
 * ```javascript
 * const gizmo = new CylinderGizmo(cameraComponent, layer);
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
class CylinderGizmo extends ShapeGizmo {
    /**
     * The radius of the cylinder. Defaults to 0.5.
     *
     * @type {number}
     */
    radius = 0.5;

    /**
     * The height of the cylinder. Defaults to 2.
     *
     * @type {number}
     */
    height = 2;

    /**
     * Creates a new CylinderGizmo object.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The render layer.
     * @example
     * const gizmo = new CylinderGizmo(camera, layer);
     */
    constructor(camera, layer) {
        super(camera, layer, 'gizmo:cylinder');
    }

    /**
     * Places the cylinder and its handles.
     *
     * @protected
     * @override
     */
    _drawShapes() {
        const renderer = this._renderer;
        const { position: c, rotation: r, radius, height } = this;
        const up = r.transformVector(Vec3.UP, tmpV1);
        const right = r.transformVector(Vec3.RIGHT, tmpV2);
        const forward = r.transformVector(Vec3.FORWARD, tmpV3);
        for (let i = 0; i < 4; i++) {
            sides[i].copy(i & 1 ? forward : right).mulScalar(i < 2 ? 1 : -1);
        }

        if (this._theme.fill.a > 0) {
            renderer.cone('cylinder', c, r, tmpV4.set(2 * radius, height, 2 * radius));
        }

        const top = tmpV4.copy(up).mulScalar(0.5 * height).add(c);
        const bottom = tmpV5.copy(up).mulScalar(-0.5 * height).add(c);
        renderer.ring(top, r, radius);
        renderer.ring(bottom, r, radius);
        for (let i = 0; i < 4; i++) {
            const side = tmpV6.copy(sides[i]).mulScalar(radius);
            renderer.line(tmpV7.add2(top, side), tmpV8.add2(bottom, side), 0.5, 0.35);
        }
        this._outline(top, bottom, up, radius);

        if (!this._detailed(c, radius)) {
            return;
        }
        for (let i = 0; i < 4; i++) {
            const pos = tmpV6.copy(sides[i]).mulScalar(radius).add(c);
            if (this._handle(pos, this._theme.primary, null, 'radius', i, c, sides[i])) {
                this._readoutAt(pos, 'r', this._theme.primary, radius);
            }
        }
        for (let i = 0; i < 2; i++) {
            const dir = i ? up.mulScalar(-1) : up;
            const pos = tmpV6.copy(dir).mulScalar(0.5 * height).add(c);
            if (this._handle(pos, this._theme.secondary, null, 'height', i, c, dir)) {
                this._readoutAt(pos, 'h', this._theme.secondary, height);
            }
        }
    }

    /**
     * Places the sides of the cylinder as the camera sees them, none when viewed along its axis or
     * from inside it.
     *
     * @param {Vec3} top - The center of the top.
     * @param {Vec3} bottom - The center of the bottom.
     * @param {Vec3} up - The axis of the cylinder.
     * @param {number} radius - The radius.
     * @private
     */
    _outline(top, bottom, up, radius) {
        const camera = this._camera;
        const perspective = camera.projection === PROJECTION_PERSPECTIVE;
        const view = perspective ? tmpV6.sub2(camera.entity.getPosition(), top) : tmpV6.copy(camera.entity.forward).mulScalar(-1);

        // the sides are where the view grazes the body
        const across = tmpV7.copy(up).mulScalar(-view.dot(up)).add(view);
        const dist = across.length();
        const cos = perspective ? radius / dist : 0;
        if (!(cos < 1) || dist < 1e-6) {
            return;
        }
        across.mulScalar(1 / dist);
        const side = tmpV8.cross(up, across).mulScalar(radius * Math.sqrt(1 - cos * cos));
        const offset = across.mulScalar(radius * cos);
        for (let i = 0; i < 2; i++) {
            side.mulScalar(-1);
            const a = tmpV9.add2(top, offset).add(side);
            const b = tmpV10.add2(bottom, offset).add(side);
            this._renderer.line(a, b, 1.1);
        }
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
        } else {
            this.height = this._snapLength(2 * dist);
        }
    }
}

export { CylinderGizmo };

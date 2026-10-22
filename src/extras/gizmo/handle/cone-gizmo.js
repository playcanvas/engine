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

const MIN_SIZE = 0.005;

/**
 * Draws a cone along its y-axis, with handles that drag its base radius and its height. A height
 * edit keeps the center in place.
 *
 * ```javascript
 * const gizmo = new ConeGizmo(cameraComponent, layer);
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
class ConeGizmo extends ShapeGizmo {
    /**
     * The radius of the base of the cone. Defaults to 0.5.
     *
     * @type {number}
     */
    radius = 0.5;

    /**
     * The height of the cone. Defaults to 1.
     *
     * @type {number}
     */
    height = 1;

    /**
     * Creates a new ConeGizmo object.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The render layer.
     * @example
     * const gizmo = new ConeGizmo(camera, layer);
     */
    constructor(camera, layer) {
        super(camera, layer, 'gizmo:cone');
    }

    /**
     * Places the cone and its handles.
     *
     * @protected
     * @override
     */
    _drawShapes() {
        const renderer = this._renderer;
        const { position: c, rotation: r, radius, height } = this;
        const up = r.transformVector(Vec3.UP, tmpV1);
        const apex = tmpV2.copy(up).mulScalar(0.5 * height).add(c);
        const base = tmpV3.copy(up).mulScalar(-0.5 * height).add(c);

        if (this._theme.fill.a > 0) {
            renderer.cone('cone', c, r, tmpV4.set(2 * radius, height, 2 * radius));
        }
        renderer.ring(base, r, radius);
        for (let i = 0; i < 4; i++) {
            const side = r.transformVector(i & 1 ? Vec3.FORWARD : Vec3.RIGHT, tmpV5).mulScalar(i < 2 ? radius : -radius);
            renderer.line(side.add(base), apex, 0.5, 0.35);
        }
        this._outline(apex, base, up, radius, height);

        if (!this._detailed(c, radius)) {
            return;
        }
        for (let i = 0; i < 4; i++) {
            const dir = r.transformVector(i & 1 ? Vec3.FORWARD : Vec3.RIGHT, tmpV5).mulScalar(i < 2 ? 1 : -1);
            const pos = tmpV6.copy(dir).mulScalar(radius).add(base);
            if (this._handle(pos, this._theme.primary, null, 'radius', i, base, dir)) {
                this._readoutAt(pos, 'r', this._theme.primary, radius);
            }
        }
        if (this._handle(apex, this._theme.secondary, null, 'height', 0, c, up)) {
            this._readoutAt(apex, 'h', this._theme.secondary, height);
        }
    }

    /**
     * Places the outline of the cone as the camera sees it, none when the base surrounds the apex.
     *
     * @param {Vec3} apex - The apex.
     * @param {Vec3} base - The center of the base.
     * @param {Vec3} up - The axis of the cone.
     * @param {number} radius - The radius of the base.
     * @param {number} height - The height.
     * @private
     */
    _outline(apex, base, up, radius, height) {
        const camera = this._camera;
        const view = camera.projection === PROJECTION_PERSPECTIVE ?
            tmpV7.sub2(apex, camera.entity.getPosition()) :
            tmpV7.copy(camera.entity.forward);

        // the outline lines graze the base ring where the view from the apex meets its plane
        const along = view.dot(up);
        const across = tmpV8.copy(up).mulScalar(-along).add(view);
        const dist = across.length();
        const cos = radius * Math.abs(along) / (height * dist);
        if (!(cos < 1)) {
            return;
        }
        across.mulScalar(along > 0 ? -1 / dist : 1 / dist);
        const side = tmpV9.cross(up, across).mulScalar(radius * Math.sqrt(1 - cos * cos));
        across.mulScalar(radius * cos).add(base);
        for (let i = 0; i < 2; i++) {
            side.mulScalar(-1);
            this._renderer.line(tmpV6.add2(across, side), apex, 1.1);
        }
    }

    /**
     * Sets the radius or height from the dragged handle's distance.
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

export { ConeGizmo };

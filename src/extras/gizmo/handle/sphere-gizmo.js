import { Vec3 } from '../../../core/math/vec3.js';
import { ShapeGizmo } from './shape-gizmo.js';

/**
 * @import { CameraComponent } from '../../../framework/components/camera/component.js'
 * @import { Layer } from '../../../scene/layer.js'
 * @import { GizmoHandle } from './handle-gizmo.js'
 */

const tmpV1 = new Vec3();

const MIN_RADIUS = 0.005;

/**
 * Draws a sphere with handles that drag its radius.
 *
 * ```javascript
 * const gizmo = new SphereGizmo(cameraComponent, layer);
 * gizmo.radius = 2;
 * gizmo.on('handle:move', () => {
 *     collision.radius = gizmo.radius;
 * });
 * ```
 *
 * Relevant Engine API examples:
 *
 * - [Shape Gizmos](https://playcanvas.github.io/#/gizmos/shape)
 *
 * @category Gizmo
 */
class SphereGizmo extends ShapeGizmo {
    /**
     * The radius of the sphere. Defaults to 0.5.
     *
     * @type {number}
     */
    radius = 0.5;

    /**
     * Creates a new SphereGizmo object.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The render layer.
     * @example
     * const gizmo = new SphereGizmo(camera, layer);
     */
    constructor(camera, layer) {
        super(camera, layer, 'gizmo:sphere');
    }

    /**
     * Places the sphere and its handles.
     *
     * @protected
     * @override
     */
    _drawShapes() {
        const { position: c, rotation: r, radius } = this;
        if (this._theme.fill.a > 0) {
            this._renderer.sphere(c, radius);
        }
        this._sphereOutline(c, r, radius);
        if (!this._detailed(c, radius)) {
            return;
        }
        this._sphereHandles(c, r, radius, null, 'radius');
    }

    /**
     * Sets the radius from the handle's distance to the center.
     *
     * @param {GizmoHandle} handle - The dragged handle.
     * @param {Vec3} point - Where the handle is dragged to.
     * @protected
     * @override
     */
    _moveHandle(handle, point) {
        this.radius = Math.max(this._snapLength(tmpV1.sub2(point, handle.origin).dot(handle.dir)), MIN_RADIUS);
    }
}

export { SphereGizmo };

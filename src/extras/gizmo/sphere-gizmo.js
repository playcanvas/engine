import { Vec3 } from '../../core/math/vec3.js';
import { COLOR_AMBER } from './color.js';
import { ShapeGizmo } from './shape-gizmo.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { Layer } from '../../scene/layer.js'
 * @import { HelperHandle } from './helper-gizmo.js'
 */

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();

const AXES = [Vec3.RIGHT, Vec3.LEFT, Vec3.UP, Vec3.DOWN, Vec3.BACK, Vec3.FORWARD];
const MIN_RADIUS = 0.005;

/**
 * @param {number} value - The value.
 * @returns {string} The value with at most two decimals.
 */
const fmt = value => `${+value.toFixed(2)}`;

/**
 * Draws a sphere, its outline over three faint great circles, with handles at the ends of its
 * axes that drag its radius.
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
            this._shapes.sphere(c, radius);
        }
        this._sphereOutline(c, r, radius);
        if (!this._detailed(c, radius)) {
            return;
        }
        for (let i = 0; i < AXES.length; i++) {
            const dir = r.transformVector(AXES[i], tmpV1);
            const pos = tmpV2.copy(dir).mulScalar(radius).add(c);
            if (this._handle(pos, COLOR_AMBER, null, 'radius', i, c, dir)) {
                this._readoutAt(pos, 'r', COLOR_AMBER, fmt(radius));
            }
        }
    }

    /**
     * Sets the radius from how far the handle is dragged from the center.
     *
     * @param {HelperHandle} handle - The dragged handle.
     * @param {Vec3} point - Where the handle is dragged to.
     * @protected
     * @override
     */
    _moveHandle(handle, point) {
        this.radius = Math.max(tmpV1.sub2(point, handle.origin).dot(handle.dir), MIN_RADIUS);
    }
}

export { SphereGizmo };

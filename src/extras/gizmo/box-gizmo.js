import { Vec3 } from '../../core/math/vec3.js';
import { ShapeGizmo } from './shape-gizmo.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { Layer } from '../../scene/layer.js'
 * @import { GizmoHandle } from './handle-gizmo.js'
 */

const tmpV1 = new Vec3();

/**
 * Draws a box with handles on its faces and corners that resize it. A face handle moves its face
 * along its axis. A corner handle moves its corner across the view, resizing each axis, or along
 * the diagonal with {@link BoxGizmo#uniform}, scaling the box evenly. The opposite face or corner
 * stays in place, or the center does with {@link BoxGizmo#centered}.
 *
 * ```javascript
 * const gizmo = new BoxGizmo(cameraComponent, layer);
 * gizmo.halfExtents.set(1, 0.5, 1);
 * gizmo.on('handle:move', () => {
 *     collision.halfExtents = gizmo.halfExtents;
 *     entity.setPosition(gizmo.position);
 * });
 * ```
 *
 * Relevant Engine API examples:
 *
 * - [Shape Gizmos](https://playcanvas.github.io/#/gizmos/shape)
 *
 * @category Gizmo
 */
class BoxGizmo extends ShapeGizmo {
    /**
     * The half extents of the box along its axes.
     *
     * @type {Vec3}
     */
    halfExtents = new Vec3(0.5, 0.5, 0.5);

    /**
     * Whether to show handles at the center of each face. Defaults to true.
     *
     * @type {boolean}
     */
    faceHandles = true;

    /**
     * Whether to show handles at the corners. Defaults to true.
     *
     * @type {boolean}
     */
    cornerHandles = true;

    /**
     * Whether a resize keeps the center of the box in place, moving the opposite face or corner
     * too, rather than keeping the opposite face or corner in place. Defaults to false.
     *
     * @type {boolean}
     */
    centered = false;

    /**
     * Whether a corner handle scales the box evenly, along the diagonal through the corner, rather
     * than resizing each axis. Defaults to false.
     *
     * @type {boolean}
     */
    uniform = false;

    /**
     * The position at the start of a resize.
     *
     * @private
     */
    _startPosition = new Vec3();

    /**
     * The half extents at the start of a resize.
     *
     * @private
     */
    _startHalfExtents = new Vec3();

    /**
     * Creates a new BoxGizmo object.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The render layer.
     * @example
     * const gizmo = new BoxGizmo(camera, layer);
     */
    constructor(camera, layer) {
        super(camera, layer, 'gizmo:box');
    }

    /**
     * Places the box and its handles.
     *
     * @protected
     * @override
     */
    _drawShapes() {
        const shapes = this._shapes;
        const { position: c, rotation: r, halfExtents: h } = this;
        const corners = this._boxCorners(c, r, h);
        for (let i = 0; i < corners.length; i++) {
            for (let bit = 1; bit < corners.length; bit <<= 1) {
                if (!(i & bit)) {
                    shapes.line(corners[i], corners[i | bit]);
                }
            }
        }
        if (this._theme.fill.a > 0) {
            shapes.box(c, r, tmpV1.copy(h).mulScalar(2));
        }
        this._boxHandles(c, h, this);
    }

    /**
     * Keeps the box at the start of a resize.
     *
     * @param {GizmoHandle} handle - The dragged handle.
     * @protected
     * @override
     */
    _startHandle(handle) {
        this._startPosition.copy(this.position);
        this._startHalfExtents.copy(this.halfExtents);
    }

    /**
     * Resizes the box from where its face or corner is dragged to.
     *
     * @param {GizmoHandle} handle - The dragged handle.
     * @param {Vec3} point - Where the handle is dragged to.
     * @protected
     * @override
     */
    _moveHandle(handle, point) {
        this._resizeBox(handle, point, this.rotation, this._startPosition, this._startHalfExtents, this, 0, this.position, this.halfExtents);
    }
}

export { BoxGizmo };

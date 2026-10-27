import { Vec3 } from '../../../core/math/vec3.js';
import { ShapeGizmo } from './shape-gizmo.js';

/**
 * @import { CameraComponent } from '../../../framework/components/camera/component.js'
 * @import { Layer } from '../../../scene/layer.js'
 * @import { GizmoHandle } from './handle-gizmo.js'
 */

const tmpV1 = new Vec3();

/**
 * Draws a box with face and corner handles that resize it, keeping the opposite face or corner in
 * place, or the center with {@link BoxGizmo#centered}.
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
     * Whether a resize keeps the center in place. Defaults to false.
     *
     * @type {boolean}
     */
    centered = false;

    /**
     * Whether corner handles scale evenly. Defaults to false.
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
        const renderer = this._renderer;
        const { position: c, rotation: r, halfExtents: h } = this;
        const corners = this._boxCorners(c, r, h);
        for (let i = 0; i < corners.length; i++) {
            for (let bit = 1; bit < corners.length; bit <<= 1) {
                if (!(i & bit)) {
                    renderer.line(corners[i], corners[i | bit]);
                }
            }
        }
        if (this._theme.fill.a > 0) {
            renderer.box(c, r, tmpV1.copy(h).mulScalar(2));
        }
        this._boxHandles(c, h, this);
    }

    /**
     * Stores the box at the start of a resize.
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
     * Resizes the box to the dragged face or corner.
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

import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { COLOR_AMBER, COLOR_CYAN, COLOR_MAGENTA, COLOR_YELLOW } from './color.js';
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
const tmpQ1 = new Quat();
const corners = Array.from({ length: 8 }, () => new Vec3());

const AXES = /** @type {const} */ (['x', 'y', 'z']);
const UNITS = [Vec3.RIGHT, Vec3.UP, Vec3.BACK];
const FACE_COLORS = [COLOR_AMBER, COLOR_CYAN, COLOR_MAGENTA];
const FACE_LABELS = ['W', 'H', 'D'];
const FACES = 6;
const MIN_HALF = 0.005;
const MIN_FACTOR = 0.01;

/**
 * @param {number} value - The value.
 * @returns {string} The value with two decimals.
 */
const fmt = value => value.toFixed(2);

/**
 * @param {number} corner - The corner index.
 * @param {number} axis - The axis index.
 * @returns {number} The side of the corner along the axis, -1 or 1.
 */
const side = (corner, axis) => (corner & (1 << axis) ? 1 : -1);

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
     * The axes of the box, from its rotation, for the frame being drawn.
     *
     * @type {Vec3[]}
     * @protected
     */
    _axes = [new Vec3(), new Vec3(), new Vec3()];

    /**
     * The position at the start of a resize.
     *
     * @protected
     */
    _startPosition = new Vec3();

    /**
     * The half extents at the start of a resize.
     *
     * @protected
     */
    _startHalfExtents = new Vec3();

    /**
     * Creates a new BoxGizmo object.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The render layer.
     * @param {string} [name] - The name of the gizmo.
     * @example
     * const gizmo = new BoxGizmo(camera, layer);
     */
    constructor(camera, layer, name = 'gizmo:box') {
        super(camera, layer, name);
    }

    /**
     * Gets the extent of the box along an axis, as its readout shows it.
     *
     * @param {number} axis - The axis index.
     * @returns {number} The extent.
     * @protected
     */
    _extent(axis) {
        return 2 * this.halfExtents[AXES[axis]];
    }

    /**
     * Places the edges of the box.
     *
     * @param {Vec3[]} points - The world corners, the bits of each index giving its x, y and z
     * sides.
     * @protected
     */
    _drawEdges(points) {
        for (let i = 0; i < points.length; i++) {
            for (let bit = 1; bit < points.length; bit <<= 1) {
                if (!(i & bit)) {
                    this._shapes.line(points[i], points[i | bit]);
                }
            }
        }
    }

    /**
     * Places the box and its handles.
     *
     * @protected
     */
    _drawBox() {
        const shapes = this._shapes;
        const { position: c, rotation: r, halfExtents: h } = this;
        const axes = this._axes;
        for (let k = 0; k < 3; k++) {
            r.transformVector(UNITS[k], axes[k]);
        }
        for (let i = 0; i < corners.length; i++) {
            const corner = corners[i].copy(c);
            for (let k = 0; k < 3; k++) {
                corner.add(tmpV1.copy(axes[k]).mulScalar(side(i, k) * h[AXES[k]]));
            }
        }

        this._drawEdges(corners);
        if (this._theme.fill.a > 0) {
            shapes.box(c, r, tmpV1.copy(h).mulScalar(2));
        }

        if (!this._detailed(c, Math.max(h.x, h.y, h.z))) {
            return;
        }
        if (this.faceHandles) {
            for (let i = 0; i < FACES; i++) {
                const k = i >> 1;
                const dir = tmpV2.copy(axes[k]).mulScalar(i & 1 ? -1 : 1);
                const pos = tmpV1.copy(dir).mulScalar(h[AXES[k]]).add(c);
                if (this._handle(pos, FACE_COLORS[k], null, 'size', i, c, dir)) {
                    this._readoutAt(pos, FACE_LABELS[k], FACE_COLORS[k], fmt(this._extent(k)));
                }
            }
        }
        if (this.cornerHandles) {
            const forward = this._camera.entity.forward;
            for (let i = 0; i < corners.length; i++) {
                const pos = corners[i];
                const hovered = this.uniform ?
                    this._handle(pos, COLOR_YELLOW, null, 'size', FACES + i, c, tmpV2.sub2(pos, c).normalize()) :
                    this._handle(pos, COLOR_YELLOW, null, 'size', FACES + i, pos, forward, true);
                if (hovered && this.readout) {
                    const html = FACE_LABELS.map((label, k) => `${this._readoutLabel(label, FACE_COLORS[k])} ${fmt(this._extent(k))}`);
                    shapes.label(pos, html.join('  '), shapes.handleSize);
                }
            }
        }
    }

    /**
     * Places the box.
     *
     * @protected
     * @override
     */
    _drawShapes() {
        this._drawBox();
    }

    /**
     * Keeps the box at the start of a resize.
     *
     * @param {HelperHandle} handle - The dragged handle.
     * @protected
     * @override
     */
    _startHandle(handle) {
        this._startPosition.copy(this.position);
        this._startHalfExtents.copy(this.halfExtents);
    }

    /**
     * Resizes one axis of the box from where its face or corner is dragged to.
     *
     * @param {number} axis - The axis index.
     * @param {number} sign - The side of the dragged face or corner, -1 or 1.
     * @param {Vec3} local - The dragged point relative to the start position, along the box axes.
     * @param {Vec3} half - The half extents to set.
     * @param {Vec3} mid - The offset of the center to set, along the box axes.
     * @private
     */
    _resizeAxis(axis, sign, local, half, mid) {
        const a = AXES[axis];
        if (this.centered) {
            half[a] = Math.max(sign * local[a], MIN_HALF);
            mid[a] = 0;
            return;
        }
        const anchor = -sign * this._startHalfExtents[a];
        half[a] = 0.5 * Math.max(sign * (local[a] - anchor), 2 * MIN_HALF);
        mid[a] = anchor + sign * half[a];
    }

    /**
     * Resizes the box from where its face or corner is dragged to.
     *
     * @param {HelperHandle} handle - The dragged handle.
     * @param {Vec3} point - Where the handle is dragged to.
     * @protected
     * @override
     */
    _moveHandle(handle, point) {
        const rotation = this.rotation;
        const local = tmpQ1.copy(rotation).invert().transformVector(tmpV1.sub2(point, this._startPosition), tmpV1);
        const start = this._startHalfExtents;
        const half = tmpV2.copy(start);
        const mid = tmpV3.set(0, 0, 0);

        if (handle.index < FACES) {
            this._resizeAxis(handle.index >> 1, handle.index & 1 ? -1 : 1, local, half, mid);
        } else if (this.uniform) {
            // the box scales evenly about the opposite corner, or the center
            const corner = handle.index - FACES;
            const anchor = tmpV4.set(-side(corner, 0) * start.x, -side(corner, 1) * start.y, -side(corner, 2) * start.z);
            if (this.centered) {
                anchor.set(0, 0, 0);
            }
            const from = Math.hypot(side(corner, 0) * start.x - anchor.x, side(corner, 1) * start.y - anchor.y, side(corner, 2) * start.z - anchor.z);
            const factor = Math.max(local.distance(anchor) / from, MIN_FACTOR);
            half.mulScalar(factor);
            mid.copy(anchor).mulScalar(1 - factor);
        } else {
            const corner = handle.index - FACES;
            for (let k = 0; k < 3; k++) {
                this._resizeAxis(k, side(corner, k), local, half, mid);
            }
        }

        this.halfExtents.copy(half);
        this.position.copy(rotation.transformVector(mid, mid)).add(this._startPosition);
    }
}

export { BoxGizmo };

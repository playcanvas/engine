import { Color } from '../../../core/math/color.js';
import { math } from '../../../core/math/math.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Plane } from '../../../core/shape/plane.js';
import { PROJECTION_PERSPECTIVE } from '../../../scene/constants.js';
import { DragGizmo } from '../drag-gizmo.js';
import { Gizmo } from '../gizmo.js';
import { COLOR_AMBER, COLOR_BACKDROP, COLOR_CYAN, COLOR_MAGENTA, COLOR_YELLOW } from '../color.js';
import { OverlayRenderer } from '../overlay/overlay-renderer.js';
import { Pool } from '../pool.js';

/**
 * @import { CameraComponent } from '../../../framework/components/camera/component.js'
 * @import { GraphNode } from '../../../scene/graph-node.js'
 * @import { Layer } from '../../../scene/layer.js'
 * @import { MeshInstance } from '../../../scene/mesh-instance.js'
 * @import { Shape } from '../shape/shape.js'
 * @import { OverlayIcon } from '../overlay/icon-glyphs.js'
 */

/**
 * @typedef {object} HandleGizmoTheme
 * @property {Color} base - The color where the shapes are visible.
 * @property {Color} occluded - The color where the scene hides the shapes.
 * @property {Color} fill - The color of filled volumes. An alpha of 0 skips the volumes.
 * @property {Color} primary - The color of a hovered or dragged radius, range, width or far clip
 * handle, and of its guide and readout label.
 * @property {Color} secondary - The color of a hovered or dragged height, near clip or inner cone
 * angle handle, and of its guide and readout label.
 * @property {Color} tertiary - The color of a hovered or dragged depth, field of view or outer cone
 * angle handle, and of its guide and readout label.
 * @property {Color} corner - The color of a hovered or dragged box corner handle.
 * @property {Color} backdrop - The color of the disc behind each icon, which is clicked to select it.
 */

/**
 * A handle placed this frame, or the one being dragged.
 *
 * @typedef {object} GizmoHandle
 * @property {Shape|null} shape - The handle shape.
 * @property {GraphNode|null} node - The node the handle edits, or null for a shape gizmo.
 * @property {string} name - The value the handle edits.
 * @property {number} index - The index of the handle among those editing the value.
 * @property {Vec3} origin - The point the edit is measured from.
 * @property {Vec3} dir - The unit direction of the line, or the normal of the plane.
 * @property {boolean} plane - Whether the handle moves in a plane rather than along a line.
 * @ignore
 */

/**
 * The handles of a box and how they resize it.
 *
 * @typedef {object} BoxHandleOptions
 * @property {boolean} faceHandles - Whether to show handles at the center of each face.
 * @property {boolean} cornerHandles - Whether to show handles at the corners.
 * @property {boolean} centered - Whether a resize keeps the center in place.
 * @property {boolean} uniform - Whether a corner handle scales the box evenly.
 * @ignore
 */

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();
const tmpV4 = new Vec3();
const tmpV5 = new Vec3();
const tmpQ1 = new Quat();
const tmpLocal = new Vec3();
const tmpHalf = new Vec3();
const tmpMid = new Vec3();
const tmpAnchor = new Vec3();
const tmpBoxQ = new Quat();
const plane = new Plane();
const boxAxes = [new Vec3(), new Vec3(), new Vec3()];
const boxCorners = Array.from({ length: 8 }, () => new Vec3());

const SPHERE_RINGS = [
    new Quat(),
    new Quat().setFromEulerAngles(90, 0, 0),
    new Quat().setFromEulerAngles(0, 0, 90)
];

const SPHERE_AXES = [Vec3.RIGHT, Vec3.LEFT, Vec3.UP, Vec3.DOWN, Vec3.BACK, Vec3.FORWARD];

const BOX_AXES = /** @type {const} */ (['x', 'y', 'z']);
const BOX_UNITS = [Vec3.RIGHT, Vec3.UP, Vec3.BACK];
const BOX_FACE_LABELS = ['W', 'H', 'D'];
const BOX_FACES = 6;
const BOX_MIN_HALF = 0.005;
const BOX_MIN_FACTOR = 0.01;

const RINGS_SIZE = 40;

const DETAIL_FADE_START = 60;
const DETAIL_FADE_END = 100;

/**
 * @param {number} corner - The corner index.
 * @param {number} axis - The axis index.
 * @returns {number} The side of the corner along the axis, -1 or 1.
 */
const boxSide = (corner, axis) => (corner & (1 << axis) ? 1 : -1);

/**
 * @returns {GizmoHandle} A new handle record.
 */
const createHandle = () => ({
    shape: null,
    node: null,
    name: '',
    index: 0,
    origin: new Vec3(),
    dir: new Vec3(),
    plane: false
});

/**
 * The base class of gizmos that draw world-sized overlay shapes, such as a camera frustum or a
 * light shape, with handles that drag to edit them once large enough on screen.
 *
 * Use a layer that keeps the scene depth, so occluded parts use the `occluded` color, and sorts
 * transparent mesh instances manually, as {@link Gizmo.createLayer} makes with `depth` set.
 *
 * ```javascript
 * const layer = Gizmo.createLayer(app, 'Overlays', undefined, true);
 * ```
 *
 * @category Gizmo
 */
class HandleGizmo extends DragGizmo {
    /**
     * Fired when a handle starts being dragged.
     *
     * @event
     * @example
     * const gizmo = new pc.LightGizmo(camera, layer);
     * gizmo.on('handle:start', (node, name) => {
     *     console.log(`Started editing ${name} of ${node.name}`);
     * });
     */
    static EVENT_HANDLESTART = 'handle:start';

    /**
     * Fired when a dragged handle edits its value.
     *
     * @event
     * @example
     * const gizmo = new pc.LightGizmo(camera, layer);
     * gizmo.on('handle:move', (node, name) => {
     *     console.log(`Edited ${name} of ${node.name}`);
     * });
     */
    static EVENT_HANDLEMOVE = 'handle:move';

    /**
     * Fired when a handle stops being dragged.
     *
     * @event
     * @example
     * const gizmo = new pc.LightGizmo(camera, layer);
     * gizmo.on('handle:end', (node, name) => {
     *     console.log(`Finished editing ${name} of ${node.name}`);
     * });
     */
    static EVENT_HANDLEEND = 'handle:end';

    /**
     * Fired when the icon of a node is clicked.
     *
     * @event
     * @example
     * const gizmo = new pc.LightGizmo(camera, layer);
     * gizmo.on('icon:select', (node) => {
     *     console.log(`Clicked the icon of ${node.name}`);
     * });
     */
    static EVENT_ICONSELECT = 'icon:select';

    /**
     * Internal theme.
     *
     * @type {HandleGizmoTheme}
     * @protected
     */
    _theme = {
        base: Color.WHITE.clone(),
        occluded: new Color(1, 1, 1, 0.2),
        fill: new Color(1, 1, 1, 0.05),
        primary: COLOR_AMBER.clone(),
        secondary: COLOR_CYAN.clone(),
        tertiary: COLOR_MAGENTA.clone(),
        corner: COLOR_YELLOW.clone(),
        backdrop: COLOR_BACKDROP.clone()
    };

    /**
     * The theme colors of the box faces along each axis, updated with the theme.
     *
     * @type {Color[]}
     * @private
     */
    _faceColors = [this._theme.primary, this._theme.secondary, this._theme.tertiary];

    /**
     * Whether to show handles that edit the shapes. Defaults to true.
     *
     * @type {boolean}
     */
    handles = true;

    /**
     * Whether to show the value of a hovered or dragged handle. Defaults to true.
     *
     * @type {boolean}
     */
    readout = true;

    /**
     * Whether to show an icon at each node. Defaults to true.
     *
     * @type {boolean}
     */
    icon = true;

    /**
     * The overlay renderer.
     *
     * @type {OverlayRenderer}
     * @protected
     */
    _renderer;

    /**
     * The handles placed this frame.
     *
     * @type {Pool<GizmoHandle>}
     * @private
     */
    _placed = new Pool(createHandle);

    /**
     * The hovered handle, matched by what it edits.
     *
     * @type {GizmoHandle}
     * @private
     */
    _hovered = createHandle();

    /**
     * The dragged handle, as it was at the start of the drag.
     *
     * @type {GizmoHandle}
     * @protected
     */
    _drag = createHandle();

    /**
     * Whether a handle is being dragged.
     *
     * @protected
     */
    _dragging = false;

    /**
     * The fade of the handles, set by {@link HandleGizmo#_detailed}.
     *
     * @private
     */
    _detailFade = 1;

    /**
     * The offset from the pointer to the dragged handle, so it does not jump.
     *
     * @private
     */
    _dragOffset = new Vec3();

    /**
     * Creates a new HandleGizmo object.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The render layer.
     * @param {string} [name] - The name of the gizmo.
     */
    constructor(camera, layer, name = 'gizmo:handle') {
        super(camera, layer, name);

        this._renderer = new OverlayRenderer(this, this._theme);

        this.on(Gizmo.EVENT_POINTERDOWN, (x, y, meshInstance) => {
            if (this._dragging || !meshInstance) {
                return;
            }
            const handle = this._find(meshInstance);
            if (!handle) {
                const node = this._renderer.icons.pick(meshInstance);
                if (node) {
                    this.fire(HandleGizmo.EVENT_ICONSELECT, node);
                }
                return;
            }
            this._copy(handle, this._drag);
            const point = this._pointerPoint(x, y);
            if (!point) {
                return;
            }
            this._dragOffset.sub2(/** @type {Shape} */ (handle.shape).entity.getPosition(), point);
            this._dragging = true;
            this._startHandle(this._drag);
            this.fire(HandleGizmo.EVENT_HANDLESTART, this._drag.node, this._drag.name);
        });

        this.on(Gizmo.EVENT_POINTERMOVE, (x, y, meshInstance) => {
            if (!this._dragging) {
                const handle = this._find(meshInstance);
                if (handle) {
                    this._copy(handle, this._hovered);
                } else {
                    this._hovered.name = '';
                }
                return;
            }
            const point = this._pointerPoint(x, y);
            if (point) {
                this._moveHandle(this._drag, point.add(this._dragOffset));
                this.fire(HandleGizmo.EVENT_HANDLEMOVE, this._drag.node, this._drag.name);
            }
        });

        this.on(Gizmo.EVENT_POINTERUP, () => {
            this._endDrag();
        });

        this.on(Gizmo.EVENT_NODESDETACH, () => {
            this._hovered.name = '';
            this._endDrag();
        });
    }

    /**
     * Sets the line thickness in CSS pixels; dashed lines space their dashes to match. Defaults
     * to 2.
     *
     * @type {number}
     */
    set lineThickness(value) {
        this._renderer.lineThickness = value;
    }

    /**
     * Gets the line thickness in CSS pixels.
     *
     * @type {number}
     */
    get lineThickness() {
        return this._renderer.lineThickness;
    }

    /**
     * Sets the handle size in CSS pixels. Defaults to 7.
     *
     * @type {number}
     */
    set handleSize(value) {
        this._renderer.handleSize = value;
    }

    /**
     * Gets the handle size in CSS pixels.
     *
     * @type {number}
     */
    get handleSize() {
        return this._renderer.handleSize;
    }

    /**
     * Sets the icon size in CSS pixels. Defaults to 24.
     *
     * @type {number}
     */
    set iconSize(value) {
        this._renderer.iconSize = value;
    }

    /**
     * Gets the icon size in CSS pixels.
     *
     * @type {number}
     */
    get iconSize() {
        return this._renderer.iconSize;
    }

    /**
     * Gets the current theme for the gizmo.
     *
     * @type {HandleGizmoTheme}
     */
    get theme() {
        return this._theme;
    }

    /**
     * Sets the theme or partial theme for the gizmo.
     *
     * @param {Partial<HandleGizmoTheme>} partial - The partial theme to set.
     * @example
     * gizmo.setTheme({ occluded: new Color(1, 1, 1, 0.5) });
     * @example
     * // accents told apart without red and green
     * gizmo.setTheme({
     *     primary: new Color(0.9, 0.6, 0),
     *     secondary: new Color(0.35, 0.7, 0.9),
     *     tertiary: new Color(0.8, 0.6, 0.7)
     * });
     */
    setTheme(partial) {
        this._renderer.applyTheme(partial);
    }

    /**
     * The shapes are drawn in world space.
     *
     * @override
     */
    _updateRotation() {
    }

    /**
     * The shapes are sized in world units.
     *
     * @override
     */
    _updateScale() {
    }

    /**
     * @param {GizmoHandle} from - The handle to copy.
     * @param {GizmoHandle} to - The handle to copy into.
     * @private
     */
    _copy(from, to) {
        to.shape = from.shape;
        to.node = from.node;
        to.name = from.name;
        to.index = from.index;
        to.origin.copy(from.origin);
        to.dir.copy(from.dir);
        to.plane = from.plane;
    }

    /**
     * @param {GizmoHandle} a - A handle.
     * @param {GraphNode} node - The node the other handle edits.
     * @param {string} name - The value the other handle edits.
     * @param {number} index - The index of the other handle.
     * @returns {boolean} Whether the handles edit the same value.
     * @private
     */
    _matches(a, node, name, index) {
        return a.name !== '' && a.node === node && a.name === name && a.index === index;
    }

    /**
     * @param {MeshInstance} [meshInstance] - The picked mesh instance.
     * @returns {GizmoHandle|null} The handle placed this frame that was picked.
     * @private
     */
    _find(meshInstance) {
        if (!meshInstance) {
            return null;
        }
        const placed = this._placed;
        for (let i = 0; i < placed.count; i++) {
            if (placed.items[i].shape?.meshInstances[0] === meshInstance) {
                return placed.items[i];
            }
        }
        return null;
    }

    /**
     * Gets the point of the dragged handle's line or plane under the pointer.
     *
     * @param {number} x - The canvas x coordinate.
     * @param {number} y - The canvas y coordinate.
     * @returns {Vec3|null} The point, or null when the line points at the camera.
     * @private
     */
    _pointerPoint(x, y) {
        const camera = this._camera;
        const { origin, dir } = this._drag;
        const ray = this._createRay(camera.screenToWorld(x, y, 1, tmpV1));
        if (this._drag.plane) {
            return plane.setFromPointNormal(origin, dir).intersectsRay(ray, tmpV1) ? tmpV1 : null;
        }

        const facing = camera.projection === PROJECTION_PERSPECTIVE ?
            tmpV2.sub2(camera.entity.getPosition(), origin).normalize() :
            tmpV2.copy(camera.entity.forward).mulScalar(-1);
        const normal = tmpV3;
        if (!this._lineNormal(dir, facing, normal)) {
            return null;
        }
        if (!plane.setFromPointNormal(origin, normal).intersectsRay(ray, tmpV1)) {
            return null;
        }
        const along = tmpV2.sub2(tmpV1, origin).dot(dir);
        return tmpV1.copy(dir).mulScalar(along).add(origin);
    }

    /**
     * @private
     */
    _endDrag() {
        if (!this._dragging) {
            return;
        }
        this._dragging = false;
        this.fire(HandleGizmo.EVENT_HANDLEEND, this._drag.node, this._drag.name);
        this._drag.name = '';
    }

    /**
     * Gets whether a shape is large enough on screen to show its handles.
     *
     * @param {Vec3} center - The center of the shape.
     * @param {number} radius - The radius of the shape.
     * @returns {boolean} Whether to show the details.
     * @protected
     */
    _detailed(center, radius) {

        // fade in rather than pop in
        const size = this._renderer.screenSize(center, radius);
        this._detailFade = this._dragging ? 1 :
            math.clamp((size - DETAIL_FADE_START) / (DETAIL_FADE_END - DETAIL_FADE_START), 0, 1);
        return this._detailFade > 0;
    }

    /**
     * Places a handle that drags along a line or in a plane, with a dashed guide from the origin
     * while hovered or dragged.
     *
     * @param {Vec3} position - The world position.
     * @param {Color} color - The color of the handle when hovered or dragged, and of its guide.
     * @param {GraphNode|null} node - The node the handle edits, or null for a shape gizmo.
     * @param {string} name - The value the handle edits.
     * @param {number} index - The index of the handle among those editing the value.
     * @param {Vec3} origin - A point the edit is measured from, on the line or plane.
     * @param {Vec3} dir - The unit direction of the line, or the normal of the plane.
     * @param {boolean} [inPlane] - Whether the handle moves in a plane.
     * @param {boolean} [guide] - Whether to show the dashed line. Defaults to true for a line.
     * @returns {boolean} Whether the handle is hovered or dragged.
     * @protected
     */
    _handle(position, color, node, name, index, origin, dir, inPlane = false, guide = !inPlane) {
        if (!this.handles) {
            return false;
        }
        const hovered = this._active(node, name, index);

        const handle = this._placed.next();
        handle.shape = this._renderer.handle(position, hovered ? color : null);
        handle.shape.fade = hovered ? 1 : this._detailFade;

        if (hovered && guide) {
            this._renderer.dashed(origin, position, 1, 1, color);
        }
        handle.node = node;
        handle.name = name;
        handle.index = index;
        handle.origin.copy(origin);
        handle.dir.copy(dir);
        handle.plane = inPlane;
        return hovered;
    }

    /**
     * Shows the value of a hovered or dragged handle below it.
     *
     * @param {Vec3} position - The handle position.
     * @param {string} label - The value label.
     * @param {Color} color - The label color.
     * @param {number} value - The value.
     * @param {string} [unit] - The unit after the value.
     * @protected
     */
    _readoutAt(position, label, color, value, unit = '') {
        this._readoutHtmlAt(position, this._readoutValue(label, color, value, unit));
    }

    /**
     * Shows readout markup below a hovered or dragged handle.
     *
     * @param {Vec3} position - The handle position.
     * @param {string} html - The markup, as {@link HandleGizmo#_readoutValue} formats it.
     * @protected
     */
    _readoutHtmlAt(position, html) {
        if (this.readout) {
            const renderer = this._renderer;
            renderer.label(position, html, renderer.handleSize);
        }
    }

    /**
     * Gets whether the handle editing a value is hovered or dragged.
     *
     * @param {GraphNode|null} node - The node the handle edits, or null for a shape gizmo.
     * @param {string} name - The value the handle edits.
     * @param {number} index - The index of the handle among those editing the value.
     * @returns {boolean} Whether the handle is active.
     * @protected
     */
    _active(node, name, index) {
        return this._matches(this._dragging ? this._drag : this._hovered, node, name, index);
    }

    /**
     * Places three great circles of a sphere.
     *
     * @param {Vec3} center - The center of the sphere.
     * @param {Quat} rotation - The rotation of the sphere.
     * @param {number} radius - The radius of the sphere.
     * @param {number} [weight] - The thickness as a factor of the line thickness.
     * @param {number} [alpha] - The alpha factor.
     * @protected
     */
    _sphereRings(center, rotation, radius, weight = 1, alpha = 1) {
        for (let i = 0; i < SPHERE_RINGS.length; i++) {
            this._renderer.ring(center, tmpQ1.copy(rotation).mul(SPHERE_RINGS[i]), radius, weight, alpha);
        }
    }

    /**
     * Places the outline of a sphere, over faint great circles once large enough on screen, or
     * solid rings when the camera is inside it.
     *
     * @param {Vec3} center - The center of the sphere.
     * @param {Quat} rotation - The rotation of the great circles.
     * @param {number} radius - The radius of the sphere.
     * @protected
     */
    _sphereOutline(center, rotation, radius) {
        const camera = this._camera;
        const toCamera = tmpV4.sub2(camera.entity.getPosition(), center);
        const dist = toCamera.length();
        const perspective = camera.projection === PROJECTION_PERSPECTIVE;
        if (perspective && dist <= radius) {
            this._sphereRings(center, rotation, radius);
            return;
        }
        if (this._renderer.screenSize(center, radius) > RINGS_SIZE) {
            this._sphereRings(center, rotation, radius, 0.5, 0.35);
        }
        const size = this._sphereSilhouette(center, radius, tmpV5);
        this._renderer.circle(tmpV5, perspective ? toCamera : camera.entity.forward, size, 1.1);
    }

    /**
     * Gets the outline of a sphere as the camera sees it.
     *
     * @param {Vec3} center - The center of the sphere.
     * @param {number} radius - The radius of the sphere.
     * @param {Vec3} out - Receives the center of the outline.
     * @returns {number} The radius of the outline.
     * @protected
     */
    _sphereSilhouette(center, radius, out) {
        const camera = this._camera;
        if (camera.projection !== PROJECTION_PERSPECTIVE) {
            out.copy(center);
            return radius;
        }
        const toCamera = tmpV3.sub2(camera.entity.getPosition(), center);
        const ratio = radius / toCamera.length();
        out.copy(toCamera).mulScalar(ratio * ratio).add(center);
        return radius * Math.sqrt(1 - ratio * ratio);
    }

    /**
     * Places handles at the ends of a sphere's axes, which drag its radius.
     *
     * @param {Vec3} center - The center of the sphere.
     * @param {Quat} rotation - The rotation of the axes.
     * @param {number} radius - The radius of the sphere.
     * @param {GraphNode|null} node - The node the handles edit, or null for a shape gizmo.
     * @param {string} name - The value the handles edit.
     * @protected
     */
    _sphereHandles(center, rotation, radius, node, name) {
        for (let i = 0; i < SPHERE_AXES.length; i++) {
            const dir = rotation.transformVector(SPHERE_AXES[i], tmpV1);
            const pos = tmpV2.copy(dir).mulScalar(radius).add(center);
            if (this._handle(pos, this._theme.primary, node, name, i, center, dir)) {
                this._readoutAt(pos, 'r', this._theme.primary, radius);
            }
        }
    }

    /**
     * Gets the corners of a box, indexed by their x, y and z bits.
     *
     * @param {Vec3} center - The center of the box.
     * @param {Quat} rotation - The rotation of the box.
     * @param {Vec3} halfExtents - The half extents along the axes of the rotation.
     * @returns {Vec3[]} The world corners, valid until the next call.
     * @protected
     */
    _boxCorners(center, rotation, halfExtents) {
        for (let k = 0; k < 3; k++) {
            rotation.transformVector(BOX_UNITS[k], boxAxes[k]);
        }
        for (let i = 0; i < boxCorners.length; i++) {
            const corner = boxCorners[i].copy(center);
            for (let k = 0; k < 3; k++) {
                corner.add(tmpV1.copy(boxAxes[k]).mulScalar(boxSide(i, k) * halfExtents[BOX_AXES[k]]));
            }
        }
        return boxCorners;
    }

    /**
     * Places the face and corner handles of the box last passed to
     * {@link HandleGizmo#_boxCorners}, once large enough on screen.
     *
     * @param {Vec3} center - The center of the box.
     * @param {Vec3} halfExtents - The half extents.
     * @param {BoxHandleOptions} options - The handles to show.
     * @param {number} [pad] - The padding on each side, left out of the readout extents.
     * @protected
     */
    _boxHandles(center, halfExtents, options, pad = 0) {
        if (!this._detailed(center, Math.max(halfExtents.x, halfExtents.y, halfExtents.z))) {
            return;
        }
        if (options.faceHandles) {
            for (let i = 0; i < BOX_FACES; i++) {
                const k = i >> 1;
                const dir = tmpV2.copy(boxAxes[k]).mulScalar(i & 1 ? -1 : 1);
                const pos = tmpV1.copy(dir).mulScalar(halfExtents[BOX_AXES[k]]).add(center);
                if (this._handle(pos, this._faceColors[k], null, 'size', i, center, dir)) {
                    this._readoutAt(pos, BOX_FACE_LABELS[k], this._faceColors[k], 2 * (halfExtents[BOX_AXES[k]] - pad));
                }
            }
        }
        if (options.cornerHandles) {
            const forward = this._camera.entity.forward;
            for (let i = 0; i < boxCorners.length; i++) {
                const pos = boxCorners[i];
                const hovered = options.uniform ?
                    this._handle(pos, this._theme.corner, null, 'size', BOX_FACES + i, center, tmpV2.sub2(pos, center).normalize()) :
                    this._handle(pos, this._theme.corner, null, 'size', BOX_FACES + i, pos, forward, true);
                if (hovered) {
                    const html = BOX_FACE_LABELS.map((label, k) => this._readoutValue(label, this._faceColors[k], 2 * (halfExtents[BOX_AXES[k]] - pad)));
                    this._readoutHtmlAt(pos, html.join('  '));
                }
            }
        }
    }

    /**
     * Resizes one axis of a box to a dragged face or corner.
     *
     * @param {number} axis - The axis index.
     * @param {number} sign - The side of the dragged face or corner, -1 or 1.
     * @param {Vec3} local - The dragged point relative to the start position, along the box axes.
     * @param {Vec3} start - The half extents at the start of the resize.
     * @param {boolean} centered - Whether the resize keeps the center in place.
     * @param {number} pad - The padding on each side, left out of the snapped extent.
     * @param {Vec3} half - The half extents to set.
     * @param {Vec3} mid - The offset of the center to set, along the box axes.
     * @private
     */
    _resizeBoxAxis(axis, sign, local, start, centered, pad, half, mid) {
        const a = BOX_AXES[axis];
        if (centered) {
            half[a] = this._snapBoxHalf(Math.max(sign * local[a], BOX_MIN_HALF), pad);
            mid[a] = 0;
            return;
        }
        const anchor = -sign * start[a];
        half[a] = this._snapBoxHalf(0.5 * Math.max(sign * (local[a] - anchor), 2 * BOX_MIN_HALF), pad);
        mid[a] = anchor + sign * half[a];
    }

    /**
     * Snaps a half extent so the extent without padding is a multiple of
     * {@link DragGizmo#snapIncrement}.
     *
     * @param {number} half - The half extent, padding included.
     * @param {number} pad - The padding on each side.
     * @returns {number} The half extent.
     * @private
     */
    _snapBoxHalf(half, pad) {
        return this.snap ? 0.5 * this._snapLength(2 * (half - pad)) + pad : half;
    }

    /**
     * Resizes a box to a dragged {@link HandleGizmo#_boxHandles} handle, keeping the opposite face
     * or corner in place, or the center for a centered box.
     *
     * @param {GizmoHandle} handle - The dragged handle.
     * @param {Vec3} point - Where the handle is dragged to.
     * @param {Quat} rotation - The rotation of the box.
     * @param {Vec3} startPosition - The center at the start of the resize.
     * @param {Vec3} startHalfExtents - The half extents at the start of the resize.
     * @param {BoxHandleOptions} options - How the handles resize the box.
     * @param {number} pad - The padding on each side, left out of the snapped extents.
     * @param {Vec3} position - Receives the center.
     * @param {Vec3} halfExtents - Receives the half extents.
     * @protected
     */
    _resizeBox(handle, point, rotation, startPosition, startHalfExtents, options, pad, position, halfExtents) {
        const local = tmpBoxQ.copy(rotation).invert().transformVector(tmpLocal.sub2(point, startPosition), tmpLocal);
        const start = startHalfExtents;
        const half = tmpHalf.copy(start);
        const mid = tmpMid.set(0, 0, 0);
        const { centered } = options;

        if (handle.index < BOX_FACES) {
            this._resizeBoxAxis(handle.index >> 1, handle.index & 1 ? -1 : 1, local, start, centered, pad, half, mid);
        } else if (options.uniform) {

            const corner = handle.index - BOX_FACES;
            const anchor = tmpAnchor.set(-boxSide(corner, 0) * start.x, -boxSide(corner, 1) * start.y, -boxSide(corner, 2) * start.z);
            if (centered) {
                anchor.set(0, 0, 0);
            }
            const from = Math.hypot(boxSide(corner, 0) * start.x - anchor.x, boxSide(corner, 1) * start.y - anchor.y, boxSide(corner, 2) * start.z - anchor.z);
            let factor = Math.max(local.distance(anchor) / from, BOX_MIN_FACTOR);
            if (this.snap) {
                // snap the largest extent and keep the proportions
                const largest = Math.max(start.x, start.y, start.z);
                factor = this._snapBoxHalf(largest * factor, pad) / largest;
            }
            half.mulScalar(factor);
            mid.copy(anchor).mulScalar(1 - factor);
        } else {
            const corner = handle.index - BOX_FACES;
            for (let k = 0; k < 3; k++) {
                this._resizeBoxAxis(k, boxSide(corner, k), local, start, centered, pad, half, mid);
            }
        }

        halfExtents.copy(half);
        position.copy(rotation.transformVector(mid, mid)).add(startPosition);
    }

    /**
     * Places the icon of a node, which fires {@link HandleGizmo.EVENT_ICONSELECT} when clicked.
     *
     * @param {OverlayIcon} kind - The icon.
     * @param {Vec3} position - The world position.
     * @param {GraphNode} node - The node the icon marks.
     * @protected
     */
    _icon(kind, position, node) {
        if (this.icon) {
            this._renderer.icons.add(kind, position, node);
        }
    }

    /**
     * Formats a value with two decimals after a colored label.
     *
     * @param {string} label - The label.
     * @param {Color} color - The label color.
     * @param {number} value - The value.
     * @param {string} [unit] - The unit after the value.
     * @returns {string} The markup.
     * @protected
     */
    _readoutValue(label, color, value, unit = '') {
        return `${this._labelMarkup(label, color)} ${value.toFixed(2)}${unit}`;
    }

    /**
     * Places the shapes of the attached nodes. Implemented by the subclass.
     *
     * @protected
     */
    _drawShapes() {
    }

    /**
     * Stores the values a handle edits at the start of a drag. Implemented by the subclass.
     *
     * @param {GizmoHandle} handle - The dragged handle.
     * @protected
     */
    _startHandle(handle) {
    }

    /**
     * Edits the value of the dragged handle. Implemented by the subclass.
     *
     * @param {GizmoHandle} handle - The dragged handle.
     * @param {Vec3} point - Where the handle is dragged to, on its line.
     * @protected
     */
    _moveHandle(handle, point) {
    }

    /**
     * Places the shapes of the attached nodes.
     *
     * @override
     */
    prerender() {
        const renderer = this._renderer;
        this._placed.count = 0;
        if (!this.enabled) {
            renderer.clear();
            return;
        }

        renderer.begin();
        this._drawShapes();
        renderer.end();
    }

    /**
     * Destroys the gizmo and its shapes.
     *
     * @override
     */
    destroy() {
        this._renderer.destroy();

        super.destroy();
    }
}

export { HandleGizmo };

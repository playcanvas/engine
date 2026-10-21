import { Color } from '../../core/math/color.js';
import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Plane } from '../../core/shape/plane.js';
import { PROJECTION_PERSPECTIVE } from '../../scene/constants.js';
import { Gizmo } from './gizmo.js';
import { HelperShapes } from './helper-shapes.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { GraphNode } from '../../scene/graph-node.js'
 * @import { Layer } from '../../scene/layer.js'
 * @import { MeshInstance } from '../../scene/mesh-instance.js'
 * @import { Shape } from './shape/shape.js'
 */

/**
 * @typedef {object} HelperGizmoTheme
 * @property {Color} base - The color where the shapes are visible.
 * @property {Color} occluded - The color where the scene hides the shapes.
 * @property {Color} fill - The color of filled volumes. An alpha of 0 skips the volumes.
 */

/**
 * A handle placed this frame, or the one being dragged.
 *
 * @typedef {object} HelperHandle
 * @property {Shape|null} shape - The handle shape.
 * @property {GraphNode|null} node - The node the handle edits.
 * @property {string} name - The value the handle edits.
 * @property {number} index - The index of the handle among those editing the value.
 * @property {Vec3} origin - A point the edit is measured from, on the line or plane the handle
 * moves in.
 * @property {Vec3} dir - The unit direction of the line, or the normal of the plane.
 * @property {boolean} plane - Whether the handle moves in a plane, along a curve the gizmo draws,
 * rather than along a line.
 * @ignore
 */

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();
const plane = new Plane();

const DETAIL_FADE_START = 60;
const DETAIL_FADE_END = 100;

const THEME_KEYS = /** @type {const} */ (['base', 'occluded', 'fill']);


/**
 * @returns {HelperHandle} A new handle record.
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
 * The base class of gizmos that draw helper shapes, such as the frustum of a camera or the shape
 * of a light, around world-sized geometry. Lines and rings keep a constant thickness on screen,
 * and once a shape is large enough on screen, handles that drag to edit its values and a readout
 * of those values show.
 *
 * Use a layer that keeps the scene depth so occluded parts draw in the theme's `occluded` color;
 * a {@link Gizmo.createLayer} layer clears depth.
 *
 * @category Gizmo
 */
class HelperGizmo extends Gizmo {
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
     * Fired when the icon of a node is clicked, so an app can select the node.
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
     * @type {HelperGizmoTheme}
     * @protected
     */
    _theme = {
        base: Color.WHITE.clone(),
        occluded: new Color(1, 1, 1, 0.2),
        fill: new Color(1, 1, 1, 0.05)
    };

    /**
     * Whether to show handles that drag to edit the shapes, once a shape is large enough on
     * screen. Defaults to true.
     *
     * @type {boolean}
     */
    handles = true;

    /**
     * Whether to show the value a handle edits just below it, while the handle is hovered or
     * dragged. Defaults to true.
     *
     * @type {boolean}
     */
    readout = true;

    /**
     * Whether to show an icon at the position of each node, a glyph of a constant size on screen.
     * Defaults to true.
     *
     * @type {boolean}
     */
    icon = true;

    /**
     * Whether to draw only the icon of each node, as for nodes that are not selected. Defaults to
     * false.
     *
     * @type {boolean}
     */
    iconOnly = false;

    /**
     * The icons placed this frame, with the nodes they mark.
     *
     * @type {{ shape: Shape, node: GraphNode }[]}
     * @private
     */
    _icons = [];

    /** @private */
    _iconCount = 0;

    /**
     * The helper shapes.
     *
     * @type {HelperShapes}
     * @protected
     */
    _shapes;

    /**
     * The handles placed this frame.
     *
     * @type {HelperHandle[]}
     * @private
     */
    _placed = [];

    /** @private */
    _placedCount = 0;

    /**
     * The hovered handle, matched by what it edits.
     *
     * @type {HelperHandle}
     * @private
     */
    _hovered = createHandle();

    /**
     * The dragged handle, its origin and direction kept from the start of the drag.
     *
     * @type {HelperHandle}
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
     * The fade of the handles of the shape being drawn, as set by {@link HelperGizmo#_detailed}.
     *
     * @private
     */
    _detailFade = 1;

    /**
     * The offset from the pointer to the dragged handle, so it does not jump when grabbed.
     *
     * @private
     */
    _dragOffset = new Vec3();

    /**
     * Creates a new HelperGizmo object.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The render layer.
     * @param {string} [name] - The name of the gizmo.
     */
    constructor(camera, layer, name = 'gizmo:helper') {
        super(camera, layer, name);

        this._shapes = new HelperShapes(this, this._theme);

        this.on(Gizmo.EVENT_POINTERDOWN, (x, y, meshInstance) => {
            if (this._dragging || !meshInstance) {
                return;
            }
            const handle = this._find(meshInstance);
            if (!handle) {
                for (let i = 0; i < this._iconCount; i++) {
                    if (this._icons[i].shape.meshInstances[0] === meshInstance) {
                        this.fire(HelperGizmo.EVENT_ICONSELECT, this._icons[i].node);
                        return;
                    }
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
            this.fire(HelperGizmo.EVENT_HANDLESTART, this._drag.node, this._drag.name);
        });

        this.on(Gizmo.EVENT_POINTERMOVE, (x, y, meshInstance) => {
            if (!this._dragging) {
                const handle = this._find(meshInstance);
                if (handle) {
                    this._copy(handle, this._hovered);
                } else {
                    this._hovered.node = null;
                }
                return;
            }
            const point = this._pointerPoint(x, y);
            if (point) {
                this._moveHandle(this._drag, point.add(this._dragOffset));
                this.fire(HelperGizmo.EVENT_HANDLEMOVE, this._drag.node, this._drag.name);
            }
        });

        this.on(Gizmo.EVENT_POINTERUP, () => {
            this._endDrag();
        });

        this.on(Gizmo.EVENT_NODESDETACH, () => {
            this._hovered.node = null;
            this._endDrag();
        });
    }

    /**
     * Sets the line thickness in CSS pixels. Defaults to 2.
     *
     * @type {number}
     */
    set lineThickness(value) {
        this._shapes.lineThickness = value;
    }

    /**
     * Gets the line thickness in CSS pixels.
     *
     * @type {number}
     */
    get lineThickness() {
        return this._shapes.lineThickness;
    }

    /**
     * Sets the handle size in CSS pixels. Defaults to 7.
     *
     * @type {number}
     */
    set handleSize(value) {
        this._shapes.handleSize = value;
    }

    /**
     * Gets the handle size in CSS pixels.
     *
     * @type {number}
     */
    get handleSize() {
        return this._shapes.handleSize;
    }

    /**
     * Gets the current theme for the gizmo.
     *
     * @type {HelperGizmoTheme}
     */
    get theme() {
        return this._theme;
    }

    /**
     * Sets the theme or partial theme for the gizmo.
     *
     * @param {Partial<HelperGizmoTheme>} partial - The partial theme to set.
     * @example
     * gizmo.setTheme({ occluded: new Color(1, 1, 1, 0.5) });
     */
    setTheme(partial) {
        for (let i = 0; i < THEME_KEYS.length; i++) {
            const key = THEME_KEYS[i];
            const color = partial?.[key];
            if (color instanceof Color) {
                this._theme[key].copy(color);
            }
        }
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
     * @param {HelperHandle} from - The handle to copy.
     * @param {HelperHandle} to - The handle to copy into.
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
     * @param {HelperHandle} a - A handle.
     * @param {GraphNode} node - The node the other handle edits.
     * @param {string} name - The value the other handle edits.
     * @param {number} index - The index of the other handle.
     * @returns {boolean} Whether the handles edit the same value.
     * @private
     */
    _matches(a, node, name, index) {
        return a.node === node && a.name === name && a.index === index;
    }

    /**
     * @param {MeshInstance} [meshInstance] - The picked mesh instance.
     * @returns {HelperHandle|null} The handle placed this frame that was picked.
     * @private
     */
    _find(meshInstance) {
        if (!meshInstance) {
            return null;
        }
        for (let i = 0; i < this._placedCount; i++) {
            if (this._placed[i].shape?.meshInstances[0] === meshInstance) {
                return this._placed[i];
            }
        }
        return null;
    }

    /**
     * Gets the point of the dragged handle's line or plane under the pointer. As for a transform
     * gizmo axis, the pointer ray meets a plane that holds the line and faces the camera, and the
     * hit is projected onto the line.
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
        const side = tmpV3.cross(dir, facing);
        if (side.lengthSq() < 1e-8) {
            return null;
        }
        const normal = side.cross(side, dir).normalize();
        if (!plane.setFromPointNormal(origin, normal).intersectsRay(ray, tmpV1)) {
            return null;
        }
        const along = tmpV2.sub2(tmpV1, origin).dot(dir);
        return tmpV1.copy(dir).mulScalar(along).add(origin);
    }

    /** @private */
    _endDrag() {
        if (!this._dragging) {
            return;
        }
        this._dragging = false;
        this.fire(HelperGizmo.EVENT_HANDLEEND, this._drag.node, this._drag.name);
        this._drag.node = null;
    }

    /**
     * Gets whether a shape is large enough on screen to show its handles, which fade in as it grows
     * and which a drag keeps shown in full.
     *
     * @param {Vec3} center - The center of the shape.
     * @param {number} radius - The radius of the shape.
     * @returns {boolean} Whether to show the details.
     * @protected
     */
    _detailed(center, radius) {
        // the handles fade in as the shape grows on screen, rather than appearing at a size
        const size = this._shapes.screenSize(center, radius);
        this._detailFade = this._dragging ? 1 :
            math.clamp((size - DETAIL_FADE_START) / (DETAIL_FADE_END - DETAIL_FADE_START), 0, 1);
        return this._detailFade > 0;
    }

    /**
     * Places a handle, which drags along a line or in a plane. While it is hovered or dragged, a
     * dashed line in its color runs from the origin to the handle, unless the gizmo already draws
     * the path, which the subclass colors instead.
     *
     * @param {Vec3} position - The world position.
     * @param {GraphNode} node - The node the handle edits.
     * @param {string} name - The value the handle edits.
     * @param {number} index - The index of the handle among those editing the value.
     * @param {Color} color - The color of the handle when hovered or dragged, and of its guide.
     * @param {GraphNode} node - The node the handle edits.
     * @param {string} name - The value the handle edits.
     * @param {number} index - The index of the handle among those editing the value.
     * @param {Vec3} origin - A point the edit is measured from, on the line or plane.
     * @param {Vec3} dir - The unit direction of the line, or the normal of the plane.
     * @param {boolean} [inPlane] - Whether the handle moves in a plane.
     * @param {boolean} [guide] - Whether to show the dashed line. Defaults to true for a line.
     * @returns {boolean} Whether the handle is hovered or dragged, when the subclass shows the
     * value it edits with {@link HelperGizmo#_readoutAt}.
     * @protected
     */
    _handle(position, color, node, name, index, origin, dir, inPlane = false, guide = !inPlane) {
        if (!this.handles) {
            return false;
        }
        const hovered = this._active(node, name, index);

        let handle = this._placed[this._placedCount];
        if (!handle) {
            handle = createHandle();
            this._placed.push(handle);
        }
        this._placedCount++;
        handle.shape = this._shapes.handle(position, hovered ? color : null);
        handle.shape.fade = hovered ? 1 : this._detailFade;

        if (hovered && guide) {
            this._shapes.dashed(origin, position, 1, 1, color);
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
     * Shows the value a hovered or dragged handle edits, below the handle.
     *
     * @param {Vec3} position - The handle position.
     * @param {string} label - The value label, as {@link HelperGizmo#_readoutLabel} formats it.
     * @param {Color} color - The label color.
     * @param {string} value - The value.
     * @protected
     */
    _readoutAt(position, label, color, value) {
        if (this.readout) {
            const shapes = this._shapes;
            shapes.label(position, `${this._readoutLabel(label, color)} ${value}`, shapes.handleSize);
        }
    }

    /**
     * Gets whether the handle editing a value is hovered, or dragged.
     *
     * @param {GraphNode} node - The node the handle edits.
     * @param {string} name - The value the handle edits.
     * @param {number} index - The index of the handle among those editing the value.
     * @returns {boolean} Whether the handle is active.
     * @protected
     */
    _active(node, name, index) {
        return this._matches(this._dragging ? this._drag : this._hovered, node, name, index);
    }

    /**
     * Places the icon of a node, which fires {@link HelperGizmo.EVENT_ICONSELECT} when clicked.
     *
     * @param {'light' | 'camera'} kind - The icon.
     * @param {Vec3} position - The world position.
     * @param {GraphNode} node - The node the icon marks.
     * @protected
     */
    _icon(kind, position, node) {
        if (!this.icon) {
            return;
        }
        let icon = this._icons[this._iconCount];
        if (!icon) {
            icon = { shape: /** @type {Shape} */ (/** @type {unknown} */ (null)), node };
            this._icons.push(icon);
        }
        this._iconCount++;
        icon.shape = this._shapes.icon(kind, position);
        icon.node = node;
    }

    /**
     * Wraps a readout label in the markup of a colored label, as the transform readout does for
     * its axes.
     *
     * @param {string} text - The label.
     * @param {Color} color - The label color.
     * @returns {string} The markup.
     * @protected
     */
    _readoutLabel(text, color) {
        return `<b style="color: ${color.toString(false)}">${text}</b>`;
    }

    /**
     * Places the shapes of the attached nodes. Implemented by the subclass.
     *
     * @protected
     */
    _drawShapes() {
    }

    /**
     * Called when a handle starts being dragged, to keep the values it edits from. Implemented by
     * the subclass.
     *
     * @param {HelperHandle} handle - The dragged handle.
     * @protected
     */
    _startHandle(handle) {
    }

    /**
     * Edits the value of the dragged handle. Implemented by the subclass.
     *
     * @param {HelperHandle} handle - The dragged handle.
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
        const shapes = this._shapes;
        this._placedCount = 0;
        this._iconCount = 0;
        if (!this.enabled) {
            shapes.clear();
            return;
        }

        shapes.begin();
        this._drawShapes();
        shapes.end();
    }

    /**
     * Destroys the gizmo and its shapes.
     *
     * @override
     */
    destroy() {
        this._shapes.destroy();

        super.destroy();
    }
}

export { HelperGizmo };

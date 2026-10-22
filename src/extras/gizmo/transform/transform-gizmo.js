import { math } from '../../../core/math/math.js';
import { Color } from '../../../core/math/color.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { BoundingBox } from '../../../core/shape/bounding-box.js';
import { Plane } from '../../../core/shape/plane.js';
import { Entity } from '../../../framework/entity.js';

import {
    COLOR_RED,
    COLOR_GREEN,
    COLOR_BLUE,
    COLOR_GRAY,
    color4from3
} from '../color.js';
import { LAYERID_IMMEDIATE } from '../../../scene/constants.js';
import { DragGizmo } from '../drag-gizmo.js';
import { Gizmo } from '../gizmo.js';
import { OverlayRenderer } from '../overlay/overlay-renderer.js';
import { Readout } from '../overlay/readout.js';
import { Debug } from '../../../core/debug.js';

/**
 * @import { Shape } from '../shape/shape.js'
 * @import { CameraComponent } from '../../../framework/components/camera/component.js'
 * @import { Layer } from '../../../scene/layer.js'
 * @import { MeshInstance } from '../../../scene/mesh-instance.js'
 * @import { GizmoAxis, GizmoDragMode } from '../constants.js'
 */

const GLANCE_EPSILON = 0.01;
const GLANCE_ANGLE = Math.acos(1 - GLANCE_EPSILON);

/**
 * @typedef {object} GizmoTheme
 * @property {{ [K in 'x' | 'y' | 'z' | 'f' | 'xyz']: Color }} shapeBase - The axis colors.
 * @property {{ [K in 'x' | 'y' | 'z' | 'f' | 'xyz']: Color }} shapeHover - The hover colors.
 * @property {{ [K in 'x' | 'y' | 'z']: Color }} guideBase - The guide line colors.
 * @property {number} guideOcclusion - The guide occlusion value. Defaults to 0.8.
 * @property {Color} disabled - The disabled color.
 */

const v1 = new Vec3();
const v2 = new Vec3();
const point = new Vec3();
const plane = new Plane();
const bounds = new BoundingBox();
const corner = new Vec3();
const screen = new Vec3();

const AXES = /** @type {('x' | 'y' | 'z')[]} */ (['x', 'y', 'z']);

/**
 * The base class of {@link TranslateGizmo}, {@link RotateGizmo} and {@link ScaleGizmo}. It
 * provides the axis, plane and center shapes, the transform events, {@link snap},
 * {@link dragMode} and a color {@link theme}; subclasses decide what a drag does to the nodes.
 *
 * @category Gizmo
 */
class TransformGizmo extends DragGizmo {
    /**
     * Fired when the transformation has started.
     *
     * @event
     * @example
     * const gizmo = new TransformGizmo(camera, layer);
     * gizmo.on('transform:start', () => {
     *     console.log('Transformation started');
     * });
     */
    static EVENT_TRANSFORMSTART = 'transform:start';

    /**
     * Fired during the transformation with the dragged point and the pointer's screen position.
     *
     * @event
     * @example
     * const gizmo = new TransformGizmo(camera, layer);
     * gizmo.on('transform:move', (point, x, y) => {
     *     console.log(`Transformation moved to ${point} (screen: ${x}, ${y})`);
     * });
     */
    static EVENT_TRANSFORMMOVE = 'transform:move';

    /**
     * Fired with the readout value at the start and each step of the transformation, even with
     * {@link TransformGizmo#readout} off. The handler gets the axis, whether it is a plane, and the
     * value: a `Vec3` translation or scale factor, or an angle in degrees. Copy the reused `Vec3`
     * to keep it.
     *
     * @event
     * @example
     * const gizmo = new TranslateGizmo(camera, layer);
     * gizmo.readout = false;
     * gizmo.on('transform:readout', (axis, isPlane, value) => {
     *     console.log(`Transformation ${axis}: ${value}`);
     * });
     */
    static EVENT_TRANSFORMREADOUT = 'transform:readout';

    /**
     * Fired when the transformation has ended.
     *
     * @event
     * @example
     * const gizmo = new TransformGizmo(camera, layer);
     * gizmo.on('transform:end', () => {
     *     console.log('Transformation ended');
     * });
     */
    static EVENT_TRANSFORMEND = 'transform:end';

    /**
     * Internal theme.
     *
     * @type {GizmoTheme}
     * @protected
     */
    _theme = {
        shapeBase: {
            x: COLOR_RED.clone(),
            y: COLOR_GREEN.clone(),
            z: COLOR_BLUE.clone(),
            xyz: new Color(0.8, 0.8, 0.8, 1),
            f: new Color(0.8, 0.8, 0.8, 1)
        },
        shapeHover: {
            x: new Color().lerp(COLOR_RED, Color.WHITE, 0.75),
            y: new Color().lerp(COLOR_GREEN, Color.WHITE, 0.75),
            z: new Color().lerp(COLOR_BLUE, Color.WHITE, 0.75),
            xyz: Color.WHITE.clone(),
            f: Color.WHITE.clone()
        },
        guideBase: {
            x: COLOR_RED.clone(),
            y: COLOR_GREEN.clone(),
            z: COLOR_BLUE.clone()
        },
        guideOcclusion: 0.8,
        disabled: COLOR_GRAY.clone()
    };

    /**
     * The gizmo position at the start of a drag.
     *
     * @protected
     */
    _rootStartPos = new Vec3();

    /**
     * The gizmo rotation at the start of a drag.
     *
     * @protected
     */
    _rootStartRot = new Quat();

    /**
     * The gizmo shapes.
     *
     * @type {{ [key in GizmoAxis]?: Shape }}
     * @protected
     */
    _shapes = {};

    /**
     * The shapes by mesh instance.
     *
     * @type {Map<MeshInstance, Shape>}
     * @private
     */
    _shapeMap = new Map();

    /**
     * The guide line colors, whose rgb each guide replaces with its axis color.
     *
     * @private
     */
    _guideTheme = {
        base: Color.WHITE.clone(),
        occluded: Color.WHITE.clone(),
        fill: new Color(1, 1, 1, 0)
    };

    /**
     * The parent of the guide lines.
     *
     * @type {Entity}
     * @private
     */
    _guideRoot;

    /**
     * The guide lines.
     *
     * @type {OverlayRenderer}
     * @private
     */
    _guides;

    /**
     * The angle in degrees between the view and a shape below which it fades out.
     *
     * @protected
     */
    _fadeAngle = 25;

    /**
     * The hovered axes.
     *
     * @type {Set<GizmoAxis>}
     * @private
     */
    _hovering = new Set();

    /**
     * The hovered axis.
     *
     * @type {GizmoAxis | ''}
     * @private
     */
    _hoverAxis = '';

    /**
     * Whether the hovered shape is a plane.
     *
     * @private
     */
    _hoverIsPlane = false;

    /**
     * The selected axis.
     *
     * @type {GizmoAxis | ''}
     * @protected
     */
    _selectedAxis = '';

    /**
     * Whether the selected shape is a plane.
     *
     * @protected
     */
    _selectedIsPlane = false;

    /**
     * The selected point at the start of a drag, in world space.
     *
     * @protected
     */
    _selectionStartPoint = new Vec3();

    /**
     * The readout of the drag delta.
     *
     * @type {Readout | null}
     * @protected
     */
    _readout = null;

    /**
     * Whether to hide the shapes when dragging. Defaults to 'selected'.
     *
     * @type {GizmoDragMode}
     */
    dragMode = 'selected';

    /**
     * Creates a new TransformGizmo object.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The render layer.
     * @param {string} [name] - The name of the gizmo.
     * @example
     * const gizmo = new TransformGizmo(camera, layer);
     */
    constructor(camera, layer, name = 'gizmo:transform') {
        super(camera, layer, name);

        // guides sit on an unrotated root in the immediate layer, whose depth lets the scene hide them,
        // or follow the gizmo layer without one
        this._guideRoot = new Entity('guides');
        this._app.root.addChild(this._guideRoot);
        const guideLayer = this._app.scene.layers.getLayerById(LAYERID_IMMEDIATE);
        this._guides = new OverlayRenderer(this, this._guideTheme, this._guideRoot, guideLayer);
        this._guides.lineThickness = 1;

        this.readout = true;

        this.on(Gizmo.EVENT_POINTERDOWN, (x, y, meshInstance) => {
            const shape = this._shapeMap.get(meshInstance);
            if (shape?.disabled) {
                return;
            }

            if (this._dragging) {
                return;
            }

            if (!meshInstance) {
                return;
            }

            this._hoverAxis = '';
            this._hoverIsPlane = false;
            this._selectedAxis = this._getAxis(meshInstance);
            this._selectedIsPlane =  this._getIsPlane(meshInstance);

            this._rootStartPos.copy(this.root.getLocalPosition());
            this._rootStartRot.copy(this.root.getRotation());
            const point = this._screenToPoint(x, y);
            this._selectionStartPoint.copy(point);

            this.fire(TransformGizmo.EVENT_TRANSFORMSTART, point, x, y);

        });

        this.on(Gizmo.EVENT_POINTERMOVE, (x, y, meshInstance) => {
            const shape = this._shapeMap.get(meshInstance);
            if (shape?.disabled) {
                return;
            }

            this._hover(meshInstance);

            if (!this._dragging) {
                return;
            }

            const point = this._screenToPoint(x, y);

            this.fire(TransformGizmo.EVENT_TRANSFORMMOVE, point, x, y);
        });

        this.on(Gizmo.EVENT_POINTERUP, (_x, _y, meshInstance) => {
            this._hover(meshInstance);

            if (!this._dragging) {
                return;
            }

            if (meshInstance) {
                this._hoverAxis = this._selectedAxis;
                this._hoverIsPlane = this._selectedIsPlane;
            }
            this._selectedAxis = '';
            this._selectedIsPlane = false;

            this.fire(TransformGizmo.EVENT_TRANSFORMEND);
        });

        this.on(TransformGizmo.EVENT_TRANSFORMEND, () => {
            this._readout?.hide();
        });

        this.on(Gizmo.EVENT_NODESDETACH, () => {
            this._hoverAxis = '';
            this._hoverIsPlane = false;
            this._hover();
            this.fire(Gizmo.EVENT_POINTERUP);
        });
    }

    /**
     * Gets the current theme for the gizmo.
     *
     * @type {GizmoTheme}
     */
    get theme() {
        return this._theme;
    }

    /**
     * Sets the thickness of the guide lines in CSS pixels. Defaults to 1.
     *
     * @type {number}
     */
    set guideThickness(value) {
        this._guides.lineThickness = value;
    }

    /**
     * Gets the thickness of the guide lines in CSS pixels.
     *
     * @type {number}
     */
    get guideThickness() {
        return this._guides.lineThickness;
    }

    /**
     * Sets whether to show the drag delta in a `div.gizmo-readout` below the gizmo. For a custom
     * UI, turn this off and listen to {@link TransformGizmo.EVENT_TRANSFORMREADOUT}. Defaults to
     * true.
     *
     * @type {boolean}
     */
    set readout(value) {
        if (value === !!this._readout) {
            return;
        }
        if (!value) {
            this._readout?.destroy();
            this._readout = null;
            return;
        }
        this._readout = new Readout(this._device.canvas);
    }

    /**
     * Gets whether to show the drag delta below the gizmo.
     *
     * @type {boolean}
     */
    get readout() {
        return !!this._readout;
    }

    /**
     * @type {Color}
     * @deprecated Use {@link setTheme} instead.
     * @ignore
     */
    set xAxisColor(value) {
        this.setTheme({
            shapeBase: {
                x: value
            },
            shapeHover: {
                x: color4from3(value, this.colorAlpha)
            },
            guideBase: {
                x: value
            },
            guideOcclusion: 1
        });
    }

    /**
     * @type {Color}
     * @deprecated Use {@link theme} instead.
     * @ignore
     */
    get xAxisColor() {
        return this._theme.shapeBase.x;
    }

    /**
     * @type {Color}
     * @deprecated Use {@link setTheme} instead.
     * @ignore
     */
    set yAxisColor(value) {
        this.setTheme({
            shapeBase: {
                y: value
            },
            shapeHover: {
                y: color4from3(value, this.colorAlpha)
            },
            guideBase: {
                y: value
            },
            guideOcclusion: 1
        });
    }

    /**
     * @type {Color}
     * @deprecated Use {@link theme} instead.
     * @ignore
     */
    get yAxisColor() {
        return this._theme.shapeBase.y;
    }

    /**
     * @type {Color}
     * @deprecated Use {@link setTheme} instead.
     * @ignore
     */
    set zAxisColor(value) {
        this.setTheme({
            shapeBase: {
                z: value
            },
            shapeHover: {
                z: color4from3(value, this.colorAlpha)
            },
            guideBase: {
                z: value
            },
            guideOcclusion: 1
        });
    }

    /**
     * @type {Color}
     * @deprecated Use {@link theme} instead.
     * @ignore
     */
    get zAxisColor() {
        return this._theme.shapeBase.z;
    }

    /**
     * @type {number}
     * @deprecated Use {@link setTheme} instead.
     * @ignore
     */
    set colorAlpha(value) {
        this.setTheme({
            shapeHover: {
                x: color4from3(this._theme.shapeHover.x, value),
                y: color4from3(this._theme.shapeHover.y, value),
                z: color4from3(this._theme.shapeHover.z, value),
                xyz: color4from3(this._theme.shapeHover.xyz, value),
                f: color4from3(this._theme.shapeHover.f, value)
            }
        });
    }

    /**
     * @type {number}
     * @deprecated Use {@link theme} instead.
     * @ignore
     */
    get colorAlpha() {
        return (
            this._theme.shapeHover.x.a +
            this._theme.shapeHover.y.a +
            this._theme.shapeHover.z.a +
            this._theme.shapeHover.xyz.a +
            this._theme.shapeHover.f.a
        ) / 5;
    }

    /**
     * @type {boolean}
     * @protected
     */
    get _dragging() {
        return !this._hoverAxis && !!this._selectedAxis;
    }

    /**
     * @param {MeshInstance} [meshInstance] - The mesh instance.
     * @returns {GizmoAxis | ''} - The axis.
     * @private
     */
    _getAxis(meshInstance) {
        if (!meshInstance) {
            return '';
        }
        return /** @type {GizmoAxis | ''} */ (meshInstance.node.name.split(':')[1]);
    }

    /**
     * @param {MeshInstance} [meshInstance] - The mesh instance.
     * @returns {boolean} - Whether the mesh instance is a plane.
     * @private
     */
    _getIsPlane(meshInstance) {
        if (!meshInstance) {
            return false;
        }
        return meshInstance.node.name.indexOf('plane') !== -1;
    }

    /**
     * Formats an axis letter in the axis color.
     *
     * @param {GizmoAxis} axis - The axis.
     * @returns {string} The label markup.
     * @protected
     */
    _readoutLabel(axis) {
        return this._labelMarkup(axis.toUpperCase(), this._theme.shapeBase[axis]);
    }

    /**
     * Formats a delta with an explicit sign, positive when it rounds to zero.
     *
     * @param {number} value - The value.
     * @param {number} digits - The number of digits after the decimal point.
     * @returns {string} The signed value.
     * @protected
     */
    _readoutDelta(value, digits) {
        const abs = Math.abs(value).toFixed(digits);
        return `${value < 0 && +abs ? '-' : '+'}${abs}`;
    }

    /**
     * Formats a value for each of the axes being dragged.
     *
     * @param {Vec3} values - The value for each axis.
     * @param {boolean} [factor] - Whether the values are factors, not deltas. Defaults to false.
     * @returns {string} The readout markup.
     * @protected
     */
    _readoutAxes(values, factor = false) {
        const axis = this._selectedAxis;
        const parts = [];
        for (let i = 0; i < AXES.length; i++) {
            const a = AXES[i];
            if (axis === 'xyz' || (this._selectedIsPlane ? a !== axis : a === axis)) {
                const value = factor ? `×${values[a].toFixed(2)}` : this._readoutDelta(values[a], 2);
                parts.push(`${this._readoutLabel(a)} ${value}`);
            }
        }
        return parts.join('  ');
    }

    /**
     * Shows the readout centered below the visible shapes.
     *
     * @param {string} html - The readout markup.
     * @protected
     */
    _showReadout(html) {
        let found = false;
        for (const key in this._shapes) {
            const shape = this._shapes[key];
            if (!shape.entity.enabled) {
                continue;
            }
            for (let i = 0; i < shape.meshInstances.length; i++) {
                const instance = shape.meshInstances[i];
                if (!instance.visible) {
                    continue;
                }
                if (found) {
                    bounds.add(instance.aabb);
                    continue;
                }
                bounds.copy(instance.aabb);
                found = true;
            }
        }

        // with every shape hidden, sit below the gizmo center
        if (!found) {
            bounds.center.copy(this.root.getPosition());
            bounds.halfExtents.set(0, 0, 0);
        }

        const { center, halfExtents: half } = bounds;
        let left = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;
        for (let i = 0; i < 8; i++) {
            corner.set(
                center.x + (i & 1 ? half.x : -half.x),
                center.y + (i & 2 ? half.y : -half.y),
                center.z + (i & 4 ? half.z : -half.z)
            );
            this._camera.worldToScreen(corner, screen);
            left = Math.min(left, screen.x);
            right = Math.max(right, screen.x);
            bottom = Math.max(bottom, screen.y);
        }
        this._readout?.show(html, 0.5 * (left + right), bottom);
    }

    /**
     * @param {MeshInstance} [meshInstance] - The mesh instance.
     * @private
     */
    _hover(meshInstance) {
        if (this._dragging) {
            return;
        }

        const remove = new Set(this._hovering);
        let changed = false;
        const add = (/** @type {GizmoAxis} */ axis) => {
            if (remove.has(axis)) {
                remove.delete(axis);
            } else {
                this._hovering.add(axis);
                this._shapes[axis]?.hover(true);
                changed = true;
            }
        };

        this._hoverAxis = this._getAxis(meshInstance);
        this._hoverIsPlane = this._getIsPlane(meshInstance);

        if (this._hoverAxis) {
            if (this._hoverAxis === 'xyz') {
                add('x');
                add('y');
                add('z');
                add('xyz');
            } else if (this._hoverIsPlane) {
                switch (this._hoverAxis) {
                    case 'x': {
                        add('y');
                        add('z');
                        add('yz');
                        break;
                    }
                    case 'y': {
                        add('x');
                        add('z');
                        add('xz');
                        break;
                    }
                    case 'z': {
                        add('x');
                        add('y');
                        add('xy');
                        break;
                    }
                }
            } else {
                add(this._hoverAxis);
            }
        }

        for (const axis of remove) {
            this._hovering.delete(axis);
            this._shapes[axis]?.hover(false);
            changed = true;
        }

        if (changed) {
            this._renderUpdate = true;
        }
    }

    /**
     * @param {string} axis - The axis to create the plane for.
     * @param {boolean} isFacing - Whether the axis is facing the camera.
     * @param {boolean} isLine - Whether the axis is a line.
     * @returns {Plane} - The plane.
     * @protected
     */
    _createPlane(axis, isFacing, isLine) {
        const facingDir = v1.copy(this.facingDir);
        const normal = plane.normal.set(0, 0, 0);

        if (isFacing) {
            normal.copy(this._camera.entity.forward).mulScalar(-1);
        } else {
            normal[axis] = 1;
            this._rootStartRot.transformVector(normal, normal);

            if (isLine) {
                // face the camera but stay perpendicular to the axis
                this._lineNormal(normal, facingDir, normal);
            }
        }

        return plane.setFromPointNormal(this._rootStartPos, normal);
    }

    /**
     * @param {string} axis - The axis
     * @param {Vec3} dir - The direction
     * @returns {Vec3} - The direction
     * @protected
     */
    _dirFromAxis(axis, dir) {
        if (axis === 'f') {
            dir.copy(this._camera.entity.forward).mulScalar(-1);
        } else {
            dir.set(0, 0, 0);
            dir[axis] = 1;
        }
        return dir;
    }

    /**
     * @param {Vec3} point - The point to project.
     * @param {string} axis - The axis to project to.
     * @protected
     */
    _projectToAxis(point, axis) {
        v1.set(0, 0, 0);
        v1[axis] = 1;
        point.copy(v1.mulScalar(v1.dot(point)));

        // zero the other axes against float error
        const v = point[axis];
        point.set(0, 0, 0);
        point[axis] = v;
    }

    /**
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @param {boolean} isFacing - Whether the axis is facing the camera.
     * @param {boolean} isLine - Whether the axis is a line.
     * @returns {Vec3} The point (space is {@link Gizmo#coordSpace}).
     * @protected
     */
    _screenToPoint(x, y, isFacing = false, isLine = false) {
        const mouseWPos = this._camera.screenToWorld(x, y, 1);

        const axis = this._selectedAxis;

        const ray = this._createRay(mouseWPos);
        const plane = this._createPlane(axis, isFacing, isLine);
        if (!plane.intersectsRay(ray, point)) {
            return point;
        }

        return point;
    }

    /**
     * @param {Vec3} pos - The position.
     * @param {Quat} rot - The rotation.
     * @param {GizmoAxis | ''} activeAxis - The active axis.
     * @param {boolean} activeIsPlane - Whether the active axis is a plane.
     * @protected
     */
    _drawGuideLines(pos, rot, activeAxis, activeIsPlane) {
        for (const axis of AXES) {
            if (activeAxis === 'xyz') {
                this._drawSpanLine(pos, rot, axis);
                continue;
            }
            if (activeIsPlane) {
                if (axis !== activeAxis) {
                    this._drawSpanLine(pos, rot, axis);
                }
            } else {
                if (axis === activeAxis) {
                    this._drawSpanLine(pos, rot, axis);
                }
            }
        }
    }

    /**
     * @param {Vec3} pos - The position.
     * @param {Quat} rot - The rotation.
     * @param {'x' | 'y' | 'z'} axis - The axis.
     * @protected
     */
    _drawSpanLine(pos, rot, axis) {
        const dir = this._dirFromAxis(axis, v1);
        const base = this._theme.guideBase[axis];
        const from = v1.copy(dir).mulScalar(this._camera.farClip - this._camera.nearClip);
        const to = v2.copy(from).mulScalar(-1);
        rot.transformVector(from, from).add(pos);
        rot.transformVector(to, to).add(pos);
        this._guides.line(from, to, 1, base.a, base);
    }

    /**
     * Hides a shape when the view looks along its direction, fading it over the fade angle.
     *
     * @param {Shape} shape - The shape.
     * @param {number} cos - The absolute cosine of the angle between the view and the direction.
     * @returns {boolean} Whether the visibility changed.
     * @protected
     */
    _glance(shape, cos) {
        const enabled = 1 - cos > GLANCE_EPSILON;
        const range = this._fadeAngle * math.DEG_TO_RAD - GLANCE_ANGLE;
        shape.fade = enabled && range > 0 ?
            math.clamp((Math.acos(Math.min(cos, 1)) - GLANCE_ANGLE) / range, 0, 1) : 1;
        if (shape.entity.enabled === enabled) {
            return false;
        }
        shape.entity.enabled = enabled;
        return true;
    }

    /**
     * @protected
     */
    _createTransform() {
        for (const key in this._shapes) {
            const shape = this._shapes[key];
            this.root.addChild(shape.entity);
            this.intersectShapes.push(shape);
            for (let i = 0; i < shape.meshInstances.length; i++) {
                this._shapeMap.set(shape.meshInstances[i], shape);
            }
        }
    }

    /**
     * Set the shape to be enabled or disabled.
     *
     * @param {GizmoAxis | 'face'} shapeAxis - The shape axis.
     * @param {boolean} enabled - The enabled state of shape.
     */
    enableShape(shapeAxis, enabled) {
        if (shapeAxis === 'face') {
            Debug.deprecated('"face" literal is deprecated use "f" literal instead');
            shapeAxis = 'f';
        }
        const shape = this._shapes[shapeAxis];
        if (!shape) {
            return;
        }
        shape.disabled = !enabled;
    }

    /**
     * Get the enabled state of the shape.
     *
     * @param {GizmoAxis | 'face'} shapeAxis - The shape axis.
     * @returns {boolean} - Whether the shape is enabled.
     */
    isShapeEnabled(shapeAxis) {
        if (shapeAxis === 'face') {
            Debug.deprecated('"face" literal is deprecated use "f" literal instead');
            shapeAxis = 'f';
        }
        const shape = this._shapes[shapeAxis];
        if (!shape) {
            return false;
        }
        return !shape.disabled;
    }

    /**
     * Sets the theme or partial theme for the gizmo.
     *
     * @param {{ [K in keyof GizmoTheme]?: Partial<GizmoTheme[K]> }} partial - The partial theme to set.
     */
    setTheme(partial) {
        const theme = { ...this._theme, ...partial };
        if (typeof theme !== 'object' ||
            typeof theme.shapeBase !== 'object' ||
            typeof theme.shapeHover !== 'object' ||
            typeof theme.guideBase !== 'object') {
            return;
        }

        for (const axis in theme.shapeBase) {
            if (theme.shapeBase[axis] instanceof Color) {
                this._theme.shapeBase[axis].copy(theme.shapeBase[axis]);
            }
        }
        for (const axis in theme.shapeHover) {
            if (theme.shapeHover[axis] instanceof Color) {
                this._theme.shapeHover[axis].copy(theme.shapeHover[axis]);
            }
        }

        for (const axis in theme.guideBase) {
            if (theme.guideBase[axis] instanceof Color) {
                this._theme.guideBase[axis].copy(theme.guideBase[axis]);
            }
        }
        if (typeof theme.guideOcclusion === 'number') {
            this._theme.guideOcclusion = math.clamp(theme.guideOcclusion, 0, 1);
        }

        if (theme.disabled instanceof Color) {
            this._theme.disabled.copy(theme.disabled);
        }

        for (const name in this._shapes) {
            this._shapes[name].hover(this._hovering.has(/** @type {GizmoAxis} */ (name)));
        }
    }

    /**
     * @override
     */
    prerender() {
        super.prerender();

        const guides = this._guides;
        if (!this.enabled) {
            guides.clear();
            return;
        }

        this._guideTheme.occluded.a = 1 - this._theme.guideOcclusion;
        guides.begin();
        const gizmoPos = this.root.getLocalPosition();
        const gizmoRot = this.root.getRotation();
        const activeAxis = this._hoverAxis || this._selectedAxis;
        const activeIsPlane = this._hoverIsPlane || this._selectedIsPlane;
        this._drawGuideLines(gizmoPos, gizmoRot, activeAxis, activeIsPlane);
        guides.end();
    }

    /**
     * @override
     */
    destroy() {
        super.destroy();

        this._guides.destroy();
        this._guideRoot.destroy();

        this.readout = false;

        for (const key in this._shapes) {
            this._shapes[key].destroy();
        }
    }
}

export { TransformGizmo };

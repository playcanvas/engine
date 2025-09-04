import { math } from '../../core/math/math.js';
import { Color } from '../../core/math/color.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Ray } from '../../core/shape/ray.js';
import { Plane } from '../../core/shape/plane.js';
import { PROJECTION_PERSPECTIVE } from '../../scene/constants.js';

import {
    COLOR_RED,
    COLOR_GREEN,
    COLOR_BLUE,
    COLOR_YELLOW,
    COLOR_GRAY,
    color4from3
} from './color.js';
import { Gizmo } from './gizmo.js';
import { Debug } from '../../core/debug.js';

/**
 * @import { Shape } from './shape/shape.js'
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { Layer } from '../../scene/layer.js'
 * @import { MeshInstance } from '../../scene/mesh-instance.js'
 * @import { GizmoAxis, GizmoDragMode } from './constants.js'
 */

/**
 * @typedef {object} GizmoTheme
 * @property {{ [K in 'x' | 'y' | 'z' | 'f' | 'xyz']: Color }} shapeBase - The axis colors.
 * @property {{ [K in 'x' | 'y' | 'z' | 'f' | 'xyz']: Color }} shapeHover - The hover colors.
 * @property {{ [K in 'x' | 'y' | 'z' | 'f']: Color }} guideBase - The guide line colors.
 * @property {number} guideOcclusion - The guide occlusion value. Defaults to 0.8.
 * @property {Color} disabled - The disabled color.
 */

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpR1 = new Ray();
const tmpP1 = new Plane();
const tmpC1 = new Color();

// constants
const AXES = /** @type {('x' | 'y' | 'z')[]} */ (['x', 'y', 'z']);

/**
 * The base class for all transform gizmos.
 *
 * @category Gizmo
 */
class TransformGizmo extends Gizmo {
    /**
     * Fired when when the transformation has started.
     *
     * @event
     * @example
     * const gizmo = new pc.TransformGizmo(camera, layer);
     * gizmo.on('transform:start', () => {
     *     console.log('Transformation started');
     * });
     */
    static EVENT_TRANSFORMSTART = 'transform:start';

    /**
     * Fired during the transformation.
     *
     * @event
     * @example
     * const gizmo = new pc.TransformGizmo(camera, layer);
     * gizmo.on('transform:move', (pointDelta, angleDelta) => {
     *     console.log('Transformation moved by ${pointDelta} (angle: ${angleDelta})');
     * });
     */
    static EVENT_TRANSFORMMOVE = 'transform:move';

    /**
     * Fired when when the transformation has ended.
     *
     * @event
     * @example
     * const gizmo = new pc.TransformGizmo(camera, layer);
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
            x: color4from3(COLOR_RED, 0.6),
            y: color4from3(COLOR_GREEN, 0.6),
            z: color4from3(COLOR_BLUE, 0.6),
            xyz: color4from3(Color.WHITE, 0.6),
            f: color4from3(Color.WHITE, 0.6)
        },
        shapeHover: {
            x: COLOR_RED.clone(),
            y: COLOR_GREEN.clone(),
            z: COLOR_BLUE.clone(),
            xyz: Color.WHITE.clone(),
            f: COLOR_YELLOW.clone()
        },
        guideBase: {
            x: COLOR_RED.clone(),
            y: COLOR_GREEN.clone(),
            z: COLOR_BLUE.clone(),
            f: COLOR_YELLOW.clone()
        },
        guideOcclusion: 0.8,
        disabled: COLOR_GRAY.clone()
    };

    /**
     * Internal gizmo starting rotation in world space.
     *
     * @type {Vec3}
     * @protected
     */
    _rootStartPos = new Vec3();

    /**
     * Internal gizmo starting rotation in world space.
     *
     * @type {Quat}
     * @protected
     */
    _rootStartRot = new Quat();

    /**
     * Internal object containing the gizmo shapes to render.
     *
     * @type {{ [key in GizmoAxis]?: Shape }}
     * @protected
     */
    _shapes = {};

    /**
     * Internal mapping of mesh instances to gizmo shapes.
     *
     * @type {Map<MeshInstance, Shape>}
     * @private
     */
    _shapeMap = new Map();

    /**
     * Internal currently hovered axes
     *
     * @type {Set<GizmoAxis>}
     * @private
     */
    _hovering = new Set();

    /**
     * Internal currently hovered axis.
     *
     * @type {GizmoAxis | ''}
     * @private
     */
    _hoverAxis = '';

    /**
     * Internal state of if currently hovered shape is a plane.
     *
     * @type {boolean}
     * @private
     */
    _hoverIsPlane = false;

    /**
     * Internal currently selected axis.
     *
     * @type {GizmoAxis | ''}
     * @protected
     */
    _selectedAxis = '';

    /**
     * Internal state of if currently selected shape is a plane.
     *
     * @type {boolean}
     * @protected
     */
    _selectedIsPlane = false;

    /**
     * Internal selection starting coordinates in world space.
     *
     * @type {Vec3}
     * @protected
     */
    _selectionStartPoint = new Vec3();

    /**
     * Internal state for if snapping is enabled. Defaults to false.
     *
     * @type {boolean}
     * @private
     */
    _snap = false;

    /**
     * Snapping increment. Defaults to 1.
     *
     * @type {number}
     */
    snapIncrement = 1;

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
     * const gizmo = new pc.TransformGizmo(camera, layer);
     */
    constructor(camera, layer, name = 'gizmo:transform') {
        super(camera, layer, name);

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

        this.on(Gizmo.EVENT_NODESDETACH, () => {
            this.snap = false;
            this._hoverAxis = '';
            this._hoverIsPlane = false;
            this._hover();
            this.fire(Gizmo.EVENT_POINTERUP);
        });
    }

    /**
     * Sets whether snapping is enabled. Defaults to false.
     *
     * @type {boolean}
     */
    set snap(value) {
        this._snap = this.enabled && value;
    }

    /**
     * Gets whether snapping is enabled. Defaults to false.
     *
     * @type {boolean}
     */
    get snap() {
        return this._snap;
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
     * @type {Color}
     * @deprecated Use {@link TransformGizmo#setTheme} instead.
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
     * @deprecated Use {@link TransformGizmo#theme} instead.
     * @ignore
     */
    get xAxisColor() {
        return this._theme.shapeBase.x;
    }

    /**
     * @type {Color}
     * @deprecated Use {@link TransformGizmo#setTheme} instead.
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
     * @deprecated Use {@link TransformGizmo#theme} instead.
     * @ignore
     */
    get yAxisColor() {
        return this._theme.shapeBase.y;
    }

    /**
     * @type {Color}
     * @deprecated Use {@link TransformGizmo#setTheme} instead.
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
     * @deprecated Use {@link TransformGizmo#theme} instead.
     * @ignore
     */
    get zAxisColor() {
        return this._theme.shapeBase.z;
    }

    /**
     * @type {number}
     * @deprecated Use {@link TransformGizmo#setTheme} instead.
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
     * @deprecated Use {@link TransformGizmo#theme} instead.
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
     * @param {MeshInstance} [meshInstance] - The mesh instance.
     * @private
     */
    _hover(meshInstance) {
        if (this._dragging) {
            return;
        }

        // track changes
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

        // determine which axis is hovered
        this._hoverAxis = this._getAxis(meshInstance);
        this._hoverIsPlane = this._getIsPlane(meshInstance);

        // add shapes that are hovered
        if (this._hoverAxis) {
            if (this._hoverAxis === 'xyz') {
                add('x');
                add('y');
                add('z');
                add('xyz');
            } else if (this._hoverIsPlane) {
                switch (this._hoverAxis) {
                    case 'x':
                        add('y');
                        add('z');
                        add('yz');
                        break;
                    case 'y':
                        add('x');
                        add('z');
                        add('xz');
                        break;
                    case 'z':
                        add('x');
                        add('y');
                        add('xy');
                        break;
                }
            } else {
                add(this._hoverAxis);
            }
        }

        // unhover removed shapes
        for (const axis of remove) {
            this._hovering.delete(axis);
            this._shapes[axis]?.hover(false);
            changed = true;
        }

        if (changed) {
            this.fire(Gizmo.EVENT_RENDERUPDATE);
        }
    }

    /**
     * @param {Vec3} mouseWPos - The mouse world position.
     * @returns {Ray} - The ray.
     * @protected
     */
    _createRay(mouseWPos) {
        if (this._camera.projection === PROJECTION_PERSPECTIVE) {
            tmpR1.origin.copy(this._camera.entity.getPosition());
            tmpR1.direction.sub2(mouseWPos, tmpR1.origin).normalize();
            return tmpR1;
        }
        const orthoDepth = this._camera.farClip - this._camera.nearClip;
        tmpR1.origin.sub2(mouseWPos, tmpV1.copy(this._camera.entity.forward).mulScalar(orthoDepth));
        tmpR1.direction.copy(this._camera.entity.forward);
        return tmpR1;
    }

    /**
     * @param {string} axis - The axis to create the plane for.
     * @param {boolean} isFacing - Whether the axis is facing the camera.
     * @param {boolean} isLine - Whether the axis is a line.
     * @returns {Plane} - The plane.
     * @protected
     */
    _createPlane(axis, isFacing, isLine) {
        const facingDir = tmpV1.copy(this.facingDir);
        const normal = tmpP1.normal.set(0, 0, 0);

        if (isFacing) {
            // set plane normal to face camera
            normal.copy(this._camera.entity.forward).mulScalar(-1);
        } else {
            // set plane normal based on axis
            normal[axis] = 1;
            this._rootStartRot.transformVector(normal, normal);

            if (isLine) {
                // set plane normal to face camera but keep normal perpendicular to axis
                tmpV2.cross(normal, facingDir).normalize();
                normal.cross(tmpV2, normal).normalize();
            }
        }

        return tmpP1.setFromPointNormal(this._rootStartPos, normal);
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
        // set normal to axis and project position from plane onto normal
        tmpV1.set(0, 0, 0);
        tmpV1[axis] = 1;
        point.copy(tmpV1.mulScalar(tmpV1.dot(point)));

        // set other axes to zero (floating point fix)
        const v = point[axis];
        point.set(0, 0, 0);
        point[axis] = v;
    }

    /**
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @param {boolean} isFacing - Whether the axis is facing the camera.
     * @param {boolean} isLine - Whether the axis is a line.
     * @returns {Vec3} The point (space is {@link TransformGizmo#coordSpace}).
     * @protected
     */
    _screenToPoint(x, y, isFacing = false, isLine = false) {
        const mouseWPos = this._camera.screenToWorld(x, y, 1);

        const axis = this._selectedAxis;

        const point = new Vec3();
        const ray = this._createRay(mouseWPos);
        const plane = this._createPlane(axis, isFacing, isLine);
        if (!plane.intersectsRay(ray, point)) {
            point.copy(this.root.getLocalPosition());
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
        tmpV1.set(0, 0, 0);
        tmpV1[axis] = 1;
        tmpV1.mulScalar(this._camera.farClip - this._camera.nearClip);
        tmpV2.copy(tmpV1).mulScalar(-1);
        const from = rot.transformVector(tmpV1, tmpV1).add(pos);
        const to = rot.transformVector(tmpV2, tmpV2).add(pos);
        const color = this._theme.guideBase[axis];
        if (this._theme.guideOcclusion < 1) {
            const occluded = tmpC1.copy(color);
            occluded.a *= (1 - this._theme.guideOcclusion);
            this._app.drawLine(from, to, occluded, false, this._layer);
        }
        if (color.a !== 0) {
            this._app.drawLine(from, to, color, true);
        }
    }

    /**
     * @protected
     */
    _createTransform() {
        // shapes
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
     * @param {GizmoAxis | 'face'} shapeAxis - The shape axis. Can be:
     * @returns {boolean} - Then enabled state of the shape
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

        // shape
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

        // guide
        for (const axis in theme.guideBase) {
            if (theme.guideBase[axis] instanceof Color) {
                this._theme.guideBase[axis].copy(theme.guideBase[axis]);
            }
        }
        if (typeof theme.guideOcclusion === 'number') {
            this._theme.guideOcclusion = math.clamp(theme.guideOcclusion, 0, 1);
        }

        // disabled
        if (theme.disabled instanceof Color) {
            this._theme.disabled.copy(theme.disabled);
        }

        // update shapes
        for (const name in this._shapes) {
            this._shapes[name].hover(!!this._hoverAxis);
        }
    }

    /**
     * @override
     */
    prerender() {
        super.prerender();

        if (!this.enabled) {
            return;
        }

        const gizmoPos = this.root.getLocalPosition();
        const gizmoRot = this.root.getRotation();
        const activeAxis = this._hoverAxis || this._selectedAxis;
        const activeIsPlane = this._hoverIsPlane || this._selectedIsPlane;
        this._drawGuideLines(gizmoPos, gizmoRot, activeAxis, activeIsPlane);
    }

    /**
     * @override
     */
    destroy() {
        super.destroy();

        for (const key in this._shapes) {
            this._shapes[key].destroy();
        }
    }
}

export { TransformGizmo };

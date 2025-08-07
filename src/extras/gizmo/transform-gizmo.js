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
import { GIZMOAXIS_FACE, GIZMOAXIS_X, GIZMOAXIS_XYZ, GIZMOAXIS_Y, GIZMOAXIS_Z } from './constants.js';
import { Gizmo } from './gizmo.js';

/**
 * @import { Shape } from './shape/shape.js'
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { Layer } from '../../scene/layer.js'
 * @import { MeshInstance } from '../../scene/mesh-instance.js'
 */

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpR1 = new Ray();
const tmpP1 = new Plane();

// constants
const AXES = ['x', 'y', 'z'];

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
     * Internal color for meshes.
     *
     * @type {{ axis: Record<string, Color>, hover: Record<string, Color>, disabled: Color }}
     * @protected
     */
    _meshColors = {
        axis: {
            x: color4from3(COLOR_RED, 0.6),
            y: color4from3(COLOR_GREEN, 0.6),
            z: color4from3(COLOR_BLUE, 0.6),
            xyz: color4from3(Color.WHITE, 0.6),
            f: color4from3(Color.WHITE, 0.6)
        },
        hover: {
            x: COLOR_RED.clone(),
            y: COLOR_GREEN.clone(),
            z: COLOR_BLUE.clone(),
            xyz: Color.WHITE.clone(),
            f: COLOR_YELLOW.clone()
        },
        disabled: COLOR_GRAY.clone()
    };

    /**
     * Internal version of the guide line color.
     *
     * @type {Record<string, Color>}
     * @protected
     */
    _guideColors = {
        x: COLOR_RED.clone(),
        y: COLOR_GREEN.clone(),
        z: COLOR_BLUE.clone(),
        f: COLOR_YELLOW.clone()
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
     * Internal state of if shading is enabled. Defaults to true.
     *
     * @type {boolean}
     * @protected
     */
    _shading = false;

    /**
     * Internal object containing the gizmo shapes to render.
     *
     * @type {Record<string, Shape>}
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
     * Internal currently hovered shape.
     *
     * @type {Shape | null}
     * @private
     */
    _hoverShape = null;

    /**
     * Internal currently hovered axis.
     *
     * @type {string}
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
     * @type {string}
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
     * Creates a new TransformGizmo object.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The render layer.
     * @example
     * const gizmo = new pc.TransformGizmo(camera, layer);
     */
    constructor(camera, layer) {
        super(camera, layer);

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

            this._rootStartPos.copy(this.root.getPosition());
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

        this.on(Gizmo.EVENT_POINTERUP, (x, y, meshInstance) => {
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
     * Sets whether shading are enabled. Defaults to true.
     *
     * @type {boolean}
     */
    set shading(value) {
        this._shading = this.root.enabled && value;

        for (const name in this._shapes) {
            this._shapes[name].shading = this._shading;
        }
    }

    /**
     * Gets whether shading are enabled. Defaults to true.
     *
     * @type {boolean}
     */
    get shading() {
        return this._shading;
    }

    /**
     * Sets whether snapping is enabled. Defaults to false.
     *
     * @type {boolean}
     */
    set snap(value) {
        this._snap = this.root.enabled && value;
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
     * Sets the X axis color.
     *
     * @type {Color}
     */
    set xAxisColor(value) {
        this._updateAxisColor(GIZMOAXIS_X, value);
    }

    /**
     * Gets the X axis color.
     *
     * @type {Color}
     */
    get xAxisColor() {
        return this._meshColors.axis.x;
    }

    /**
     * Sets the Y axis color.
     *
     * @type {Color}
     */
    set yAxisColor(value) {
        this._updateAxisColor(GIZMOAXIS_Y, value);
    }

    /**
     * Gets the Y axis color.
     *
     * @type {Color}
     */
    get yAxisColor() {
        return this._meshColors.axis.y;
    }

    /**
     * Sets the Z axis color.
     *
     * @type {Color}
     */
    set zAxisColor(value) {
        this._updateAxisColor(GIZMOAXIS_Z, value);
    }

    /**
     * Gets the Z axis color.
     *
     * @type {Color}
     */
    get zAxisColor() {
        return this._meshColors.axis.z;
    }

    /**
     * Sets the X axis hover color.
     *
     * @type {Color}
     */
    set xHoverColor(value) {
        this._updateHoverColor(GIZMOAXIS_X, value);
    }

    /**
     * Gets the X axis hover color.
     *
     * @type {Color}
     */
    get xHoverColor() {
        return this._meshColors.hover.x;
    }

    /**
     * Sets the Y axis hover color.
     *
     * @type {Color}
     */
    set yHoverColor(value) {
        this._updateHoverColor(GIZMOAXIS_Y, value);
    }

    /**
     * Gets the Y axis hover color.
     *
     * @type {Color}
     */
    get yHoverColor() {
        return this._meshColors.hover.y;
    }

    /**
     * Sets the Z axis color.
     *
     * @type {Color}
     */
    set zHoverColor(value) {
        this._updateHoverColor(GIZMOAXIS_Z, value);
    }

    /**
     * Gets the Z axis hover color.
     *
     * @type {Color}
     */
    get zHoverColor() {
        return this._meshColors.hover.z;
    }

    /**
     * Sets the disabled color.
     *
     * @type {Color}
     */
    set disabledColor(value) {
        this._meshColors.disabled.copy(value);

        for (const name in this._shapes) {
            this._shapes[name].hover(!!this._hoverAxis);
        }
    }

    /**
     * Gets the disabled color.
     *
     * @type {Color}
     */
    get disabledColor() {
        return this._meshColors.disabled;
    }

    /**
     * Sets the X guide color.
     *
     * @type {Color}
     */
    set xGuideColor(value) {
        this._guideColors.x.copy(value);
    }

    /**
     * Gets the X guide color.
     *
     * @type {Color}
     */
    get xGuideColor() {
        return this._guideColors.x;
    }

    /**
     * Sets the Y guide color.
     *
     * @type {Color}
     */
    set yGuideColor(value) {
        this._guideColors.y.copy(value);
    }

    /**
     * Gets the Y guide color.
     *
     * @type {Color}
     */
    get yGuideColor() {
        return this._guideColors.y;
    }

    /**
     * Sets the Z guide color.
     *
     * @type {Color}
     */
    set zGuideColor(value) {
        this._guideColors.z.copy(value);
    }

    /**
     * Gets the Z guide color.
     *
     * @type {Color}
     */
    get zGuideColor() {
        return this._guideColors.z;
    }

    get _dragging() {
        return !this._hoverAxis && this._selectedAxis;
    }

    /**
     * @param {string} axis - The axis to update.
     * @param {Color} color - The value to set.
     * @private
     */
    _updateAxisColor(axis, color) {
        this._guideColors[axis].copy(color);
        this._meshColors.axis[axis].copy(color);

        for (const name in this._shapes) {
            this._shapes[name].hover(!!this._hoverAxis);
        }
    }

    /**
     * @param {string} axis - The axis to update.
     * @param {Color} color - The value to set.
     * @private
     */
    _updateHoverColor(axis, color) {
        this._meshColors.hover[axis].copy(color);

        for (const name in this._shapes) {
            this._shapes[name].hover(!!this._hoverAxis);
        }
    }

    /**
     * @param {MeshInstance} [meshInstance] - The mesh instance.
     * @returns {string} - The axis.
     * @private
     */
    _getAxis(meshInstance) {
        if (!meshInstance) {
            return '';
        }
        return meshInstance.node.name.split(':')[1];
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
        this._hoverAxis = this._getAxis(meshInstance);
        this._hoverIsPlane = this._getIsPlane(meshInstance);
        const shape = meshInstance ? this._shapeMap.get(meshInstance) ?? null : null;
        if (shape === this._hoverShape) {
            return;
        }
        if (this._hoverShape) {
            this._hoverShape.hover(false);
            this._hoverShape = null;
        }
        if (shape) {
            shape.hover(true);
            this._hoverShape = shape;
        }
        this.fire(Gizmo.EVENT_RENDERUPDATE);
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
            // all axes so set normal to plane facing camera
            normal.copy(facingDir);
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
        if (axis === GIZMOAXIS_FACE) {
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
     * @returns {Vec3} - The point.
     * @protected
     */
    _screenToPoint(x, y, isFacing = false, isLine = false) {
        const mouseWPos = this._camera.screenToWorld(x, y, 1);

        const axis = this._selectedAxis;

        const ray = this._createRay(mouseWPos);
        const plane = this._createPlane(axis, isFacing, isLine);

        const point = new Vec3();
        plane.intersectsRay(ray, point);

        return point;
    }

    /**
     * @private
     */
    _drawGuideLines() {
        const gizmoPos = this.root.getPosition();
        const gizmoRot = this.root.getRotation();
        const checkAxis = this._hoverAxis || this._selectedAxis;
        const checkIsPlane = this._hoverIsPlane || this._selectedIsPlane;
        for (let i = 0; i < AXES.length; i++) {
            const axis = AXES[i];
            if (this._dragging || checkAxis === GIZMOAXIS_XYZ) {
                this._drawSpanLine(gizmoPos, gizmoRot, axis);
                continue;
            }
            if (checkIsPlane) {
                if (axis !== checkAxis) {
                    this._drawSpanLine(gizmoPos, gizmoRot, axis);
                }
            } else {
                if (axis === checkAxis) {
                    this._drawSpanLine(gizmoPos, gizmoRot, axis);
                }
            }
        }
    }

    /**
     * @param {Vec3} pos - The position.
     * @param {Quat} rot - The rotation.
     * @param {string} axis - The axis.
     * @private
     */
    _drawSpanLine(pos, rot, axis) {
        tmpV1.set(0, 0, 0);
        tmpV1[axis] = 1;
        tmpV1.mulScalar(this._camera.farClip - this._camera.nearClip);
        tmpV2.copy(tmpV1).mulScalar(-1);
        rot.transformVector(tmpV1, tmpV1);
        rot.transformVector(tmpV2, tmpV2);
        this._app.drawLine(tmpV1.add(pos), tmpV2.add(pos), this._guideColors[axis], true);
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
     * @param {string} shapeAxis - The shape axis. Can be:
     *
     * - {@link GIZMOAXIS_X}
     * - {@link GIZMOAXIS_Y}
     * - {@link GIZMOAXIS_Z}
     * - {@link GIZMOAXIS_YZ}
     * - {@link GIZMOAXIS_XZ}
     * - {@link GIZMOAXIS_XY}
     * - {@link GIZMOAXIS_XYZ}
     * - {@link GIZMOAXIS_FACE}
     *
     * @param {boolean} enabled - The enabled state of shape.
     */
    enableShape(shapeAxis, enabled) {
        if (!this._shapes.hasOwnProperty(shapeAxis)) {
            return;
        }

        this._shapes[shapeAxis].disabled = !enabled;
    }

    /**
     * Get the enabled state of the shape.
     *
     * @param {string} shapeAxis - The shape axis. Can be:
     *
     * - {@link GIZMOAXIS_X}
     * - {@link GIZMOAXIS_Y}
     * - {@link GIZMOAXIS_Z}
     * - {@link GIZMOAXIS_YZ}
     * - {@link GIZMOAXIS_XZ}
     * - {@link GIZMOAXIS_XY}
     * - {@link GIZMOAXIS_XYZ}
     * - {@link GIZMOAXIS_FACE}
     *
     * @returns {boolean} - Then enabled state of the shape
     */
    isShapeEnabled(shapeAxis) {
        if (!this._shapes.hasOwnProperty(shapeAxis)) {
            return false;
        }

        return !this._shapes[shapeAxis].disabled;
    }

    /**
     * @override
     */
    prerender() {
        super.prerender();

        if (!this.root.enabled) {
            return;
        }

        this._drawGuideLines();
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

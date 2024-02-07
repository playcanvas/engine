import {
    math,
    CULLFACE_NONE,
    CULLFACE_BACK,
    PROJECTION_PERSPECTIVE,
    PROJECTION_ORTHOGRAPHIC,
    BLEND_NORMAL,
    Color,
    StandardMaterial,
    Vec3,
    Quat
} from 'playcanvas';

import { Gizmo } from "./gizmo.js";

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();
const tmpQ1 = new Quat();

const pointDelta = new Vec3();

// constants
const VEC3_AXES = Object.keys(tmpV1);
const FACING_EPSILON = 0.2;
const SPANLINE_SIZE = 1e3;
const ROTATE_SCALE = 900;

const RED_COLOR = new Color(1, 0.3, 0.3);
const SEMI_RED_COLOR = new Color(1, 0.3, 0.3, 0.6);
const GREEN_COLOR = new Color(0.3, 1, 0.3);
const SEMI_GREEN_COLOR = new Color(0.3, 1, 0.3, 0.6);
const BLUE_COLOR = new Color(0.3, 0.3, 1);
const SEMI_BLUE_COLOR = new Color(0.3, 0.3, 1, 0.6);
const YELLOW_COLOR = new Color(1, 1, 0.5);
const WHITE_COLOR = new Color(1, 1, 1);
const SEMI_WHITE_COLOR = new Color(1, 1, 1, 0.6);
const GRAY_COLOR = new Color(0.5, 0.5, 0.5, 0.5);

/**
 * Shape axis for the line X.
 *
 * @type {string}
 */
export const SHAPEAXIS_X = 'x';

/**
 * Shape axis for the line Y.
 *
 * @type {string}
 */
export const SHAPEAXIS_Y = 'y';

/**
 * Shape axis for the line Z.
 *
 * @type {string}
 */
export const SHAPEAXIS_Z = 'z';

/**
 * Shape axis for the plane YZ.
 *
 * @type {string}
 */
export const SHAPEAXIS_YZ = 'yz';

/**
 * Shape axis for the plane XZ.
 *
 * @type {string}
 */
export const SHAPEAXIS_XZ = 'xz';

/**
 * Shape axis for the plane XY.
 *
 * @type {string}
 */
export const SHAPEAXIS_XY = 'xy';

/**
 * Shape axis for all directions XYZ.
 *
 * @type {string}
 */
export const SHAPEAXIS_XYZ = 'xyz';

/**
 * Shape axis for facing the camera.
 *
 * @type {string}
 */
export const SHAPEAXIS_FACE = 'face';

/**
 * The base class for all transform gizmos.
 *
 * @augments Gizmo
 * @category Gizmo
 */
class TransformGizmo extends Gizmo {
    /**
     * Fired when when the transformation has started.
     *
     * @event
     * @example
     * const gizmo = new pcx.TransformGizmo(app, camera, layer);
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
     * const gizmo = new pcx.TransformGizmo(app, camera, layer);
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
     * const gizmo = new pcx.TransformGizmo(app, camera, layer);
     * gizmo.on('transform:end', () => {
     *     console.log('Transformation ended');
     * });
     */
    static EVENT_TRANSFORMEND = 'transform:end';

    /**
     * Internal material objects for mesh instances.
     *
     * @type {Object}
     * @protected
     */
    _materials = {
        axis: {
            x: {
                cullBack: this._createMaterial(SEMI_RED_COLOR),
                cullNone: this._createMaterial(SEMI_RED_COLOR, CULLFACE_NONE)
            },
            y: {
                cullBack: this._createMaterial(SEMI_GREEN_COLOR),
                cullNone: this._createMaterial(SEMI_GREEN_COLOR, CULLFACE_NONE)
            },
            z: {
                cullBack: this._createMaterial(SEMI_BLUE_COLOR),
                cullNone: this._createMaterial(SEMI_BLUE_COLOR, CULLFACE_NONE)
            },
            face: this._createMaterial(SEMI_WHITE_COLOR),
            xyz: this._createMaterial(SEMI_WHITE_COLOR)
        },
        hover: {
            x: {
                cullBack: this._createMaterial(RED_COLOR),
                cullNone: this._createMaterial(RED_COLOR, CULLFACE_NONE)
            },
            y: {
                cullBack: this._createMaterial(GREEN_COLOR),
                cullNone: this._createMaterial(GREEN_COLOR, CULLFACE_NONE)
            },
            z: {
                cullBack: this._createMaterial(BLUE_COLOR),
                cullNone: this._createMaterial(BLUE_COLOR, CULLFACE_NONE)
            },
            face: this._createMaterial(YELLOW_COLOR),
            xyz: this._createMaterial(WHITE_COLOR)
        },
        disabled: {
            cullBack: this._createMaterial(GRAY_COLOR),
            cullNone: this._createMaterial(GRAY_COLOR, CULLFACE_NONE)
        }
    };

    /**
     * Internal version of the guide line color.
     *
     * @type {Object<string, Color>}
     * @protected
     */
    _guideColors = {
        x: RED_COLOR,
        y: GREEN_COLOR,
        z: BLUE_COLOR,
        face: YELLOW_COLOR
    };

    /**
     * Internal gizmo starting rotation in world space.
     *
     * @type {Quat}
     * @protected
     */
    _gizmoRotationStart = new Quat();

    /**
     * Internal object containing the axis shapes to render.
     *
     * @type {Object.<string, import('./axis-shapes.js').AxisShape>}
     * @protected
     */
    _shapes = {};

    /**
     * Internal mapping of mesh instances to axis shapes.
     *
     * @type {Map<import('playcanvas').MeshInstance, import('./axis-shapes.js').AxisShape>}
     * @private
     */
    _shapeMap = new Map();

    /**
     * Internal currently hovered shape.
     *
     * @type {import('./axis-shapes.js').AxisShape}
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
     * Internal selection starting angle in world space.
     *
     * @type {number}
     * @protected
     */
    _selectionStartAngle = 0;

    /**
     * Internal state if transform is a rotation.
     *
     * @type {boolean}
     * @protected
     */
    _isRotation = false;

    /**
     * Internal state if transform should use uniform scaling.
     *
     * @type {boolean}
     * @protected
     */
    _useUniformScaling = false;

    /**
     * Internal state for if the gizmo is being dragged.
     *
     * @type {boolean}
     * @protected
     */
    _dragging = false;

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
     * @param {import('playcanvas').AppBase} app - The application instance.
     * @param {import('playcanvas').CameraComponent} camera - The camera component.
     * @param {import('playcanvas').Layer} layer - The render layer.
     * @example
     * const gizmo = new pcx.TransformGizmo(app, camera, layer);
     */
    constructor(app, camera, layer) {
        super(app, camera, layer);

        app.on('update', () => {
            if (!this.root.enabled) {
                return;
            }
            this._drawGuideLines();
        });

        this.on('pointer:down', (x, y, meshInstance) => {
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

            this._selectedAxis = this._getAxis(meshInstance);
            this._selectedIsPlane =  this._getIsPlane(meshInstance);
            this._gizmoRotationStart.copy(this.root.getRotation());
            const pointInfo = this._calcPoint(x, y);
            this._selectionStartPoint.copy(pointInfo.point);
            this._selectionStartAngle = pointInfo.angle;
            this._dragging = true;
            this.fire(TransformGizmo.EVENT_TRANSFORMSTART);
        });

        this.on('pointer:move', (x, y, meshInstance) => {
            const shape = this._shapeMap.get(meshInstance);
            if (shape?.disabled) {
                return;
            }

            this._hover(meshInstance);

            if (!this._dragging) {
                return;
            }

            const pointInfo = this._calcPoint(x, y);
            pointDelta.copy(pointInfo.point).sub(this._selectionStartPoint);
            const angleDelta = pointInfo.angle - this._selectionStartAngle;
            this.fire(TransformGizmo.EVENT_TRANSFORMMOVE, pointDelta, angleDelta);

            this._hoverAxis = '';
            this._hoverIsPlane = false;
        });

        this.on('pointer:up', () => {
            if (!this._dragging) {
                return;
            }
            this._dragging = false;
            this.fire(TransformGizmo.EVENT_TRANSFORMEND);

            this._selectedAxis = '';
            this._selectedIsPlane = false;
        });

        this.on('nodes:detach', () => {
            this.snap = false;
            this._hoverAxis = '';
            this._hoverIsPlane = false;
            this._hover(null);
            this.fire('pointer:up');
        });
    }

    /**
     * State for if snapping is enabled. Defaults to false.
     *
     * @type {boolean}
     */
    set snap(value) {
        this._snap = this.root.enabled && value;
    }

    get snap() {
        return this._snap;
    }

    /**
     * X axis color.
     *
     * @type {Color}
     */
    set xAxisColor(value) {
        this._updateAxisColor('x', value);
    }

    get xAxisColor() {
        return this._materials.axis.x.cullBack.emissive;
    }

    /**
     * Y axis color.
     *
     * @type {Color}
     */
    set yAxisColor(value) {
        this._updateAxisColor('y', value);
    }

    get yAxisColor() {
        return this._materials.axis.y.cullBack.emissive;
    }

    /**
     * Z axis color.
     *
     * @type {Color}
     */
    set zAxisColor(value) {
        this._updateAxisColor('z', value);
    }

    get zAxisColor() {
        return this._materials.axis.z.cullBack.emissive;
    }

    _updateAxisColor(axis, value) {
        this._guideColors[axis].copy(value);

        this._materials.axis[axis].cullBack.emissive.copy(value);
        this._materials.axis[axis].cullNone.emissive.copy(value);
        this._materials.hover[axis].cullBack.emissive.copy(value);
        this._materials.hover[axis].cullNone.emissive.copy(value);

        this._materials.axis[axis].cullBack.update();
        this._materials.axis[axis].cullNone.update();
        this._materials.hover[axis].cullBack.update();
        this._materials.hover[axis].cullNone.update();
    }

    _getAxis(meshInstance) {
        if (!meshInstance) {
            return '';
        }
        return meshInstance.node.name.split(":")[1];
    }

    _getIsPlane(meshInstance) {
        if (!meshInstance) {
            return false;
        }
        return meshInstance.node.name.indexOf('plane') !== -1;
    }

    _hover(meshInstance) {
        if (this._dragging) {
            return;
        }
        this._hoverAxis = this._getAxis(meshInstance);
        this._hoverIsPlane = this._getIsPlane(meshInstance);
        const shape = this._shapeMap.get(meshInstance) || null;
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
        this.fire('render:update');
    }

    _calcPoint(x, y) {
        const gizmoPos = this.root.getPosition();
        const mouseWPos = this._camera.screenToWorld(x, y, 1);
        const cameraRot = this._camera.entity.getRotation();
        const rayOrigin = this._camera.entity.getPosition();
        const rayDir = new Vec3();
        const planeNormal = new Vec3();
        const axis = this._selectedAxis;
        const isPlane = this._selectedIsPlane;
        const isRotation = this._isRotation;
        const isUniform = this._useUniformScaling && isPlane;
        const isAllAxes = axis === 'xyz';
        const isFacing = axis === 'face';

        // calculate ray direction from mouse position
        if (this._camera.projection === PROJECTION_PERSPECTIVE) {
            rayDir.copy(mouseWPos).sub(rayOrigin).normalize();
        } else {
            rayOrigin.add(mouseWPos);
            this._camera.entity.getWorldTransform().transformVector(tmpV1.set(0, 0, -1), rayDir);
        }

        if (isUniform || isAllAxes || isFacing) {
            // all axes so set normal to plane facing camera
            planeNormal.copy(rayOrigin).sub(gizmoPos).normalize();
        } else {
            // set plane normal based on axis
            planeNormal[axis] = 1;

            // rotate plane normal by gizmo rotation
            tmpQ1.copy(this._gizmoRotationStart).transformVector(planeNormal, planeNormal);

            if (!isPlane && !isRotation) {
                tmpV1.copy(rayOrigin).sub(gizmoPos).normalize();
                planeNormal.copy(tmpV1.sub(planeNormal.mulScalar(planeNormal.dot(tmpV1))).normalize());
            }
        }

        // ray intersection with plane
        const rayPlaneDot = planeNormal.dot(rayDir);
        const planeDist = gizmoPos.dot(planeNormal);
        const pointPlaneDist = (planeNormal.dot(rayOrigin) - planeDist) / rayPlaneDot;
        const point = rayDir.mulScalar(-pointPlaneDist).add(rayOrigin);

        if (isRotation) {
            // point needs to be relative to gizmo for angle calculation
            point.sub(gizmoPos);
        }

        if (isUniform) {
            // calculate point distance from gizmo
            tmpV1.copy(point).sub(gizmoPos).normalize();

            // calculate projecion vector for scale direction
            switch (axis) {
                case 'x':
                    tmpV2.copy(this.root.up);
                    tmpV3.copy(this.root.forward).mulScalar(-1);
                    break;
                case 'y':
                    tmpV2.copy(this.root.right);
                    tmpV3.copy(this.root.forward).mulScalar(-1);
                    break;
                case 'z':
                    tmpV2.copy(this.root.up);
                    tmpV3.copy(this.root.right);
                    break;
                default:
                    tmpV2.set(0, 0, 0);
                    tmpV3.set(0, 0, 0);
                    break;
            }
            tmpV2.add(tmpV3).normalize();

            const v = point.sub(gizmoPos).length() * tmpV1.dot(tmpV2);
            point.set(v, v, v);
            point[axis] = 1;
        } else if (isAllAxes) {
            // calculate point distance from gizmo
            tmpV1.copy(point).sub(gizmoPos).normalize();
            tmpV2.copy(this._camera.entity.up).add(this._camera.entity.right).normalize();

            const v = point.sub(gizmoPos).length() * tmpV1.dot(tmpV2);
            point.set(v, v, v);
        } else if (!isFacing) {
            if (!isPlane && !isRotation) {
                // reset normal based on axis and project position from plane onto normal
                planeNormal.set(0, 0, 0);
                planeNormal[axis] = 1;
                tmpQ1.transformVector(planeNormal, planeNormal);
                point.copy(planeNormal.mulScalar(planeNormal.dot(point)));
            }

            // rotate point back to world coords
            tmpQ1.invert().transformVector(point, point);

            if (!isPlane && !isRotation) {
                // set other axes to zero if not plane point
                const v = point[axis];
                point.set(0, 0, 0);
                point[axis] = v;
            }
        }

        // calculate angle
        let angle = 0;
        if (isRotation) {
            let isAxisFacing = isFacing;
            tmpV1.copy(rayOrigin).sub(gizmoPos).normalize();
            tmpV2.cross(planeNormal, tmpV1);
            isAxisFacing ||= tmpV2.length() < FACING_EPSILON;

            if (isAxisFacing) {
                switch (axis) {
                    case 'x':
                        angle = Math.atan2(point.z, point.y) * math.RAD_TO_DEG;
                        break;
                    case 'y':
                        angle = Math.atan2(point.x, point.z) * math.RAD_TO_DEG;
                        break;
                    case 'z':
                        angle = Math.atan2(point.y, point.x) * math.RAD_TO_DEG;
                        break;
                    case 'face':
                        cameraRot.invert().transformVector(point, tmpV1);
                        angle = Math.atan2(tmpV1.y, tmpV1.x) * math.RAD_TO_DEG;
                        break;
                }
            } else {
                angle = mouseWPos.dot(tmpV2.normalize()) * ROTATE_SCALE;
                if (this._camera.projection === PROJECTION_ORTHOGRAPHIC) {
                    angle /= (this._camera.orthoHeight || 1);
                }
            }
        }

        return { point, angle };
    }

    _drawGuideLines() {
        const gizmoPos = this.root.getPosition();
        const gizmoRot = tmpQ1.copy(this.root.getRotation());
        const checkAxis = this._hoverAxis || this._selectedAxis;
        const checkIsPlane = this._hoverIsPlane || this._selectedIsPlane;
        for (let i = 0; i < VEC3_AXES.length; i++) {
            const axis = VEC3_AXES[i];
            if (checkAxis === 'xyz') {
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

    _drawSpanLine(pos, rot, axis) {
        tmpV1.set(0, 0, 0);
        tmpV1[axis] = 1;
        tmpV1.mulScalar(SPANLINE_SIZE);
        tmpV2.copy(tmpV1).mulScalar(-1);
        rot.transformVector(tmpV1, tmpV1);
        rot.transformVector(tmpV2, tmpV2);
        this._app.drawLine(tmpV1.add(pos), tmpV2.add(pos), this._guideColors[axis], true);
    }

    _createMaterial(color, cull = CULLFACE_BACK) {
        const material = new StandardMaterial();
        material.emissive = color;
        material.emissiveVertexColor = true;
        material.cull = cull;
        material.blendType = BLEND_NORMAL;
        if (color.a !== 1) {
            material.opacity = color.a;
        }
        return material;
    }

    _createTransform() {
        // shapes
        for (const key in this._shapes) {
            const shape = this._shapes[key];
            this.root.addChild(shape.entity);
            this.intersectData.push({
                meshTriDataList: shape.meshTriDataList,
                parent: shape.entity,
                meshInstances: shape.meshInstances
            });
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
     * {@link SHAPEAXIS_X}
     * {@link SHAPEAXIS_Y}
     * {@link SHAPEAXIS_Z}
     * {@link SHAPEAXIS_YZ}
     * {@link SHAPEAXIS_XZ}
     * {@link SHAPEAXIS_XY}
     * {@link SHAPEAXIS_XYZ}
     * {@link SHAPEAXIS_FACE}
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
     * {@link SHAPEAXIS_X}
     * {@link SHAPEAXIS_Y}
     * {@link SHAPEAXIS_Z}
     * {@link SHAPEAXIS_YZ}
     * {@link SHAPEAXIS_XZ}
     * {@link SHAPEAXIS_XY}
     * {@link SHAPEAXIS_XYZ}
     * {@link SHAPEAXIS_FACE}
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
    destroy() {
        for (const key in this._shapes) {
            this._shapes[key].destroy();
        }

        super.destroy();
    }
}

export { TransformGizmo };

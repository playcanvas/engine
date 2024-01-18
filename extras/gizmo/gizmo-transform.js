import {
    math,
    CULLFACE_NONE,
    CULLFACE_BACK,
    PROJECTION_PERSPECTIVE,
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

/**
 * The base class for all transform gizmos.
 *
 * @augments Gizmo
 */
class GizmoTransform extends Gizmo {
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
     * Internal mapping of mesh instances to axis shapes for hovering.
     *
     * @type {Map<import('playcanvas').MeshInstance, import('./axis-shapes.js').AxisShape>}
     * @private
     */
    _hoverShapeMap = new Map();

    /**
     * Internal currently hovered shape.
     *
     * @type {import('./axis-shapes.js').AxisShape}
     * @private
     */
    _hoverShape;

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
     * Internal state for if the gizmo is being dragged.
     *
     * @type {boolean}
     * @protected
     */
    _dragging = false;

    /**
     * State for if snapping is enabled. Defaults to false.
     *
     * @type {boolean}
     */
    snap = false;

    /**
     * Snapping increment. Defaults to 1.
     *
     * @type {number}
     */
    snapIncrement = 1;

    /**
     * Use legacy rotation calculation. Defaults to false.
     *
     * @type {boolean}
     */
    useLegacyRotation = false;

    /**
     * Creates a new GizmoTransform object.
     *
     * @param {import('playcanvas').AppBase} app - The application instance.
     * @param {import('playcanvas').CameraComponent} camera - The camera component.
     * @param {import('playcanvas').Layer} layer - The render layer.
     * @example
     * const gizmo = new pcx.GizmoTransform(app, camera, layer);
     */
    constructor(app, camera, layer) {
        super(app, camera, layer);

        this.app.on('update', () => {
            if (!this.gizmo.enabled) {
                return;
            }
            this._drawGuideLines();
        });

        this.on('pointer:down', (x, y, meshInstance) => {
            if (this._dragging) {
                return;
            }

            if (meshInstance) {
                this._selectedAxis = this._getAxis(meshInstance);
                this._selectedIsPlane =  this._getIsPlane(meshInstance);
                this._gizmoRotationStart.copy(this.gizmo.getRotation());
                const pointInfo = this._calcPoint(x, y);
                this._selectionStartPoint.copy(pointInfo.point);
                this._selectionStartAngle = pointInfo.angle;
                this._dragging = true;
                this.fire('transform:start');
            }
        });

        this.on('pointer:move', (x, y, meshInstance) => {
            this._hover(meshInstance);

            if (this._dragging) {
                const pointInfo = this._calcPoint(x, y);
                pointDelta.copy(pointInfo.point).sub(this._selectionStartPoint);
                const angleDelta = pointInfo.angle - this._selectionStartAngle;
                this.fire('transform:move', pointDelta, angleDelta);
                this._hoverAxis = '';
                this._hoverIsPlane = false;
            }
        });

        this.on('pointer:up', () => {
            this._dragging = false;
            this.fire('transform:end');

            this._selectedAxis = '';
            this._selectedIsPlane = false;
        });

        this.on('key:down', (key, shiftKey) => {
            this.snap = shiftKey;
        });

        this.on('key:up', () => {
            this.snap = false;
        });

        this.on('nodes:detach', () => {
            this._hoverAxis = '';
            this._hoverIsPlane = false;
            this._hover(null);
            this.fire('pointer:up');
        });
    }

    set xAxisColor(value) {
        this._updateAxisColor('x', value);
    }

    get xAxisColor() {
        return this._materials.axis.x.cullBack.emissive;
    }

    set yAxisColor(value) {
        this._updateAxisColor('y', value);
    }

    get yAxisColor() {
        return this._materials.axis.y.cullBack.emissive;
    }

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
        const shape = this._hoverShapeMap.get(meshInstance);
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
    }

    _calcPoint(x, y) {
        const gizmoPos = this.gizmo.getPosition();
        const mouseWPos = this.camera.screenToWorld(x, y, 1);
        const cameraRot = this.camera.entity.getRotation();
        const rayOrigin = this.camera.entity.getPosition();
        const rayDir = new Vec3();
        const planeNormal = new Vec3();
        const axis = this._selectedAxis;
        const isPlane = this._selectedIsPlane;
        const isRotation = this._isRotation;
        const isAllAxes = axis === 'xyz';
        const isFacing = axis === 'face';

        // calculate ray direction from mouse position
        if (this.camera.projection === PROJECTION_PERSPECTIVE) {
            rayDir.copy(mouseWPos).sub(rayOrigin).normalize();
        } else {
            rayOrigin.add(mouseWPos);
            this.camera.entity.getWorldTransform().transformVector(tmpV1.set(0, 0, -1), rayDir);
        }

        if (isAllAxes || isFacing) {
            // all axes so set normal to plane facing camera
            planeNormal.copy(rayOrigin).sub(gizmoPos).normalize();
        } else {
            // set plane normal based on axis
            planeNormal[axis] = 1;

            // rotate plane normal by gizmo rotation
            tmpQ1.copy(this._gizmoRotationStart).transformVector(planeNormal, planeNormal);

            if (!isPlane && !isRotation) {
                tmpV1.copy(rayOrigin).sub(gizmoPos).normalize();
                planeNormal.copy(tmpV1.sub(planeNormal.scale(planeNormal.dot(tmpV1))).normalize());
            }
        }

        // ray intersection with plane
        const rayPlaneDot = planeNormal.dot(rayDir);
        const planeDist = gizmoPos.dot(planeNormal);
        const pointPlaneDist = (planeNormal.dot(rayOrigin) - planeDist) / rayPlaneDot;
        const point = rayDir.scale(-pointPlaneDist).add(rayOrigin);

        if (isRotation) {
            // point needs to be relative to gizmo for angle calculation
            point.sub(gizmoPos);
        }

        if (isAllAxes) {
            // calculate point distance from gizmo
            tmpV1.copy(point).sub(gizmoPos).normalize();
            tmpV2.copy(this.camera.entity.up).add(this.camera.entity.right).normalize();

            const v = point.sub(gizmoPos).length() * tmpV1.dot(tmpV2);
            point.set(v, v, v);
        } else if (!isFacing) {
            if (!isPlane && !isRotation) {
                // reset normal based on axis and project position from plane onto normal
                planeNormal.set(0, 0, 0);
                planeNormal[axis] = 1;
                tmpQ1.transformVector(planeNormal, planeNormal);
                point.copy(planeNormal.scale(planeNormal.dot(point)));
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
            if (!this.useLegacyRotation) {
                tmpV1.copy(rayOrigin).sub(gizmoPos).normalize();
                tmpV2.cross(planeNormal, tmpV1);
                isAxisFacing ||= tmpV2.length() < FACING_EPSILON;
            }

            if (this.useLegacyRotation || isAxisFacing) {
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
            }
        }

        return { point, angle };
    }

    _drawGuideLines() {
        const gizmoPos = this.gizmo.getPosition();
        const gizmoRot = tmpQ1.copy(this.gizmo.getRotation());
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
        tmpV1.scale(SPANLINE_SIZE);
        tmpV2.copy(tmpV1).scale(-1);
        rot.transformVector(tmpV1, tmpV1);
        rot.transformVector(tmpV2, tmpV2);
        this.app.drawLine(tmpV1.add(pos), tmpV2.add(pos), this._guideColors[axis], true);
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
            this.gizmo.addChild(shape.entity);
            this.intersectData.push({
                meshTriDataList: shape.meshTriDataList,
                parent: shape.entity,
                meshInstances: shape.meshInstances
            });
            for (let i = 0; i < shape.meshInstances.length; i++) {
                this._hoverShapeMap.set(shape.meshInstances[i], shape);
            }
        }
    }

    destroy() {
        for (const key in this._shapes) {
            this._shapes[key].destroy();
        }

        super.destroy();
    }
}

export { GizmoTransform };

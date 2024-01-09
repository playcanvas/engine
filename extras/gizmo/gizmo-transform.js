import {
    math,
    CULLFACE_NONE,
    PROJECTION_PERSPECTIVE,
    BLEND_NORMAL,
    Color,
    StandardMaterial,
    Entity,
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
const GUIDELINE_SIZE = 1e3;
const RED_COLOR = new Color(1, 0.3, 0.3);
const GREEN_COLOR = new Color(0.3, 1, 0.3);
const BLUE_COLOR = new Color(0.3, 0.3, 1);
const YELLOW_COLOR = new Color(1, 1, 0.3);
const SEMI_YELLOW_COLOR = new Color(1, 1, 0.3, 0.5);
const SEMI_WHITE_COLOR = new Color(1, 1, 1, 0.5);

/**
 * The base class for all transform gizmos.
 *
 * @augments Gizmo
 */
class GizmoTransform extends Gizmo {
    /**
     * Internal material objects for mesh instances.
     *
     * @typedef MaterialsObject
     * @property {Object} axis - The object containing axis materials.
     * @property {Object} axis.x - The object containing the X axis materials.
     * @property {StandardMaterial} axis.x.culled - The X axis material with culling.
     * @property {StandardMaterial} axis.x.noCull - The X axis material without culling.
     * @property {Object} axis.y - The object containing the Y axis materials.
     * @property {StandardMaterial} axis.y.culled - The Y axis material with culling.
     * @property {StandardMaterial} axis.y.noCull - The Y axis material without culling.
     * @property {Object} axis.z - The object containing the Z axis materials.
     * @property {StandardMaterial} axis.z.culled - The Z axis material with culling.
     * @property {StandardMaterial} axis.z.noCull - The Z axis material without culling.
     * @property {StandardMaterial} axis.face - The camera facing (face) axis material. Only for rotate
     * @property {StandardMaterial} hover - The hover material.
     * @property {StandardMaterial} center - The center shape material. Only for scale.
     * @property {StandardMaterial} guide - The guide ring axis material. Only for rotate.
     */
    /**
     * @type {MaterialsObject}
     * @protected
     */
    _materials = {
        axis: {
            x: {
                culled: this._createMaterial(RED_COLOR),
                noCull: this._createMaterial(RED_COLOR, true)
            },
            y: {
                culled: this._createMaterial(GREEN_COLOR),
                noCull: this._createMaterial(GREEN_COLOR, true)
            },
            z: {
                culled: this._createMaterial(BLUE_COLOR),
                noCull: this._createMaterial(BLUE_COLOR, true)
            },
            face: this._createMaterial(SEMI_YELLOW_COLOR)
        },
        hover: this._createMaterial(YELLOW_COLOR),
        center: this._createMaterial(SEMI_WHITE_COLOR),
        guide: this._createMaterial(SEMI_WHITE_COLOR)
    };

    /**
     * Internal version of the guide line color.
     *
     * @type {Color}
     * @private
     */
    _guideLineColor = new Color(1, 1, 1, 0.8);

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
     * @private
     */
    _selectedAxis = '';

    /**
     * Internal state of if currently selected shape is a plane.
     *
     * @type {boolean}
     * @private
     */
    _selectedIsPlane = false;

    /**
     * Internal selection starting coordinates in world space.
     *
     * @type {Vec3}
     * @private
     */
    _pointStart = new Vec3();

    /**
     * Internal selection starting angle in world space.
     *
     * @type {number}
     * @private
     */
    _angleStart = 0;

    /**
     * Internal state if transform is a rotation.
     *
     * @type {boolean}
     * @protected
     */
    _isRotation = false;

    /**
     * Internal entity for mesh root.
     *
     * @type {Entity}
     * @protected
     */
    _meshRoot;

    /**
     * Internal state for if the gizmo is being dragged.
     *
     * @type {boolean}
     * @private
     */
    _dragging = false;

    /**
     * State for if snapping is enabled. Defaults to false
     *
     * @type {boolean}
     */
    snap = false;

    /**
     * Snapping increment. Defaults to 1
     *
     * @type {number}
     */
    snapIncrement = 1;

    /**
     * Creates a new GizmoTransform object.
     *
     * @param {import('playcanvas').AppBase} app - The application instance.
     * @param {import('playcanvas').CameraComponent} camera - The camera component.
     * @example
     * const gizmo = new pcx.GizmoTransform(app, camera);
     */
    constructor(app, camera) {
        super(app, camera);

        this.app.on('update', () => {
            if (!this.gizmo.enabled) {
                return;
            }

            // draw guidelines
            const gizmoPos = this.gizmo.getPosition();
            tmpQ1.copy(this.gizmo.getRotation());
            const checkAxis = this._hoverAxis || this._selectedAxis;
            const checkIsPlane = this._hoverIsPlane || this._selectedIsPlane;
            for (let i = 0; i < VEC3_AXES.length; i++) {
                const axis = VEC3_AXES[i];
                if (checkAxis === 'xyz') {
                    this._drawGuideLine(gizmoPos, axis);
                    continue;
                }
                if (checkIsPlane) {
                    if (axis !== checkAxis) {
                        this._drawGuideLine(gizmoPos, axis);
                    }
                } else {
                    if (axis === checkAxis) {
                        this._drawGuideLine(gizmoPos, axis);
                    }
                }
            }
        });

        this.on('pointer:move', (x, y, meshInstance) => {
            this._hover(meshInstance);

            if (this._dragging) {
                const pointInfo = this._calcPoint(x, y);
                pointDelta.copy(pointInfo.point).sub(this._pointStart);
                const angleDelta = pointInfo.angle - this._angleStart;
                this.fire('transform:move', this._selectedAxis, pointDelta, angleDelta);
                this._hoverAxis = '';
                this._hoverIsPlane = false;
            }
        });

        this.on('pointer:down', (x, y, meshInstance) => {
            if (this._dragging) {
                return;
            }
            if (meshInstance) {
                this._selectedAxis = this._getAxis(meshInstance);
                this._selectedIsPlane =  this._getIsPlane(meshInstance);
                const pointInfo = this._calcPoint(x, y);
                this._pointStart.copy(pointInfo.point);
                this._angleStart = pointInfo.angle;
                this.fire('transform:start', this._pointStart);
                this._dragging = true;
            }
        });

        this.on('pointer:up', () => {
            this._dragging = false;
            this._selectedAxis = '';
            this._selectedIsPlane = false;
        });

        this.on('key:down', (key, shiftKey) => {
            this.snap = shiftKey;
        });

        this.on('key:up', () => {
            this.snap = false;
        });
    }

    set xAxisColor(value) {
        this._materials.axis.x.culled.emissive.copy(value);
        this._materials.axis.x.noCull.emissive.copy(value);
        this._materials.axis.x.culled.update();
        this._materials.axis.x.noCull.update();
    }

    get xAxisColor() {
        return this._materials.axis.x.culled.emissive;
    }

    set yAxisColor(value) {
        this._materials.axis.y.culled.emissive.copy(value);
        this._materials.axis.y.noCull.emissive.copy(value);
        this._materials.axis.y.culled.update();
        this._materials.axis.y.noCull.update();
    }

    get yAxisColor() {
        return this._materials.axis.y.culled.emissive;
    }

    set zAxisColor(value) {
        this._materials.axis.z.culled.emissive.copy(value);
        this._materials.axis.z.noCull.emissive.copy(value);
        this._materials.axis.z.culled.update();
        this._materials.axis.z.noCull.update();
    }

    get zAxisColor() {
        return this._materials.axis.z.culled.emissive;
    }

    set faceAxisColor(value) {
        this._materials.axis.face.emissive.copy(value);
        this._materials.axis.face.update();
    }

    get faceAxisColor() {
        return this._materials.axis.face.emissive;
    }

    set hoverColor(value) {
        this._materials.hover.emissive.copy(value);
        this._materials.hover.update();
    }

    get hoverColor() {
        return this._materials.hover.emissive;
    }

    set guideLineColor(value) {
        this._guideLineColor.copy(value);
    }

    get guideLineColor() {
        return this._guideLineColor;
    }

    _getAxis(meshInstance) {
        if (!meshInstance) {
            return '';
        }
        return meshInstance.node.name.split("_")[1];
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
        this._hoverIsPlane =  this._getIsPlane(meshInstance);
        const shape = this._shapeMap.get(meshInstance);
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
            tmpQ1.copy(this.gizmo.getRotation()).transformVector(planeNormal, planeNormal);

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

        // calculate angle based on axis
        let angle = 0;
        if (isRotation) {
            switch (axis) {
                case 'x':
                    angle = Math.atan2(point.z, point.y) * math.RAD_TO_DEG;
                    break;
                case 'y':
                    angle = Math.atan2(point.x, point.z) * math.RAD_TO_DEG;
                    break;
                case 'z':
                case 'face':
                    angle = Math.atan2(point.y, point.x) * math.RAD_TO_DEG;
                    break;
            }
        }
        return { point, angle };
    }

    _drawGuideLine(pos, axis) {
        tmpV1.set(0, 0, 0);
        tmpV1[axis] = 1;
        tmpV1.scale(GUIDELINE_SIZE);
        tmpV2.copy(tmpV1).scale(-1);
        tmpQ1.transformVector(tmpV1, tmpV1);
        tmpQ1.transformVector(tmpV2, tmpV2);
        this.app.drawLine(tmpV1.add(pos), tmpV2.add(pos), this._guideLineColor, true);
    }

    _createMaterial(color, disableCulling = false) {
        const material = new StandardMaterial();
        material.emissive = color;
        if (disableCulling) {
            material.cull = CULLFACE_NONE;
        }
        if (color.a !== 1) {
            material.opacity = color.a;
            material.blendType = BLEND_NORMAL;
        }
        return material;
    }

    _createTransform() {
        // mesh root
        this._meshRoot = new Entity('meshRoot');
        this.gizmo.addChild(this._meshRoot);

        // shapes
        for (const key in this._shapes) {
            const shape = this._shapes[key];
            this._meshRoot.addChild(shape.entity);
            for (let i = 0; i < shape.meshInstances.length; i++) {
                this._shapeMap.set(shape.meshInstances[i], shape);
            }
        }
    }
}

export { GizmoTransform };

import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';

import { GIZMOSPACE_LOCAL, GIZMOAXIS_X, GIZMOAXIS_XYZ, GIZMOAXIS_Y, GIZMOAXIS_Z } from './constants.js';
import { TransformGizmo } from './transform-gizmo.js';
import { BoxShape } from './shape/box-shape.js';
import { PlaneShape } from './shape/plane-shape.js';
import { BoxLineShape } from './shape/boxline-shape.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { GraphNode } from '../../scene/graph-node.js'
 * @import { Layer } from '../../scene/layer.js'
 */

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpQ1 = new Quat();

// constants
const GLANCE_EPSILON = 0.98;

/**
 * Scaling gizmo.
 *
 * @category Gizmo
 */
class ScaleGizmo extends TransformGizmo {
    _shapes = {
        xyz: new BoxShape(this._device, {
            axis: GIZMOAXIS_XYZ,
            layers: [this._layer.id],
            shading: this._shading,
            defaultColor: this._meshColors.axis.xyz,
            hoverColor: this._meshColors.hover.xyz
        }),
        yz: new PlaneShape(this._device, {
            axis: GIZMOAXIS_X,
            layers: [this._layer.id],
            shading: this._shading,
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._meshColors.axis.x,
            hoverColor: this._meshColors.hover.x
        }),
        xz: new PlaneShape(this._device, {
            axis: GIZMOAXIS_Y,
            layers: [this._layer.id],
            shading: this._shading,
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._meshColors.axis.y,
            hoverColor: this._meshColors.hover.y
        }),
        xy: new PlaneShape(this._device, {
            axis: GIZMOAXIS_Z,
            layers: [this._layer.id],
            shading: this._shading,
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._meshColors.axis.z,
            hoverColor: this._meshColors.hover.z
        }),
        x: new BoxLineShape(this._device, {
            axis: GIZMOAXIS_X,
            layers: [this._layer.id],
            shading: this._shading,
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._meshColors.axis.x,
            hoverColor: this._meshColors.hover.x
        }),
        y: new BoxLineShape(this._device, {
            axis: GIZMOAXIS_Y,
            layers: [this._layer.id],
            shading: this._shading,
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._meshColors.axis.y,
            hoverColor: this._meshColors.hover.y
        }),
        z: new BoxLineShape(this._device, {
            axis: GIZMOAXIS_Z,
            layers: [this._layer.id],
            shading: this._shading,
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._meshColors.axis.z,
            hoverColor: this._meshColors.hover.z
        })
    };

    _coordSpace = GIZMOSPACE_LOCAL;

    /**
     * Internal mapping from each attached node to their starting scale.
     *
     * @type {Map<GraphNode, Vec3>}
     * @private
     */
    _nodeScales = new Map();

    /**
     * Internal state if transform should use uniform scaling.
     *
     * @type {boolean}
     * @protected
     */
    _useUniformScaling = false;

    /**
     * @override
     */
    snapIncrement = 1;

    /**
     * Flips the planes to face the camera.
     *
     * @type {boolean}
     */
    flipPlanes = true;

    /**
     * The lower bound for scaling.
     *
     * @type {Vec3}
     */
    lowerBoundScale = new Vec3(-Infinity, -Infinity, -Infinity);

    /**
     * Creates a new ScaleGizmo object.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The render layer.
     * @example
     * const gizmo = new pc.ScaleGizmo(app, camera, layer);
     */
    constructor(camera, layer) {
        super(camera, layer);

        this._createTransform();

        this.on(TransformGizmo.EVENT_TRANSFORMSTART, () => {
            this._storeNodeScales();
        });

        this.on(TransformGizmo.EVENT_TRANSFORMMOVE, (pointDelta) => {
            if (this.snap) {
                pointDelta.mulScalar(1 / this.snapIncrement);
                pointDelta.round();
                pointDelta.mulScalar(this.snapIncrement);
            }
            pointDelta.mulScalar(1 / this._scale);
            this._setNodeScales(pointDelta.add(Vec3.ONE));
        });

        this.on(TransformGizmo.EVENT_NODESDETACH, () => {
            this._nodeScales.clear();
        });

        this._app.on('prerender', () => {
            this._planesLookAtCamera();
        });
    }

    set coordSpace(value) {
        // disallow changing coordSpace for scale
    }

    get coordSpace() {
        return this._coordSpace;
    }

    /**
     * Sets the uniform scaling state for planes.
     *
     * @type {boolean}
     */
    set uniform(value) {
        this._useUniformScaling = value ?? true;
    }

    /**
     * Gets the uniform scaling state for planes.
     *
     * @type {boolean}
     */
    get uniform() {
        return this._useUniformScaling;
    }

    /**
     * Sets the axis gap.
     *
     * @type {number}
     */
    set axisGap(value) {
        this._setArrowProp('gap', value);
    }

    /**
     * Gets the axis gap.
     *
     * @type {number}
     */
    get axisGap() {
        return this._shapes.x.gap;
    }

    /**
     * Sets the axis line thickness.
     *
     * @type {number}
     */
    set axisLineThickness(value) {
        this._setArrowProp('lineThickness', value);
    }

    /**
     * Gets the axis line thickness.
     *
     * @type {number}
     */
    get axisLineThickness() {
        return this._shapes.x.lineThickness;
    }

    /**
     * Sets the axis line length.
     *
     * @type {number}
     */
    set axisLineLength(value) {
        this._setArrowProp('lineLength', value);
    }

    /**
     * Gets the axis line length.
     *
     * @type {number}
     */
    get axisLineLength() {
        return this._shapes.x.lineLength;
    }

    /**
     * Sets the axis line tolerance.
     *
     * @type {number}
     */
    set axisLineTolerance(value) {
        this._setArrowProp('tolerance', value);
    }

    /**
     * Gets the axis line tolerance.
     *
     * @type {number}
     */
    get axisLineTolerance() {
        return this._shapes.x.tolerance;
    }

    /**
     * Sets the axis box size.
     *
     * @type {number}
     */
    set axisBoxSize(value) {
        this._setArrowProp('boxSize', value);
    }

    /**
     * Gets the axis box size.
     *
     * @type {number}
     */
    get axisBoxSize() {
        return this._shapes.x.boxSize;
    }

    /**
     * Sets the plane size.
     *
     * @type {number}
     */
    set axisPlaneSize(value) {
        this._setPlaneProp('size', value);
    }

    /**
     * Gets the plane size.
     *
     * @type {number}
     */
    get axisPlaneSize() {
        return this._shapes.yz.size;
    }

    /**
     * Sets the plane gap.
     *
     * @type {number}
     */
    set axisPlaneGap(value) {
        this._setPlaneProp('gap', value);
    }

    /**
     * Gets the plane gap.
     *
     * @type {number}
     */
    get axisPlaneGap() {
        return this._shapes.yz.gap;
    }

    /**
     * Sets the axis center size.
     *
     * @type {number}
     */
    set axisCenterSize(value) {
        this._shapes.xyz.size = value;
    }

    /**
     * Gets the axis center size.
     *
     * @type {number}
     */
    get axisCenterSize() {
        return this._shapes.xyz.size;
    }

    /**
     * Sets the axis center tolerance.
     *
     * @type {number}
     */
    set axisCenterTolerance(value) {
        this._shapes.xyz.tolerance = value;
    }

    /**
     * Gets the axis center tolerance.
     *
     * @type {number}
     */
    get axisCenterTolerance() {
        return this._shapes.xyz.tolerance;
    }

    /**
     * @param {string} prop - The property name.
     * @param {any} value - The property value.
     * @private
     */
    _setArrowProp(prop, value) {
        this._shapes.x[prop] = value;
        this._shapes.y[prop] = value;
        this._shapes.z[prop] = value;
    }

    /**
     * @param {string} prop - The property name.
     * @param {any} value - The property value.
     * @private
     */
    _setPlaneProp(prop, value) {
        this._shapes.yz[prop] = value;
        this._shapes.xz[prop] = value;
        this._shapes.xy[prop] = value;
    }

    /**
     * @private
     */
    _planesLookAtCamera() {
        tmpV1.cross(this._camera.entity.forward, this.root.right);
        this._shapes.yz.entity.enabled = tmpV1.length() < GLANCE_EPSILON;
        if (this.flipPlanes) {
            this._shapes.yz.flipped = tmpV2.set(0, +(tmpV1.dot(this.root.forward) > 0), +(tmpV1.dot(this.root.up) > 0));
        }

        tmpV1.cross(this._camera.entity.forward, this.root.forward);
        this._shapes.xy.entity.enabled = tmpV1.length() < GLANCE_EPSILON;
        if (this.flipPlanes) {
            this._shapes.xy.flipped = tmpV2.set(+(tmpV1.dot(this.root.up) > 0), +(tmpV1.dot(this.root.right) < 0), 0);
        }

        tmpV1.cross(this._camera.entity.forward, this.root.up);
        this._shapes.xz.entity.enabled = tmpV1.length() < GLANCE_EPSILON;
        if (this.flipPlanes) {
            this._shapes.xz.flipped = tmpV2.set(+(tmpV1.dot(this.root.forward) < 0), 0, +(tmpV1.dot(this.root.right) < 0));
        }
    }

    /**
     * @private
     */
    _storeNodeScales() {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            this._nodeScales.set(node, node.getLocalScale().clone());
        }
    }

    /**
     * @param {Vec3} pointDelta - The point delta.
     * @private
     */
    _setNodeScales(pointDelta) {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            const scale = this._nodeScales.get(node);
            if (!scale) {
                continue;
            }
            node.setLocalScale(tmpV1.copy(scale).mul(pointDelta).max(this.lowerBoundScale));
        }
    }

    /**
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @returns {{ point: Vec3, angle: number }} The point and angle.
     * @protected
     */
    _screenToPoint(x, y) {
        const gizmoPos = this.root.getPosition();
        const mouseWPos = this._camera.screenToWorld(x, y, 1);

        const axis = this._selectedAxis;

        const isPlane = this._selectedIsPlane;
        const isScaleUniform = (this._useUniformScaling && isPlane) || axis === GIZMOAXIS_XYZ;

        const ray = this._createRay(mouseWPos);
        const plane = this._createPlane(axis, isScaleUniform, !isPlane);

        const point = new Vec3();
        const angle = 0;

        plane.intersectsRay(ray, point);

        if (isScaleUniform) {
            // calculate projecion vector for scale direction
            switch (axis) {
                case GIZMOAXIS_X:
                    tmpV1.copy(this.root.up);
                    tmpV2.copy(this.root.forward).mulScalar(-1);
                    break;
                case GIZMOAXIS_Y:
                    tmpV1.copy(this.root.right);
                    tmpV2.copy(this.root.forward).mulScalar(-1);
                    break;
                case GIZMOAXIS_Z:
                    tmpV1.copy(this.root.up);
                    tmpV2.copy(this.root.right);
                    break;
                default:
                    // defaults to all axes
                    tmpV1.copy(this._camera.entity.up);
                    tmpV2.copy(this._camera.entity.right);
                    break;
            }
            tmpV2.add(tmpV1).normalize();
            tmpV1.sub2(point, gizmoPos);
            const length = tmpV1.length();
            const v = length * tmpV1.normalize().dot(tmpV2);
            point.set(v, v, v);

            // keep scale of axis constant if not all axes are selected
            if (axis !== GIZMOAXIS_XYZ) {
                point[axis] = 1;
            }

            return { point, angle };
        }

        // rotate point back to world coords
        tmpQ1.copy(this._rootStartRot).invert().transformVector(point, point);

        if (!isPlane) {
            this._projectToAxis(point, axis);
        }

        return { point, angle };
    }
}

export { ScaleGizmo };

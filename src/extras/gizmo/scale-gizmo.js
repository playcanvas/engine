import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';

import { AxisBoxCenter, AxisBoxLine, AxisPlane } from './axis-shapes.js';
import { GIZMO_LOCAL } from './gizmo.js';
import { TransformGizmo } from "./transform-gizmo.js";

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpQ1 = new Quat();

/**
 * Scaling gizmo.
 *
 * @category Gizmo
 */
class ScaleGizmo extends TransformGizmo {
    _shapes = {
        xyz: new AxisBoxCenter(this._device, {
            axis: 'xyz',
            layers: [this._layer.id],
            defaultColor: this._meshColors.axis.xyz,
            hoverColor: this._meshColors.hover.xyz
        }),
        yz: new AxisPlane(this._device, {
            axis: 'x',
            flipAxis: 'y',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._meshColors.axis.x,
            hoverColor: this._meshColors.hover.x
        }),
        xz: new AxisPlane(this._device, {
            axis: 'y',
            flipAxis: 'z',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._meshColors.axis.y,
            hoverColor: this._meshColors.hover.y
        }),
        xy: new AxisPlane(this._device, {
            axis: 'z',
            flipAxis: 'x',
            layers: [this._layer.id],
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._meshColors.axis.z,
            hoverColor: this._meshColors.hover.z
        }),
        x: new AxisBoxLine(this._device, {
            axis: 'x',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._meshColors.axis.x,
            hoverColor: this._meshColors.hover.x
        }),
        y: new AxisBoxLine(this._device, {
            axis: 'y',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._meshColors.axis.y,
            hoverColor: this._meshColors.hover.y
        }),
        z: new AxisBoxLine(this._device, {
            axis: 'z',
            layers: [this._layer.id],
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._meshColors.axis.z,
            hoverColor: this._meshColors.hover.z
        })
    };

    _coordSpace = GIZMO_LOCAL;

    /**
     * Internal mapping from each attached node to their starting scale.
     *
     * @type {Map<import('../../scene/graph-node.js').GraphNode, Vec3>}
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
     * Creates a new ScaleGizmo object.
     *
     * @param {import('../../framework/app-base.js').AppBase} app - The application instance.
     * @param {import('../../framework/components/camera/component.js').CameraComponent} camera -
     * The camera component.
     * @param {import('../../scene/layer.js').Layer} layer - The render layer.
     * @example
     * const gizmo = new pc.ScaleGizmo(app, camera, layer);
     */
    constructor(app, camera, layer) {
        super(app, camera, layer);

        this._createTransform();

        this.on('transform:start', () => {
            this._selectionStartPoint.sub(Vec3.ONE);
            this._storeNodeScales();
        });

        this.on('transform:move', (pointDelta) => {
            if (this.snap) {
                pointDelta.mulScalar(1 / this.snapIncrement);
                pointDelta.round();
                pointDelta.mulScalar(this.snapIncrement);
            }
            this._setNodeScales(pointDelta);
        });

        this.on('nodes:detach', () => {
            this._nodeScales.clear();
        });
    }

    set coordSpace(value) {
        // disallow changing coordSpace for scale
    }

    get coordSpace() {
        return this._coordSpace;
    }

    /**
     * Uniform scaling state for planes.
     *
     * @type {boolean}
     */
    set uniform(value) {
        this._useUniformScaling = value ?? true;
    }

    get uniform() {
        return this._useUniformScaling;
    }

    /**
     * Axis gap.
     *
     * @type {number}
     */
    set axisGap(value) {
        this._setArrowProp('gap', value);
    }

    get axisGap() {
        return this._shapes.x.gap;
    }

    /**
     * Axis line thickness.
     *
     * @type {number}
     */
    set axisLineThickness(value) {
        this._setArrowProp('lineThickness', value);
    }

    get axisLineThickness() {
        return this._shapes.x.lineThickness;
    }

    /**
     * Axis line length.
     *
     * @type {number}
     */
    set axisLineLength(value) {
        this._setArrowProp('lineLength', value);
    }

    get axisLineLength() {
        return this._shapes.x.lineLength;
    }

    /**
     * Axis line tolerance.
     *
     * @type {number}
     */
    set axisLineTolerance(value) {
        this._setArrowProp('tolerance', value);
    }

    get axisLineTolerance() {
        return this._shapes.x.tolerance;
    }

    /**
     * Axis box size.
     *
     * @type {number}
     */
    set axisBoxSize(value) {
        this._setArrowProp('boxSize', value);
    }

    get axisBoxSize() {
        return this._shapes.x.boxSize;
    }

    /**
     * Plane size.
     *
     * @type {number}
     */
    set axisPlaneSize(value) {
        this._setPlaneProp('size', value);
    }

    get axisPlaneSize() {
        return this._shapes.yz.size;
    }

    /**
     * Plane gap.
     *
     * @type {number}
     */
    set axisPlaneGap(value) {
        this._setPlaneProp('gap', value);
    }

    get axisPlaneGap() {
        return this._shapes.yz.gap;
    }

    /**
     * Axis center size.
     *
     * @type {number}
     */
    set axisCenterSize(value) {
        this._shapes.xyz.size = value;
    }

    get axisCenterSize() {
        return this._shapes.xyz.size;
    }

    /**
     * Axis center tolerance.
     *
     * @type {number}
     */
    set axisCenterTolerance(value) {
        this._shapes.xyz.tolerance = value;
    }

    get axisCenterTolerance() {
        return this._shapes.xyz.tolerance;
    }

    _setArrowProp(prop, value) {
        this._shapes.x[prop] = value;
        this._shapes.y[prop] = value;
        this._shapes.z[prop] = value;
    }

    _setPlaneProp(prop, value) {
        this._shapes.yz[prop] = value;
        this._shapes.xz[prop] = value;
        this._shapes.xy[prop] = value;
    }

    _storeNodeScales() {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            this._nodeScales.set(node, node.getLocalScale().clone());
        }
    }

    _setNodeScales(pointDelta) {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            node.setLocalScale(this._nodeScales.get(node).clone().mul(pointDelta));
        }
    }

    _calcPoint(x, y) {
        const gizmoPos = this.root.getPosition();
        const mouseWPos = this._camera.screenToWorld(x, y, 1);

        const axis = this._selectedAxis;

        const isPlane = this._selectedIsPlane;
        const isScaleUniform = (this._useUniformScaling && isPlane) || axis === 'xyz';

        const ray = this._createRay(mouseWPos);
        const plane = this._createPlane(axis, isScaleUniform, !isPlane);

        const point = new Vec3();
        const angle = 0;

        plane.intersectsRay(ray, point);

        if (isScaleUniform) {
            // calculate projecion vector for scale direction
            switch (axis) {
                case 'x':
                    tmpV1.copy(this.root.up);
                    tmpV2.copy(this.root.forward).mulScalar(-1);
                    break;
                case 'y':
                    tmpV1.copy(this.root.right);
                    tmpV2.copy(this.root.forward).mulScalar(-1);
                    break;
                case 'z':
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
            if (axis !== 'xyz') {
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

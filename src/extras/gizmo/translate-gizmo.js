import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';

import { AxisArrow, AxisPlane, AxisSphereCenter } from './axis-shapes.js';
import { GIZMO_LOCAL } from './gizmo.js';
import {
    SHAPEAXIS_FACE,
    SHAPEAXIS_X,
    SHAPEAXIS_Y,
    SHAPEAXIS_Z,
    TransformGizmo
} from './transform-gizmo.js';

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpQ1 = new Quat();

/**
 * Translation gizmo.
 *
 * @category Gizmo
 */
class TranslateGizmo extends TransformGizmo {
    _shapes = {
        face: new AxisSphereCenter(this._device, {
            axis: SHAPEAXIS_FACE,
            layers: [this._layer.id],
            defaultColor: this._meshColors.axis.xyz,
            hoverColor: this._meshColors.hover.xyz
        }),
        yz: new AxisPlane(this._device, {
            axis: SHAPEAXIS_X,
            flipAxis: SHAPEAXIS_Y,
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._meshColors.axis.x,
            hoverColor: this._meshColors.hover.x
        }),
        xz: new AxisPlane(this._device, {
            axis: SHAPEAXIS_Y,
            flipAxis: SHAPEAXIS_Z,
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._meshColors.axis.y,
            hoverColor: this._meshColors.hover.y
        }),
        xy: new AxisPlane(this._device, {
            axis: SHAPEAXIS_Z,
            flipAxis: SHAPEAXIS_X,
            layers: [this._layer.id],
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._meshColors.axis.z,
            hoverColor: this._meshColors.hover.z
        }),
        x: new AxisArrow(this._device, {
            axis: SHAPEAXIS_X,
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._meshColors.axis.x,
            hoverColor: this._meshColors.hover.x
        }),
        y: new AxisArrow(this._device, {
            axis: SHAPEAXIS_Y,
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._meshColors.axis.y,
            hoverColor: this._meshColors.hover.y
        }),
        z: new AxisArrow(this._device, {
            axis: SHAPEAXIS_Z,
            layers: [this._layer.id],
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._meshColors.axis.z,
            hoverColor: this._meshColors.hover.z
        })
    };

    /**
     * Internal mapping from each attached node to their starting position in local space.
     *
     * @type {Map<import('../../scene/graph-node.js').GraphNode, Vec3>}
     * @private
     */
    _nodeLocalPositions = new Map();

    /**
     * Internal mapping from each attached node to their starting position in world space.
     *
     * @type {Map<import('../../scene/graph-node.js').GraphNode, Vec3>}
     * @private
     */
    _nodePositions = new Map();

    /**
     * @override
     */
    snapIncrement = 1;

    /**
     * Creates a new TranslateGizmo object.
     *
     * @param {import('../../framework/app-base.js').AppBase} app - The application instance.
     * @param {import('../../framework/components/camera/component.js').CameraComponent} camera -
     * The camera component.
     * @param {import('../../scene/layer.js').Layer} layer - The render layer.
     * @example
     * const gizmo = new pc.TranslateGizmo(app, camera, layer);
     */
    constructor(app, camera, layer) {
        super(app, camera, layer);

        this._createTransform();

        this.on(TransformGizmo.EVENT_TRANSFORMSTART, () => {
            this._storeNodePositions();
        });

        this.on(TransformGizmo.EVENT_TRANSFORMMOVE, (pointDelta) => {
            if (this.snap) {
                pointDelta.mulScalar(1 / this.snapIncrement);
                pointDelta.round();
                pointDelta.mulScalar(this.snapIncrement);
            }
            this._setNodePositions(pointDelta);
        });

        this.on(TransformGizmo.EVENT_NODESDETACH, () => {
            this._nodeLocalPositions.clear();
            this._nodePositions.clear();
        });
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
     * Sets the arrow thickness.
     *
     * @type {number}
     */
    set axisArrowThickness(value) {
        this._setArrowProp('arrowThickness', value);
    }

    /**
     * Gets the arrow thickness.
     *
     * @type {number}
     */
    get axisArrowThickness() {
        return this._shapes.x.arrowThickness;
    }

    /**
     * Sets the arrow length.
     *
     * @type {number}
     */
    set axisArrowLength(value) {
        this._setArrowProp('arrowLength', value);
    }

    /**
     * Gets the arrow length.
     *
     * @type {number}
     */
    get axisArrowLength() {
        return this._shapes.x.arrowLength;
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
        this._shapes.face.size = value;
    }

    /**
     * Gets the axis center size.
     *
     * @type {number}
     */
    get axisCenterSize() {
        return this._shapes.face.size;
    }

    /**
     * Sets the axis center tolerance.
     *
     * @type {number}
     */
    set axisCenterTolerance(value) {
        this._shapes.face.tolerance = value;
    }

    /**
     * Gets the axis center tolerance.
     *
     * @type {number}
     */
    get axisCenterTolerance() {
        return this._shapes.face.tolerance;
    }

    /**
     * @param {string} prop - The property to set.
     * @param {any} value - The value to set.
     * @private
     */
    _setArrowProp(prop, value) {
        this._shapes.x[prop] = value;
        this._shapes.y[prop] = value;
        this._shapes.z[prop] = value;
    }

    /**
     * @param {string} prop - The property to set.
     * @param {any} value - The value to set.
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
    _storeNodePositions() {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            this._nodeLocalPositions.set(node, node.getLocalPosition().clone());
            this._nodePositions.set(node, node.getPosition().clone());
        }
    }

    /**
     * @param {Vec3} pointDelta - The delta to apply to the node positions.
     * @private
     */
    _setNodePositions(pointDelta) {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            const pos = this._nodePositions.get(node);
            if (!pos) {
                continue;
            }
            if (this._coordSpace === GIZMO_LOCAL) {
                tmpV1.copy(pointDelta);
                node.parent?.getWorldTransform().getScale(tmpV2);
                tmpV2.x = 1 / tmpV2.x;
                tmpV2.y = 1 / tmpV2.y;
                tmpV2.z = 1 / tmpV2.z;
                tmpQ1.copy(node.getLocalRotation()).transformVector(tmpV1, tmpV1);
                tmpV1.mul(tmpV2);
                node.setLocalPosition(pos.clone().add(tmpV1));
            } else {
                node.setPosition(pos.clone().add(pointDelta));
            }
        }

        this._updatePosition();
    }

    /**
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @returns {{ point: Vec3, angle: number }} The point and angle.
     * @protected
     */
    _screenToPoint(x, y) {
        const mouseWPos = this._camera.screenToWorld(x, y, 1);

        const axis = this._selectedAxis;
        const isPlane = this._selectedIsPlane;

        const ray = this._createRay(mouseWPos);
        const plane = this._createPlane(axis, axis === SHAPEAXIS_FACE, !isPlane);

        const point = new Vec3();
        const angle = 0;

        plane.intersectsRay(ray, point);

        // rotate point back to world coords
        tmpQ1.copy(this._rootStartRot).invert().transformVector(point, point);

        if (!isPlane && axis !== SHAPEAXIS_FACE) {
            this._projectToAxis(point, axis);
        }

        return { point, angle };
    }
}

export { TranslateGizmo };

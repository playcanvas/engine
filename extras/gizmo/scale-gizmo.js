import {
    Vec3
} from 'playcanvas';

import { AxisBoxCenter, AxisBoxLine, AxisPlane } from './axis-shapes.js';
import { GIZMO_LOCAL } from './gizmo.js';
import { TransformGizmo } from "./transform-gizmo.js";

// temporary variables
const tmpV1 = new Vec3();

/**
 * Scaling gizmo.
 *
 * @augments TransformGizmo
 * @category Gizmo
 */
class ScaleGizmo extends TransformGizmo {
    _shapes = {
        xyz: new AxisBoxCenter(this._device, {
            axis: 'xyz',
            layers: [this._layer.id],
            defaultMaterial: this._materials.axis.xyz,
            hoverMaterial: this._materials.hover.xyz
        }),
        yz: new AxisPlane(this._device, {
            axis: 'x',
            flipAxis: 'y',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, -90),
            defaultMaterial: this._materials.axis.x.cullNone,
            hoverMaterial: this._materials.hover.x.cullNone,
            disabledMaterial: this._materials.disabled.cullNone
        }),
        xz: new AxisPlane(this._device, {
            axis: 'y',
            flipAxis: 'z',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultMaterial: this._materials.axis.y.cullNone,
            hoverMaterial: this._materials.hover.y.cullNone,
            disabledMaterial: this._materials.disabled.cullNone
        }),
        xy: new AxisPlane(this._device, {
            axis: 'z',
            flipAxis: 'x',
            layers: [this._layer.id],
            rotation: new Vec3(90, 0, 0),
            defaultMaterial: this._materials.axis.z.cullNone,
            hoverMaterial: this._materials.hover.z.cullNone,
            disabledMaterial: this._materials.disabled.cullNone
        }),
        x: new AxisBoxLine(this._device, {
            axis: 'x',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, -90),
            defaultMaterial: this._materials.axis.x.cullBack,
            hoverMaterial: this._materials.hover.x.cullBack,
            disabledMaterial: this._materials.disabled.cullBack
        }),
        y: new AxisBoxLine(this._device, {
            axis: 'y',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultMaterial: this._materials.axis.y.cullBack,
            hoverMaterial: this._materials.hover.y.cullBack,
            disabledMaterial: this._materials.disabled.cullBack
        }),
        z: new AxisBoxLine(this._device, {
            axis: 'z',
            layers: [this._layer.id],
            rotation: new Vec3(90, 0, 0),
            defaultMaterial: this._materials.axis.z.cullBack,
            hoverMaterial: this._materials.hover.z.cullBack,
            disabledMaterial: this._materials.disabled.cullBack
        })
    };

    _coordSpace = GIZMO_LOCAL;

    /**
     * Internal mapping from each attached node to their starting scale.
     *
     * @type {Map<import('playcanvas').GraphNode, Vec3>}
     * @private
     */
    _nodeScales = new Map();

    /**
     * State for if uniform scaling is enabled for planes. Defaults to true.
     *
     * @type {boolean}
     */
    uniform = true;

    /**
     * @override
     */
    snapIncrement = 1;

    /**
     * Creates a new ScaleGizmo object.
     *
     * @param {import('playcanvas').AppBase} app - The application instance.
     * @param {import('playcanvas').CameraComponent} camera - The camera component.
     * @param {import('playcanvas').Layer} layer - The render layer.
     * @example
     * const gizmo = new pcx.ScaleGizmo(app, camera, layer);
     */
    constructor(app, camera, layer) {
        super(app, camera, layer);

        this._createTransform();

        this.on('transform:start', () => {
            this._selectionStartPoint.sub(Vec3.ONE);
            this._storeNodeScales();
        });

        this.on('transform:move', (pointDelta) => {
            const axis = this._selectedAxis;
            const isPlane = this._selectedIsPlane;
            if (this.snap) {
                pointDelta.mulScalar(1 / this.snapIncrement);
                pointDelta.round();
                pointDelta.mulScalar(this.snapIncrement);
            }
            if (this.uniform && isPlane) {
                tmpV1.set(Math.abs(pointDelta.x), Math.abs(pointDelta.y), Math.abs(pointDelta.z));
                tmpV1[axis] = 0;
                const v = tmpV1.length();
                tmpV1.set(v * Math.sign(pointDelta.x), v * Math.sign(pointDelta.y), v * Math.sign(pointDelta.z));
                tmpV1[axis] = 1;
                pointDelta.copy(tmpV1);
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
}

export { ScaleGizmo };

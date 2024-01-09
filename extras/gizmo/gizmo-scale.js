import {
    Vec3
} from 'playcanvas';

import { AxisBoxCenter, AxisBoxLine, AxisPlane } from './axis-shapes.js';
import { GizmoTransform } from "./gizmo-transform.js";

// temporary variables
const tmpV1 = new Vec3();

/**
 * Scaling gizmo.
 *
 * @augments GizmoTransform
 */
class GizmoScale extends GizmoTransform {
    _shapes = {
        xyz: new AxisBoxCenter({
            axis: 'xyz',
            layers: [this.layer.id],
            defaultColor: this._materials.center,
            hoverColor: this._materials.hover
        }),
        yz: new AxisPlane({
            axis: 'x',
            flipAxis: 'y',
            layers: [this.layer.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._materials.axis.x.cullNone,
            hoverColor: this._materials.hover
        }),
        xz: new AxisPlane({
            axis: 'y',
            flipAxis: 'z',
            layers: [this.layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._materials.axis.y.cullNone,
            hoverColor: this._materials.hover
        }),
        xy: new AxisPlane({
            axis: 'z',
            flipAxis: 'x',
            layers: [this.layer.id],
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._materials.axis.z.cullNone,
            hoverColor: this._materials.hover
        }),
        x: new AxisBoxLine({
            axis: 'x',
            layers: [this.layer.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._materials.axis.x.cullBack,
            hoverColor: this._materials.hover
        }),
        y: new AxisBoxLine({
            axis: 'y',
            layers: [this.layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._materials.axis.y.cullBack,
            hoverColor: this._materials.hover
        }),
        z: new AxisBoxLine({
            axis: 'z',
            layers: [this.layer.id],
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._materials.axis.z.cullBack,
            hoverColor: this._materials.hover
        })
    };

    _coordSpace = 'local';

    /**
     * Internal mapping from each attached node to their starting scale.
     *
     * @type {Map<import('playcanvas').GraphNode, Vec3>}
     * @private
     */
    _nodeScales = new Map();

    snapIncrement = 1;

    /**
     * Creates a new GizmoScale object.
     *
     * @param {import('playcanvas').AppBase} app - The application instance.
     * @param {import('playcanvas').CameraComponent} camera - The camera component.
     * @example
     * const gizmo = new pcx.GizmoScale(app, camera);
     */
    constructor(app, camera) {
        super(app, camera);

        this._createTransform();

        this.on('transform:start', (start) => {
            start.sub(Vec3.ONE);
            this._storeNodeScales();
        });

        this.on('transform:move', (axis, offset) => {
            if (this.snap) {
                offset.scale(1 / this.snapIncrement);
                offset.round();
                offset.scale(this.snapIncrement);
            }
            this._setNodeScales(offset);
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

    set axisGap(value) {
        this._setArrowProp('gap', value);
    }

    get axisGap() {
        return this._shapes.x.gap;
    }

    set axisLineThickness(value) {
        this._setArrowProp('lineThickness', value);
    }

    get axisLineThickness() {
        return this._shapes.x.lineThickness;
    }

    set axisLineLength(value) {
        this._setArrowProp('lineLength', value);
    }

    get axisLineLength() {
        return this._shapes.x.lineLength;
    }

    set axisBoxSize(value) {
        this._setArrowProp('boxSize', value);
    }

    get axisBoxSize() {
        return this._shapes.x.boxSize;
    }

    set axisPlaneSize(value) {
        this._setPlaneProp('size', value);
    }

    get axisPlaneSize() {
        return this._shapes.yz.size;
    }

    set axisPlaneGap(value) {
        this._setPlaneProp('gap', value);
    }

    get axisPlaneGap() {
        return this._shapes.yz.gap;
    }

    set axisCenterSize(value) {
        this._shapes.xyz.size = value;
    }

    get axisCenterSize() {
        return this._shapes.xyz.size;
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

    _setNodeScales(point) {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            node.setLocalScale(this._nodeScales.get(node).clone().mul(point));
        }
    }
}

export { GizmoScale };

import {
    Vec3
} from 'playcanvas';

import { AxisBoxCenter, AxisBoxLine, AxisPlane } from './axis-shapes.js';
import { LOCAL_COORD_SPACE } from './gizmo.js';
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
            defaultColor: this._materials.axis.xyz,
            hoverColor: this._materials.hover.xyz
        }),
        yz: new AxisPlane(this._device, {
            axis: 'x',
            flipAxis: 'y',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._materials.axis.x.cullNone,
            hoverColor: this._materials.hover.x.cullNone
        }),
        xz: new AxisPlane(this._device, {
            axis: 'y',
            flipAxis: 'z',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._materials.axis.y.cullNone,
            hoverColor: this._materials.hover.y.cullNone
        }),
        xy: new AxisPlane(this._device, {
            axis: 'z',
            flipAxis: 'x',
            layers: [this._layer.id],
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._materials.axis.z.cullNone,
            hoverColor: this._materials.hover.z.cullNone
        }),
        x: new AxisBoxLine(this._device, {
            axis: 'x',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._materials.axis.x.cullBack,
            hoverColor: this._materials.hover.x.cullBack
        }),
        y: new AxisBoxLine(this._device, {
            axis: 'y',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._materials.axis.y.cullBack,
            hoverColor: this._materials.hover.y.cullBack
        }),
        z: new AxisBoxLine(this._device, {
            axis: 'z',
            layers: [this._layer.id],
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._materials.axis.z.cullBack,
            hoverColor: this._materials.hover.z.cullBack
        })
    };

    _coordSpace = LOCAL_COORD_SPACE;

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

        this.on('key:down', (key, shiftKey, ctrlKey) => {
            this.uniform = ctrlKey;
        });

        this.on('key:up', () => {
            this.uniform = false;
        });

        this.on('transform:start', () => {
            this._selectionStartPoint.sub(Vec3.ONE);
            this._storeNodeScales();
        });

        this.on('transform:move', (pointDelta) => {
            const axis = this._selectedAxis;
            const isPlane = this._selectedIsPlane;
            if (this.snap) {
                pointDelta.scale(1 / this.snapIncrement);
                pointDelta.round();
                pointDelta.scale(this.snapIncrement);
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

    set axisLineTolerance(value) {
        this._setArrowProp('tolerance', value);
    }

    get axisLineTolerance() {
        return this._shapes.x.tolerance;
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

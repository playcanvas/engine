import {
    Quat,
    Vec3
} from 'playcanvas';

import { AxisArrow, AxisPlane } from './axis-shapes.js';
import { LOCAL_COORD_SPACE } from './gizmo.js';
import { TransformGizmo } from "./transform-gizmo.js";

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpQ1 = new Quat();

/**
 * Translation gizmo.
 *
 * @augments TransformGizmo
 * @category Gizmo
 */
class TranslateGizmo extends TransformGizmo {
    _shapes = {
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
        x: new AxisArrow(this._device, {
            axis: 'x',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._materials.axis.x.cullBack,
            hoverColor: this._materials.hover.x.cullBack
        }),
        y: new AxisArrow(this._device, {
            axis: 'y',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._materials.axis.y.cullBack,
            hoverColor: this._materials.hover.y.cullBack
        }),
        z: new AxisArrow(this._device, {
            axis: 'z',
            layers: [this._layer.id],
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._materials.axis.z.cullBack,
            hoverColor: this._materials.hover.z.cullBack
        })
    };

    /**
     * Internal mapping from each attached node to their starting position in local space.
     *
     * @type {Map<import('playcanvas').GraphNode, Vec3>}
     * @private
     */
    _nodeLocalPositions = new Map();

    /**
     * Internal mapping from each attached node to their starting position in world space.
     *
     * @type {Map<import('playcanvas').GraphNode, Vec3>}
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
     * @param {import('playcanvas').AppBase} app - The application instance.
     * @param {import('playcanvas').CameraComponent} camera - The camera component.
     * @param {import('playcanvas').Layer} layer - The render layer.
     * @example
     * const gizmo = new pcx.TranslateGizmo(app, camera, layer);
     */
    constructor(app, camera, layer) {
        super(app, camera, layer);

        this._createTransform();

        this.on('transform:start', () => {
            this._storeNodePositions();
        });

        this.on('transform:move', (pointDelta) => {
            if (this.snap) {
                pointDelta.scale(1 / this.snapIncrement);
                pointDelta.round();
                pointDelta.scale(this.snapIncrement);
            }
            this._setNodePositions(pointDelta);
        });

        this.on('nodes:detach', () => {
            this._nodeLocalPositions.clear();
            this._nodePositions.clear();
        });
    }

    /**
     * Axis gap.
     *
     * @param {number} value - gap.
     */
    set axisGap(value) {
        this._setArrowProp('gap', value);
    }

    /**
     * @type {number}
     */
    get axisGap() {
        return this._shapes.x.gap;
    }

    /**
     * Axis line thickness.
     *
     * @param {number} value - line thickness.
     */
    set axisLineThickness(value) {
        this._setArrowProp('lineThickness', value);
    }

    /**
     * @type {number}
     */
    get axisLineThickness() {
        return this._shapes.x.lineThickness;
    }

    /**
     * Axis line length.
     *
     * @param {number} value - line length.
     */
    set axisLineLength(value) {
        this._setArrowProp('lineLength', value);
    }

    /**
     * @type {number}
     */
    get axisLineLength() {
        return this._shapes.x.lineLength;
    }

    /**
     * Axis line tolerance.
     *
     * @param {number} value - line tolerance.
     */
    set axisLineTolerance(value) {
        this._setArrowProp('tolerance', value);
    }

    /**
     * @type {number}
     */
    get axisLineTolerance() {
        return this._shapes.x.tolerance;
    }

    /**
     * Arrow thickness.
     *
     * @param {number} value - arrow thickness.
     */
    set axisArrowThickness(value) {
        this._setArrowProp('arrowThickness', value);
    }

    /**
     * @type {number}
     */
    get axisArrowThickness() {
        return this._shapes.x.arrowThickness;
    }

    /**
     * Arrow length.
     *
     * @param {number} value - arrow length.
     */
    set axisArrowLength(value) {
        this._setArrowProp('arrowLength', value);
    }

    /**
     * @type {number}
     */
    get axisArrowLength() {
        return this._shapes.x.arrowLength;
    }

    /**
     * Plane size.
     *
     * @param {number} value - plane size.
     */
    set axisPlaneSize(value) {
        this._setPlaneProp('size', value);
    }

    /**
     * @type {number}
     */
    get axisPlaneSize() {
        return this._shapes.yz.size;
    }

    /**
     * Plane gap.
     *
     * @param {number} value - plane gap.
     */
    set axisPlaneGap(value) {
        this._setPlaneProp('gap', value);
    }

    /**
     * @type {number}
     */
    get axisPlaneGap() {
        return this._shapes.yz.gap;
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

    _storeNodePositions() {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            this._nodeLocalPositions.set(node, node.getLocalPosition().clone());
            this._nodePositions.set(node, node.getPosition().clone());
        }
    }

    _setNodePositions(pointDelta) {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            if (this._coordSpace === LOCAL_COORD_SPACE) {
                tmpV1.copy(pointDelta);
                node.parent.getWorldTransform().getScale(tmpV2);
                tmpV2.x = 1 / tmpV2.x;
                tmpV2.y = 1 / tmpV2.y;
                tmpV2.z = 1 / tmpV2.z;
                tmpQ1.copy(node.getLocalRotation()).transformVector(tmpV1, tmpV1);
                tmpV1.mul(tmpV2);
                node.setLocalPosition(this._nodeLocalPositions.get(node).clone().add(tmpV1));
            } else {
                node.setPosition(this._nodePositions.get(node).clone().add(pointDelta));
            }
        }

        this._updatePosition();
    }
}

export { TranslateGizmo };

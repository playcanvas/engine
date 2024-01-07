import {
    Vec3
} from 'playcanvas';

import { AxisBoxCenter, AxisBoxLine, AxisPlane } from './axis-shapes.js';
import { GizmoTransform } from "./gizmo-transform.js";

// temporary variables
const tmpV1 = new Vec3();

class GizmoScale extends GizmoTransform {
    _axisShapes = {
        xyz: new AxisBoxCenter({
            axis: 'xyz',
            layers: [this.layerGizmo.id],
            defaultColor: this._materials.center,
            hoverColor: this._materials.hover
        }),
        yz: new AxisPlane({
            axis: 'x',
            flipAxis: 'y',
            layers: [this.layerGizmo.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._materials.axis.x,
            hoverColor: this._materials.hover
        }),
        xz: new AxisPlane({
            axis: 'y',
            flipAxis: 'z',
            layers: [this.layerGizmo.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._materials.axis.y,
            hoverColor: this._materials.hover
        }),
        xy: new AxisPlane({
            axis: 'z',
            flipAxis: 'x',
            layers: [this.layerGizmo.id],
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._materials.axis.z,
            hoverColor: this._materials.hover
        }),
        x: new AxisBoxLine({
            axis: 'x',
            layers: [this.layerGizmo.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._materials.axis.x,
            hoverColor: this._materials.hover
        }),
        y: new AxisBoxLine({
            axis: 'y',
            layers: [this.layerGizmo.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._materials.axis.y,
            hoverColor: this._materials.hover
        }),
        z: new AxisBoxLine({
            axis: 'z',
            layers: [this.layerGizmo.id],
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._materials.axis.z,
            hoverColor: this._materials.hover
        })
    };

    _coordSpace = 'local';

    _nodeScales = new Map();

    snapIncrement = 1;

    constructor(...args) {
        super(...args);

        this._createTransform();

        this._planes = [];
        for (const key in this._axisShapes) {
            const shape = this._axisShapes[key];
            if (!(shape instanceof AxisPlane)) {
                continue;
            }
            this._planes.push(shape);
        }
        this._checkForPlaneFlip();

        this.on('transform:start', (start) => {
            start.sub(Vec3.ONE);
            this._storeNodeScales();
            this._checkForPlaneFlip();
        });

        this.on('transform:move', (axis, offset) => {
            if (this.snap) {
                offset.scale(1 / this.snapIncrement);
                offset.round();
                offset.scale(this.snapIncrement);
            }
            this._setNodeScales(offset);
            this._checkForPlaneFlip();
        });

        this.on('nodes:attach', () => {
            this._checkForPlaneFlip();
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
        return this._axisShapes.x.gap;
    }

    set axisLineThickness(value) {
        this._setArrowProp('lineThickness', value);
    }

    get axisLineThickness() {
        return this._axisShapes.x.lineThickness;
    }

    set axisLineLength(value) {
        this._setArrowProp('lineLength', value);
    }

    get axisLineLength() {
        return this._axisShapes.x.lineLength;
    }

    set axisBoxSize(value) {
        this._setArrowProp('boxSize', value);
    }

    get axisBoxSize() {
        return this._axisShapes.x.boxSize;
    }

    set axisPlaneSize(value) {
        this._setPlaneProp('size', value);
    }

    get axisPlaneSize() {
        return this._axisShapes.yz.size;
    }

    set axisPlaneGap(value) {
        this._setPlaneProp('gap', value);
    }

    get axisPlaneGap() {
        return this._axisShapes.yz.gap;
    }

    set axisCenterSize(value) {
        this._axisShapes.xyz.size = value;
    }

    get axisCenterSize() {
        return this._axisShapes.xyz.size;
    }

    _setArrowProp(propName, value) {
        this._axisShapes.x[propName] = value;
        this._axisShapes.y[propName] = value;
        this._axisShapes.z[propName] = value;
    }

    _setPlaneProp(propName, value) {
        this._axisShapes.yz[propName] = value;
        this._axisShapes.xz[propName] = value;
        this._axisShapes.xy[propName] = value;
    }

    _createTransform() {
        super._createTransform();

        // shapes
        for (const key in this._axisShapes) {
            const shape = this._axisShapes[key];
            this._center.addChild(shape.entity);
            for (let i = 0; i < shape.meshInstances.length; i++) {
                this._shapeMap.set(shape.meshInstances[i], shape);
            }
        }
    }

    _checkForPlaneFlip() {
        const gizmoPos = this.gizmo.getPosition();
        const cameraPos = this.camera.getPosition();
        tmpV1.copy(cameraPos).sub(gizmoPos).normalize();

        for (let i = 0; i < this._planes.length; i++) {
            this._planes[i].checkForFlip(tmpV1);
        }
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

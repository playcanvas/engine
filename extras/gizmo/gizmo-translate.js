import {
    Quat,
    Vec3
} from 'playcanvas';

import { AxisArrow, AxisPlane } from './axis-shapes.js';
import { GizmoTransform } from "./gizmo-transform.js";

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpQ1 = new Quat();

class GizmoTranslate extends GizmoTransform {
    _axisShapes = {
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
        x: new AxisArrow({
            axis: 'x',
            layers: [this.layerGizmo.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._materials.axis.x,
            hoverColor: this._materials.hover
        }),
        y: new AxisArrow({
            axis: 'y',
            layers: [this.layerGizmo.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._materials.axis.y,
            hoverColor: this._materials.hover
        }),
        z: new AxisArrow({
            axis: 'z',
            layers: [this.layerGizmo.id],
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._materials.axis.z,
            hoverColor: this._materials.hover
        })
    };

    _nodeLocalPositions = new Map();

    _nodePositions = new Map();

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

        this.on('transform:start', () => {
            this._storeNodePositions();
            this._checkForPlaneFlip();
        });

        this.on('transform:move', (axis, offset) => {
            if (this.snap) {
                offset.scale(1 / this.snapIncrement);
                offset.round();
                offset.scale(this.snapIncrement);
            }
            this._setNodePositions(offset);
            this._checkForPlaneFlip();
        });

        this.on('coordSpace:set', () => {
            this._checkForPlaneFlip();
        });

        this.on('nodes:attach', () => {
            this._checkForPlaneFlip();
        });

        this.on('nodes:detach', () => {
            this._nodeLocalPositions.clear();
            this._nodePositions.clear();
        });
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

    set axisArrowThickness(value) {
        this._setArrowProp('arrowThickness', value);
    }

    get axisArrowThickness() {
        return this._axisShapes.x.arrowThickness;
    }

    set axisArrowLength(value) {
        this._setArrowProp('arrowLength', value);
    }

    get axisArrowLength() {
        return this._axisShapes.x.arrowLength;
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

    _storeNodePositions() {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            this._nodeLocalPositions.set(node, node.getLocalPosition().clone());
            this._nodePositions.set(node, node.getPosition().clone());
        }
    }

    _setNodePositions(point) {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            if (this._coordSpace === 'local') {
                tmpV1.copy(point);
                node.parent.getWorldTransform().getScale(tmpV2);
                tmpV2.x = 1 / tmpV2.x;
                tmpV2.y = 1 / tmpV2.y;
                tmpV2.z = 1 / tmpV2.z;
                tmpQ1.copy(node.getLocalRotation()).transformVector(tmpV1, tmpV1);
                tmpV1.mul(tmpV2);
                node.setLocalPosition(this._nodeLocalPositions.get(node).clone().add(tmpV1));
            } else {
                node.setPosition(this._nodePositions.get(node).clone().add(point));
            }
        }

        this.updatePosition();
    }
}

export { GizmoTranslate };

import {
    Entity,
    Quat,
    Vec3
} from 'playcanvas'

import { AxisShape, GizmoTransform } from "./gizmo-transform.js";

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();
const tmpQ1 = new Quat();

// constants
const VEC3_AXES = Object.keys(tmpV1);

class AxisPlane extends AxisShape {
    _size = 0.2;

    _gap = 0.1;

    constructor(options) {
        super(options);

        this._flipAxis = options.flipAxis ?? 'x';

        this._createPlane(options.layers ?? []);
    }

    _getPosition() {
        const position = new Vec3();
        for (let i = 0; i < VEC3_AXES.length; i++) {
            const axis = VEC3_AXES[i];
            if (axis === this.axis) {
                continue;
            }
            position[axis] = this._size / 2 + this._gap;
        }
        return position;
    }

    _createPlane(layers) {
        this.entity = new Entity('plane_' + this.axis);
        this.entity.addComponent('render', {
            type: 'plane',
            layers: layers,
            material: this._defaultColor,
            castShadows: false
        });
        this.entity.setLocalPosition(this._getPosition());
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._size, this._size, this._size);
        this.meshInstances.push(...this.entity.render.meshInstances);
    }

    set size(value) {
        this._size = value ?? 1;
        this.entity.setLocalPosition(this._getPosition());
        this.entity.setLocalScale(this._size, this._size, this._size);
    }

    get size() {
        return this._size;
    }

    set gap(value) {
        this._gap = value ?? 0;
        this.entity.setLocalPosition(this._getPosition());
    }

    get gap() {
        return this._gap;
    }

    checkForFlip(screenDir) {
        tmpV2.set(0, 1, 0);
        tmpQ1.copy(this.entity.getRotation()).transformVector(tmpV2, tmpV2);
        const dot = screenDir.dot(tmpV2);
        if (dot > 0) {
            return;
        }
        tmpV3.copy(this.entity.getLocalEulerAngles());
        tmpV3[this._flipAxis] = 180 - tmpV3[this._flipAxis];
        this.entity.setLocalEulerAngles(tmpV3);
    }
}

class AxisArrow extends AxisShape {
    _gap = 0;

    _lineThickness = 0.04;

    _lineLength = 0.5;

    _arrowThickness = 0.15;

    _arrowLength = 0.2;

    constructor(options = {}) {
        super(options);

        this._createArrow(options.layers ?? []);
    }

    set gap(value) {
        this._gap = value ?? 0;
        this._updateLine();
        this._updateArrow();
    }

    get gap() {
        return this._gap;
    }

    set lineThickness(value) {
        this._lineThickness = value ?? 1;
        this._updateLine();
        this._updateArrow();
    }

    get lineThickness() {
        return this._lineThickness;
    }

    set lineLength(value) {
        this._lineLength = value ?? 1;
        this._updateLine();
        this._updateArrow();
    }

    get lineLength() {
        return this._lineLength;
    }

    set arrowThickness(value) {
        this._arrowThickness = value ?? 1;
        this._updateArrow();
    }

    get arrowThickness() {
        return this._arrowThickness;
    }

    set arrowLength(value) {
        this._arrowLength = value ?? 1;
        this._updateArrow();
    }

    get arrowLength() {
        return this._arrowLength;
    }

    _createArrow(layers) {
        this.entity = new Entity('axis_' + this.axis);
        this.entity.setLocalPosition(this._position);
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._scale);

        this._line = new Entity('line_' + this.axis);
        this._line.addComponent('render', {
            type: 'cylinder',
            layers: layers,
            material: this._defaultColor,
            castShadows: false
        });
        this._updateLine();
        this.entity.addChild(this._line);
        this.meshInstances.push(...this._line.render.meshInstances);

        this._arrow = new Entity('arrow_' + this.axis);
        this._arrow.addComponent('render', {
            type: 'cone',
            layers: layers,
            material: this._defaultColor,
            castShadows: false
        });
        this._updateArrow();
        this.entity.addChild(this._arrow);
        this.meshInstances.push(...this._arrow.render.meshInstances);
    }

    _updateLine() {
        this._line.setLocalPosition(new Vec3(0, this._gap + this._lineLength * 0.5, 0));
        this._line.setLocalScale(new Vec3(this._lineThickness, this._lineLength, this._lineThickness));
    }

    _updateArrow() {
        this._arrow.setLocalPosition(new Vec3(0, this._gap + this._arrowLength * 0.5 + this._lineLength, 0));
        this._arrow.setLocalScale(new Vec3(this._arrowThickness, this._arrowLength, this._arrowThickness));
    }
}

class GizmoTranslate extends GizmoTransform {
    _nodeLocalPositions = new Map();

    _nodePositions = new Map();

    snapIncrement = 1;

    constructor(app, camera) {
        super(app, camera);

        this._axisShapes = {
            yz: new AxisPlane({
                axis: 'x',
                flipAxis: 'y',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(0, 0, -90),
                defaultColor: this._materials.opaque.red,
                hoverColor: this._materials.opaque.yellow
            }),
            xz: new AxisPlane({
                axis: 'y',
                flipAxis: 'z',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(0, 0, 0),
                defaultColor: this._materials.opaque.green,
                hoverColor: this._materials.opaque.yellow
            }),
            xy: new AxisPlane({
                axis: 'z',
                flipAxis: 'x',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(90, 0, 0),
                defaultColor: this._materials.opaque.blue,
                hoverColor: this._materials.opaque.yellow
            }),
            x: new AxisArrow({
                axis: 'x',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(0, 0, -90),
                defaultColor: this._materials.opaque.red,
                hoverColor: this._materials.opaque.yellow
            }),
            y: new AxisArrow({
                axis: 'y',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(0, 0, 0),
                defaultColor: this._materials.opaque.green,
                hoverColor: this._materials.opaque.yellow
            }),
            z: new AxisArrow({
                axis: 'z',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(90, 0, 0),
                defaultColor: this._materials.opaque.blue,
                hoverColor: this._materials.opaque.yellow
            })
        };

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

        // elements
        for (const key in this._axisShapes) {
            const shape = this._axisShapes[key];
            this._center.addChild(shape.entity);
            for (let i = 0; i < shape.meshInstances.length; i++) {
                this.elementMap.set(shape.meshInstances[i], shape);
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

        this.updateGizmoPosition();
    }

    attach(nodes) {
        super.attach(nodes);

        this._checkForPlaneFlip();
    }

    detach() {
        this._nodeLocalPositions.clear();
        this._nodePositions.clear();

        super.detach();
    }
}

export { GizmoTranslate };

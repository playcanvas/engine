import {
    Entity,
    Vec3,
    Quat
} from 'playcanvas'

import { AxisShape, GizmoTransform } from "./gizmo-transform.js";

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpQ = new Quat();

// constants
const VEC3_AXES = Object.keys(tmpV1);
const GUIDELINE_SIZE = 1e3;

class AxisPlane extends AxisShape {
    _size = 0.2;

    constructor(options) {
        super(options);

        this._createPlane(options.layers ?? []);
    }

    _getPosition() {
        const position = new Vec3();
        for (let i = 0; i < VEC3_AXES.length; i++) {
            const axis = VEC3_AXES[i];
            if (axis === this.axis) {
                continue;
            }
            position[axis] = this._size / 2;
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
}

class AxisBoxLine extends AxisShape {
    _gap = 0;

    _lineThickness = 0.04;

    _lineLength = 0.5;

    _boxSize = 0.15;

    constructor(options = {}) {
        super(options);

        this._createBoxLine(options.layers ?? []);
    }

    set gap(value) {
        this._gap = value ?? 0;
        this._updateLine();
        this._updateBox();
    }

    get gap() {
        return this._gap;
    }

    set lineThickness(value) {
        this._lineThickness = value ?? 1;
        this._updateLine();
        this._updateBox();
    }

    get lineThickness() {
        return this._lineThickness;
    }

    set lineLength(value) {
        this._lineLength = value ?? 1;
        this._updateLine();
        this._updateBox();
    }

    get lineLength() {
        return this._lineLength;
    }

    set boxSize(value) {
        this._boxSize = value ?? 1;
        this._updateBox();
    }

    get boxSize() {
        return this._boxSize;
    }

    _createBoxLine(layers) {
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

        this._box = new Entity('box_' + this.axis);
        this._box.addComponent('render', {
            type: 'box',
            layers: layers,
            material: this._defaultColor,
            castShadows: false
        });
        this._updateBox();
        this.entity.addChild(this._box);
        this.meshInstances.push(...this._box.render.meshInstances);
    }

    _updateLine() {
        this._line.setLocalPosition(new Vec3(0, this._gap + this._lineLength * 0.5, 0));
        this._line.setLocalScale(new Vec3(this._lineThickness, this._lineLength, this._lineThickness));
    }

    _updateBox() {
        this._box.setLocalPosition(new Vec3(0, this._gap + this._boxSize * 0.5 + this._lineLength, 0));
        this._box.setLocalScale(new Vec3(this._boxSize, this._boxSize, this._boxSize));
    }
}

class GizmoScale extends GizmoTransform {
    materials;

    elements;

    elementMap = new Map();

    _dirtyElement;

    constructor(app, camera) {
        super(app, camera);

        this._axisShapes = {
            x: new AxisBoxLine({
                axis: 'x',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(0, 0, -90),
                defaultColor: this._materials.semi.red,
                hoverColor: this._materials.opaque.red
            }),
            y: new AxisBoxLine({
                axis: 'y',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(0, 0, 0),
                defaultColor: this._materials.semi.green,
                hoverColor: this._materials.opaque.green
            }),
            z: new AxisBoxLine({
                axis: 'z',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(90, 0, 0),
                defaultColor: this._materials.semi.blue,
                hoverColor: this._materials.opaque.blue
            }),
            yz: new AxisPlane({
                axis: 'x',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(0, 0, -90),
                defaultColor: this._materials.semi.red,
                hoverColor: this._materials.opaque.red
            }),
            xz: new AxisPlane({
                axis: 'y',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(0, 0, 0),
                defaultColor: this._materials.semi.green,
                hoverColor: this._materials.opaque.green
            }),
            xy: new AxisPlane({
                axis: 'z',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(90, 0, 0),
                defaultColor: this._materials.semi.blue,
                hoverColor: this._materials.opaque.blue
            })
        };

        this._createTransform();

        this.dragging = false;
        this._hoverAxis = '';
        this._hoverIsPlane = false;
        this._currAxis = '';
        this._currIsPlane = false;
        this._pointStart = new Vec3();
        this._offset = new Vec3();

        this.on('transform:start', () => {
            this.storeNodeScale();
        });

        this.on('transform:move', (offset) => {
            this.updateNodeScale(offset);
        });
    }

    _drawGuideLine(pos, axis) {
        tmpV1.set(0, 0, 0);
        tmpV1[axis] = 1;
        tmpV1.scale(GUIDELINE_SIZE);
        tmpV2.copy(tmpV1).scale(-1);
        tmpQ.transformVector(tmpV1, tmpV1);
        tmpQ.transformVector(tmpV2, tmpV2);
        this.app.drawLine(tmpV1.add(pos), tmpV2.add(pos), this._guideLineColor, true, this.layerGizmo);
    }

    set axisGap(value) {
        this._updateArrowProp('gap', value ?? 0);
    }

    get axisGap() {
        return this._axisShapes.x.gap;
    }

    set axisLineThickness(value) {
        this._updateArrowProp('lineThickness', value ?? 1);
    }

    get axisLineThickness() {
        return this._axisShapes.x.lineThickness;
    }

    set axisLineLength(value) {
        this._updateArrowProp('lineLength', value ?? 1);
    }

    get axisLineLength() {
        return this._axisShapes.x.lineLength;
    }

    set axisBoxSize(value) {
        this._updateArrowProp('boxSize', value ?? 1);
    }

    get axisBoxSize() {
        return this._axisShapes.x.boxSize;
    }

    set axisPlaneSize(value) {
        this._axisPlaneSize = value ?? 1;
        this._updatePlaneProp('size', this._axisPlaneSize);
    }

    get axisPlaneSize() {
        return this._axisShapes.yz.size;
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

    _updateArrowProp(propName, value) {
        this._axisShapes.x[propName] = value;
        this._axisShapes.y[propName] = value;
        this._axisShapes.z[propName] = value;
    }

    _updatePlaneProp(propName, value) {
        this._axisShapes.yz[propName] = value;
        this._axisShapes.xz[propName] = value;
        this._axisShapes.xy[propName] = value;
    }
}

export { GizmoScale };

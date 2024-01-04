import {
    Entity,
    Vec3
} from 'playcanvas'

import { AxisShape, GizmoTransform } from "./gizmo-transform.js";

// temporary variables
const tmpV1 = new Vec3();

// constants
const VEC3_AXES = Object.keys(tmpV1);

class AxisPlane extends AxisShape {
    _size = 0.2;

    _gap = 0.1;

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
    constructor(app, camera) {
        super(app, camera);

        this._axisShapes = {
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
            }),
            yz: new AxisPlane({
                axis: 'x',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(0, 0, -90),
                defaultColor: this._materials.opaque.red,
                hoverColor: this._materials.opaque.yellow
            }),
            xz: new AxisPlane({
                axis: 'y',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(0, 0, 0),
                defaultColor: this._materials.opaque.green,
                hoverColor: this._materials.opaque.yellow
            }),
            xy: new AxisPlane({
                axis: 'z',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(90, 0, 0),
                defaultColor: this._materials.opaque.blue,
                hoverColor: this._materials.opaque.yellow
            })
        };

        this._createTransform();

        this.on('transform:start', () => {
            this.storeNodePositions();
        });

        this.on('transform:move', (axis, offset) => {
            this.updateNodePositions(offset);
        });
    }

    set axisGap(value) {
        this._updateArrowProp('gap', value);
    }

    get axisGap() {
        return this._axisShapes.x.gap;
    }

    set axisLineThickness(value) {
        this._updateArrowProp('lineThickness', value);
    }

    get axisLineThickness() {
        return this._axisShapes.x.lineThickness;
    }

    set axisLineLength(value) {
        this._updateArrowProp('lineLength', value);
    }

    get axisLineLength() {
        return this._axisShapes.x.lineLength;
    }

    set axisArrowThickness(value) {
        this._updateArrowProp('arrowThickness', value);
    }

    get axisArrowThickness() {
        return this._axisShapes.x.arrowThickness;
    }

    set axisArrowLength(value) {
        this._updateArrowProp('arrowLength', value);
    }

    get axisArrowLength() {
        return this._axisShapes.x.arrowLength;
    }

    set axisPlaneSize(value) {
        this._updatePlaneProp('size', value);
    }

    get axisPlaneSize() {
        return this._axisShapes.yz.size;
    }

    set axisPlaneGap(value) {
        this._updatePlaneProp('gap', value);
    }

    get axisPlaneGap() {
        return this._axisShapes.x.gap;
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

export { GizmoTranslate };

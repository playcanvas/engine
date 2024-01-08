import {
    createTorus,
    Color,
    MeshInstance,
    Entity,
    Vec3,
    Quat
} from 'playcanvas';

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpQ1 = new Quat();

// constants
const TORUS_SEGMENTS = 80;

class AxisShape {
    _position;

    _rotation;

    _scale;

    _defaultColor;

    _hoverColor;

    axis;

    entity;

    meshInstances = [];

    constructor(options) {
        this.axis = options.axis ?? 'x';
        this._position = options.position ?? new Vec3();
        this._rotation = options.rotation ?? new Vec3();
        this._scale = options.scale ?? new Vec3(1, 1, 1);

        this._defaultColor = options.defaultColor ?? Color.BLACK;
        this._hoverColor = options.hoverColor ?? Color.WHITE;
    }

    hover(state) {
        const material = state ? this._hoverColor : this._defaultColor;
        for (let i = 0; i < this.meshInstances.length; i++) {
            this.meshInstances[i].material = material;
        }
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
        this._line.setLocalPosition(0, this._gap + this._lineLength * 0.5, 0);
        this._line.setLocalScale(this._lineThickness, this._lineLength, this._lineThickness);
    }

    _updateArrow() {
        this._arrow.setLocalPosition(0, this._gap + this._arrowLength * 0.5 + this._lineLength, 0);
        this._arrow.setLocalScale(this._arrowThickness, this._arrowLength, this._arrowThickness);
    }
}

class AxisBoxCenter extends AxisShape {
    _size = 0.14;

    constructor(options = {}) {
        super(options);

        this._createCenter(options.layers ?? []);
    }

    _createCenter(layers) {
        this.entity = new Entity('center_' + this.axis);
        this.entity.addComponent('render', {
            type: 'box',
            layers: layers,
            material: this._defaultColor,
            castShadows: false
        });
        this.entity.setLocalPosition(this._position);
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._size, this._size, this._size);
        this.meshInstances.push(...this.entity.render.meshInstances);
    }

    set size(value) {
        this._size = value ?? 1;
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

    _boxSize = 0.14;

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

class AxisDisk extends AxisShape {
    _device;

    _tubeRadius = 0.02;

    _ringRadius = 0.55;

    constructor(options = {}) {
        super(options);

        this._device = options.device;

        this._tubeRadius = options.tubeRadius ?? this._tubeRadius;
        this._ringRadius = options.ringRadius ?? this._ringRadius;

        this._createDisk(options.layers ?? []);
    }

    _createDisk(layers) {
        const meshInstance = new MeshInstance(this._createTorusMesh(), this._defaultColor);

        this.entity = new Entity('disk_' + this.axis);
        this.entity.addComponent('render', {
            meshInstances: [meshInstance],
            layers: layers,
            castShadows: false
        });
        this.entity.setLocalPosition(this._position);
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._scale);
        this.meshInstances.push(meshInstance);
    }

    _createTorusMesh() {
        return createTorus(this._device, {
            tubeRadius: this._tubeRadius,
            ringRadius: this._ringRadius,
            segments: TORUS_SEGMENTS
        });
    }

    set tubeRadius(value) {
        this._tubeRadius = value ?? 0.1;
        this.meshInstances[0].mesh = this._createTorusMesh();
    }

    get tubeRadius() {
        return this._tubeRadius;
    }

    set ringRadius(value) {
        this._ringRadius = value ?? 0.1;
        this.meshInstances[0].mesh = this._createTorusMesh();
    }

    get ringRadius() {
        return this._ringRadius;
    }
}

class AxisPlane extends AxisShape {
    _size = 0.2;

    _gap = 0.1;

    constructor(options) {
        super(options);

        this._flipAxis = options.flipAxis ?? 'x';

        this._createPlane(options.layers ?? []);
    }

    _getPosition() {
        const offset = this._size / 2 + this._gap;
        const position = new Vec3(offset, offset, offset);
        position[this.axis] = 0;
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
        tmpV1.set(0, 1, 0);
        tmpQ1.copy(this.entity.getRotation()).transformVector(tmpV1, tmpV1);
        const dot = screenDir.dot(tmpV1);
        if (dot > 0) {
            return;
        }
        tmpV2.copy(this.entity.getLocalEulerAngles());
        tmpV2[this._flipAxis] = 180 - tmpV2[this._flipAxis];
        this.entity.setLocalEulerAngles(tmpV2);
    }
}

export { AxisShape, AxisArrow, AxisBoxCenter, AxisBoxLine, AxisDisk, AxisPlane };

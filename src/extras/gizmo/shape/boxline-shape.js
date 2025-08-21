import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Entity } from '../../../framework/entity.js';
import { BoxGeometry } from '../../../scene/geometry/box-geometry.js';
import { CylinderGeometry } from '../../../scene/geometry/cylinder-geometry.js';
import { TriData } from '../tri-data.js';
import { Shape } from './shape.js';

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpQ1 = new Quat();

class BoxLineShape extends Shape {
    _gap = 0;

    _lineThickness = 0.02;

    _lineLength = 0.5;

    _boxSize = 0.12;

    _tolerance = 0.1;

    _box;

    _line;

    _flipped = false;

    constructor(device, options = {}) {
        super(device, options);

        this.triData = [
            new TriData(new BoxGeometry()),
            new TriData(new CylinderGeometry(), 1)
        ];

        this._createRoot('boxLine');

        // box
        this._box = new Entity(`box:${this.axis}`);
        this.entity.addChild(this._box);
        this._updateBox();
        this._addRenderMesh(this._box, 'box', this._shading);

        // line
        this._line = new Entity(`line:${this.axis}`);
        this.entity.addChild(this._line);
        this._updateLine();
        this._addRenderMesh(this._line, 'cylinder', this._shading);
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

    set tolerance(value) {
        this._tolerance = value;
        this._updateLine();
    }

    get tolerance() {
        return this._tolerance;
    }

    set flipped(value) {
        if (this._flipped === value) {
            return;
        }
        this._flipped = value;
        if (this._rotation.equals(Vec3.ZERO)) {
            tmpV1.set(0, 0, this._flipped ? 180 : 0);
        } else {
            tmpV1.copy(this._rotation).mulScalar(this._flipped ? -1 : 1);
        }

        this._line.enabled = !this._flipped;
        this.entity.setLocalEulerAngles(tmpV1);
    }

    get flipped() {
        return this._flipped;
    }

    _updateBox() {
        // intersect
        tmpV1.set(0, this._gap + this._boxSize * 0.5 + this._lineLength, 0);
        tmpQ1.set(0, 0, 0, 1);
        tmpV2.set(this._boxSize, this._boxSize, this._boxSize);
        this.triData[0].setTransform(tmpV1, tmpQ1, tmpV2);

        // render
        this._box.setLocalPosition(0, this._gap + this._boxSize * 0.5 + this._lineLength, 0);
        this._box.setLocalScale(this._boxSize, this._boxSize, this._boxSize);
    }

    _updateLine() {
        // intersect
        tmpV1.set(0, this._gap + this._lineLength * 0.5, 0);
        tmpQ1.set(0, 0, 0, 1);
        tmpV2.set(this._lineThickness + this._tolerance, this._lineLength, this._lineThickness + this._tolerance);
        this.triData[1].setTransform(tmpV1, tmpQ1, tmpV2);

        // render
        this._line.setLocalPosition(0, this._gap + this._lineLength * 0.5, 0);
        this._line.setLocalScale(this._lineThickness, this._lineLength, this._lineThickness);
    }
}

export { BoxLineShape };

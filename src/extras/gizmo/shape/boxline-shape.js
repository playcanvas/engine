import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Entity } from '../../../framework/entity.js';
import { BoxGeometry } from '../../../scene/geometry/box-geometry.js';
import { CylinderGeometry } from '../../../scene/geometry/cylinder-geometry.js';
import { Mesh } from '../../../scene/mesh.js';
import { TriData } from '../tri-data.js';
import { Shape } from './shape.js';

/** @import { ShapeArgs } from './shape.js' */
/** @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js' */

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpQ1 = new Quat();

/**
 * @typedef {object} BoxLineShapeArgs
 * @property {number} [gap] - The gap between the box and the line
 * @property {number} [lineThickness] - The thickness of the line
 * @property {number} [lineLength] - The length of the line
 * @property {number} [boxSize] - The size of the box
 * @property {number} [tolerance] - The tolerance for intersection tests
 */

/**
 * @ignore
 */
class BoxLineShape extends Shape {
    /**
     * The internal gap between the box and the line.
     *
     * @type {number}
     * @private
     */
    _gap = 0;

    /**
     * The internal line thickness of the box line.
     *
     * @type {number}
     * @private
     */
    _lineThickness = 0.02;

    /**
     * The internal line length of the box line.
     *
     * @type {number}
     * @private
     */
    _lineLength = 0.5;

    /**
     * The internal box size of the box line.
     *
     * @type {number}
     * @private
     */
    _boxSize = 0.12;

    /**
     * The internal tolerance of the box line.
     *
     * @type {number}
     * @private
     */
    _tolerance = 0.1;

    /**
     * The internal box entity of the box line.
     *
     * @type {Entity}
     * @private
     */
    _box;

    /**
     * The internal line entity of the box line.
     *
     * @type {Entity}
     * @private
     */
    _line;

    /**
     * The internal flipped state of the box line.
     *
     * @type {boolean}
     * @private
     */
    _flipped = false;

    /**
     * Create a new BoxLineShape.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {ShapeArgs & BoxLineShapeArgs} args - The shape options.
     */
    constructor(device, args = {}) {
        super(device, 'boxLine', args);

        this._gap = args.gap ?? this._gap;
        this._lineThickness = args.lineThickness ?? this._lineThickness;
        this._lineLength = args.lineLength ?? this._lineLength;
        this._boxSize = args.boxSize ?? this._boxSize;
        this._tolerance = args.tolerance ?? this._tolerance;

        // intersect
        this.triData = [
            new TriData(new BoxGeometry()),
            new TriData(new CylinderGeometry(), 1)
        ];

        // render
        this._box = new Entity(`box:${this.axis}`);
        this.entity.addChild(this._box);
        this._createRenderComponent(this._box, [
            Mesh.fromGeometry(this.device, new BoxGeometry())
        ]);
        this._line = new Entity(`line:${this.axis}`);
        this.entity.addChild(this._line);
        this._createRenderComponent(this._line, [
            Mesh.fromGeometry(this.device, new CylinderGeometry())
        ]);

        // update transform
        this._update();
    }

    /**
     * Set the gap between the box and the line.
     *
     * @type {number}
     */
    set gap(value) {
        this._gap = value ?? this._gap;
        this._update();
    }

    /**
     * Get the gap between the box and the line.
     *
     * @type {number}
     */
    get gap() {
        return this._gap;
    }

    /**
     * Set the line thickness of the box line.
     *
     * @type {number}
     */
    set lineThickness(value) {
        this._lineThickness = value ?? this._lineThickness;
        this._update();
    }

    /**
     * Get the line thickness of the box line.
     *
     * @type {number}
     */
    get lineThickness() {
        return this._lineThickness;
    }

    /**
     * Set the line length of the box line.
     *
     * @type {number}
     */
    set lineLength(value) {
        this._lineLength = value ?? this._lineLength;
        this._update();
    }

    /**
     * Get the line length of the box line.
     *
     * @type {number}
     */
    get lineLength() {
        return this._lineLength;
    }

    /**
     * Set the box size of the box line.
     *
     * @type {number}
     */
    set boxSize(value) {
        this._boxSize = value ?? this._boxSize;
        this._update();
    }

    /**
     * Get the box size of the box line.
     *
     * @type {number}
     */
    get boxSize() {
        return this._boxSize;
    }

    /**
     * Set the tolerance of the box line.
     *
     * @type {number}
     */
    set tolerance(value) {
        this._tolerance = value;
        this._update();
    }

    /**
     * Get the tolerance of the box line.
     *
     * @type {number}
     */
    get tolerance() {
        return this._tolerance;
    }

    /**
     * Set the flipped state of the box line.
     *
     * @type {boolean}
     */
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

    /**
     * Get the flipped state of the box line.
     *
     * @type {boolean}
     */
    get flipped() {
        return this._flipped;
    }

    /**
     * Update the shape's transform.
     *
     * @protected
     * @override
     */
    _update() {
        // intersect
        tmpV1.set(0, this._gap + this._boxSize * 0.5 + this._lineLength, 0);
        tmpQ1.set(0, 0, 0, 1);
        tmpV2.set(this._boxSize, this._boxSize, this._boxSize);
        this.triData[0].setTransform(tmpV1, tmpQ1, tmpV2);
        tmpV1.set(0, this._gap + this._lineLength * 0.5, 0);
        tmpQ1.set(0, 0, 0, 1);
        tmpV2.set(this._lineThickness + this._tolerance, this._lineLength, this._lineThickness + this._tolerance);
        this.triData[1].setTransform(tmpV1, tmpQ1, tmpV2);

        // render
        this._box.setLocalPosition(0, this._gap + this._boxSize * 0.5 + this._lineLength, 0);
        this._box.setLocalScale(this._boxSize, this._boxSize, this._boxSize);
        this._line.setLocalPosition(0, this._gap + this._lineLength * 0.5, 0);
        this._line.setLocalScale(this._lineThickness, this._lineLength, this._lineThickness);
    }
}

export { BoxLineShape };

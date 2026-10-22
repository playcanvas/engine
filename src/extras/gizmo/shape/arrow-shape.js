import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Entity } from '../../../framework/entity.js';
import { ConeGeometry } from '../../../scene/geometry/cone-geometry.js';
import { CylinderGeometry } from '../../../scene/geometry/cylinder-geometry.js';
import { Mesh } from '../../../scene/mesh.js';
import { TriData } from './tri-data.js';
import { Shape } from './shape.js';

/**
 * @import { ShapeArgs } from './shape.js'
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpQ1 = new Quat();

/**
 * @typedef {object} ArrowShapeArgs
 * @property {number} [gap] - The gap between the arrow base and the center
 * @property {number} [lineThickness] - The thickness of the line
 * @property {number} [lineLength] - The length of the line
 * @property {number} [arrowThickness] - The thickness of the arrow head
 * @property {number} [arrowLength] - The length of the arrow head
 * @property {number} [tolerance] - The tolerance for intersection tests
 */

/**
 * @ignore
 */
class ArrowShape extends Shape {
    /**
     * The gap between the arrow base and the center.
     *
     * @private
     */
    _gap = 0;

    /**
     * The line thickness.
     *
     * @private
     */
    _lineThickness = 0.02;

    /**
     * The line length.
     *
     * @private
     */
    _lineLength = 0.5;

    /**
     * The head thickness.
     *
     * @private
     */
    _arrowThickness = 0.12;

    /**
     * The head length.
     *
     * @private
     */
    _arrowLength = 0.18;

    /**
     * The intersection tolerance.
     *
     * @private
     */
    _tolerance = 0.1;

    /**
     * The head entity.
     *
     * @type {Entity}
     * @private
     */
    _head;

    /**
     * The line entity.
     *
     * @type {Entity}
     * @private
     */
    _line;

    /**
     * Create a new ArrowShape.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {ShapeArgs & ArrowShapeArgs} args - The shape options.
     */
    constructor(device, args = {}) {
        super(device, 'arrow', args);

        this._gap = args.gap ?? this._gap;
        this._lineThickness = args.lineThickness ?? this._lineThickness;
        this._lineLength = args.lineLength ?? this._lineLength;
        this._arrowThickness = args.arrowThickness ?? this._arrowThickness;
        this._arrowLength = args.arrowLength ?? this._arrowLength;
        this._tolerance = args.tolerance ?? this._tolerance;

        this.triData = [
            new TriData(new ConeGeometry()),
            new TriData(new CylinderGeometry(), 1)
        ];

        this._head = new Entity(`head:${this.axis}`);
        this.entity.addChild(this._head);
        this._createRenderComponent(this._head, [
            Mesh.fromGeometry(this.device, new ConeGeometry())
        ]);
        this._line = new Entity(`line:${this.axis}`);
        this.entity.addChild(this._line);
        this._createRenderComponent(this._line, [
            Mesh.fromGeometry(this.device, new CylinderGeometry())
        ]);

        this._update();
    }

    /**
     * Set the gap between the arrow base and the center.
     *
     * @type {number}
     */
    set gap(value) {
        this._gap = value ?? this._gap;
        this._update();
    }

    /**
     * Get the gap between the arrow base and the center.
     *
     * @type {number}
     */
    get gap() {
        return this._gap;
    }

    /**
     * Set the line thickness.
     *
     * @type {number}
     */
    set lineThickness(value) {
        this._lineThickness = value ?? this._lineThickness;
        this._update();
    }

    /**
     * Get the line thickness.
     *
     * @type {number}
     */
    get lineThickness() {
        return this._lineThickness;
    }

    /**
     * Set the line length.
     *
     * @type {number}
     */
    set lineLength(value) {
        this._lineLength = value ?? this._lineLength;
        this._update();
    }

    /**
     * Get the line length.
     *
     * @type {number}
     */
    get lineLength() {
        return this._lineLength;
    }

    /**
     * Set the head thickness.
     *
     * @type {number}
     */
    set arrowThickness(value) {
        this._arrowThickness = value ?? this._arrowThickness;
        this._update();
    }

    /**
     * Get the head thickness.
     *
     * @type {number}
     */
    get arrowThickness() {
        return this._arrowThickness;
    }

    /**
     * Set the head length.
     *
     * @type {number}
     */
    set arrowLength(value) {
        this._arrowLength = value ?? this._arrowLength;
        this._update();
    }

    /**
     * Get the head length.
     *
     * @type {number}
     */
    get arrowLength() {
        return this._arrowLength;
    }

    /**
     * Set the intersection tolerance.
     *
     * @type {number}
     */
    set tolerance(value) {
        this._tolerance = value;
        this._update();
    }

    /**
     * Get the intersection tolerance.
     *
     * @type {number}
     */
    get tolerance() {
        return this._tolerance;
    }

    /**
     * Updates the transform.
     *
     * @protected
     * @override
     */
    _update() {
        tmpV1.set(0, this._gap + this._arrowLength * 0.5 + this._lineLength, 0);
        tmpQ1.set(0, 0, 0, 1);
        tmpV2.set(this._arrowThickness, this._arrowLength, this._arrowThickness);
        this.triData[0].setTransform(tmpV1, tmpQ1, tmpV2);
        tmpV1.set(0, this._gap + this._lineLength * 0.5, 0);
        tmpQ1.set(0, 0, 0, 1);
        tmpV2.set(this._lineThickness + this._tolerance, this._lineLength, this._lineThickness + this._tolerance);
        this.triData[1].setTransform(tmpV1, tmpQ1, tmpV2);

        this._head.setLocalPosition(0, this._gap + this._arrowLength * 0.5 + this._lineLength, 0);
        this._head.setLocalScale(this._arrowThickness, this._arrowLength, this._arrowThickness);
        this._line.setLocalPosition(0, this._gap + this._lineLength * 0.5, 0);
        this._line.setLocalScale(this._lineThickness, this._lineLength, this._lineThickness);
    }
}

export { ArrowShape };

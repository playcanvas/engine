import { BoxGeometry } from '../../../scene/geometry/box-geometry.js';
import { TriData } from '../tri-data.js';
import { Shape } from './shape.js';

/** @import { ShapeArgs } from './shape.js' */
/** @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js' */

/**
 * @typedef {object} BoxShapeArgs
 * @property {number} [size] - The size of the box.
 * @property {number} [tolerance] - The intersection tolerance of the box.
 */

class BoxShape extends Shape {
    /**
     * The internal size of the box.
     *
     * @type {number}
     * @private
     */
    _size = 0.12;

    /**
     * The internal intersection tolerance of the box.
     *
     * @type {number}
     * @private
     */
    _tolerance = 0.05;

    /**
     * Create a new BoxShape.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {ShapeArgs & BoxShapeArgs} args - The shape options.
     */
    constructor(device, args = {}) {
        super(device, 'boxCenter', args);

        this._size = args.size ?? this._size;
        this._tolerance = args.tolerance ?? this._tolerance;

        // intersect
        this.triData = [
            new TriData(new BoxGeometry(), 2)
        ];

        // render
        this._addRenderMesh(this.entity, 'box');

        // update transform
        this._update();
    }

    /**
     * Set the rendered size of the box.
     *
     * @param {number} value - The new size of the box.
     */
    set size(value) {
        this._size = value ?? this._size;
        this._update();
    }

    /**
     * Get the rendered size of the box.
     *
     * @returns {number} The size of the box.
     */
    get size() {
        return this._size;
    }

    /**
     * Set the intersection tolerance of the box.
     *
     * @param {number} value - The new tolerance of the box.
     */
    set tolerance(value) {
        this._tolerance = value ?? this._tolerance;
        this._update();
    }

    /**
     * Get the intersection tolerance of the box.
     *
     * @returns {number} The tolerance of the box.
     */
    get tolerance() {
        return this._tolerance;
    }

    /**
     * Update the shapes's transform.
     *
     * @protected
     * @override
     */
    _update() {
        // intersect/render
        this.entity.setLocalScale(this._size, this._size, this._size);
    }
}

export { BoxShape };

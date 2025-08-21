import { SphereGeometry } from '../../../scene/geometry/sphere-geometry.js';
import { TriData } from '../tri-data.js';
import { Shape } from './shape.js';

/** @import { ShapeArgs } from './shape.js' */
/** @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js' */

/**
 * @typedef {object} SphereShapeArgs
 * @property {number} [size] - The size of the sphere.
 * @property {number} [tolerance] - The intersection tolerance of the sphere.
 */

/**
 * @ignore
 */
class SphereShape extends Shape {
    /**
     * The internal size of the sphere.
     *
     * @type {number}
     * @private
     */
    _size = 0.12;

    /**
     * The internal intersection tolerance of the sphere.
     *
     * @type {number}
     * @private
     */
    _tolerance = 0.05;

    /**
     * Create a new SphereShape.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {ShapeArgs & SphereShapeArgs} args - The shape options.
     */
    constructor(device, args = {}) {
        super(device, 'sphereCenter', args);

        this._size = args.size ?? this._size;
        this._tolerance = args.tolerance ?? this._tolerance;

        // intersect
        this.triData = [
            new TriData(new SphereGeometry(), 2)
        ];

        // render
        this._addRenderMesh(this.entity, 'sphere');

        // update transform
        this._update();
    }

    /**
     * Set the rendered size of the sphere.
     *
     * @param {number} value - The new size of the sphere.
     */
    set size(value) {
        this._size = value ?? this._size;
        this._update();
    }

    /**
     * Get the rendered size of the sphere.
     *
     * @returns {number} The size of the sphere.
     */
    get size() {
        return this._size;
    }

    /**
     * Set the intersection tolerance of the sphere.
     *
     * @param {number} value - The new tolerance of the sphere.
     */
    set tolerance(value) {
        this._tolerance = value ?? this._tolerance;
        this._update();
    }

    /**
     * Get the intersection tolerance of the sphere.
     *
     * @returns {number} The tolerance of the sphere.
     */
    get tolerance() {
        return this._tolerance;
    }

    /**
     * Update the shape's transform.
     *
     * @protected
     * @override
     */
    _update() {
        // intersect/render
        this.entity.setLocalScale(this._size, this._size, this._size);
    }
}

export { SphereShape };

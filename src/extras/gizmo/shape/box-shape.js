import { BoxGeometry } from '../../../scene/geometry/box-geometry.js';
import { Mesh } from '../../../scene/mesh.js';
import { TriData } from '../tri-data.js';
import { Shape } from './shape.js';

/** @import { ShapeArgs } from './shape.js' */
/** @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js' */

/**
 * @typedef {object} BoxShapeArgs
 * @property {number} [size] - The size of the box.
 */

/**
 * @ignore
 */
class BoxShape extends Shape {
    /**
     * The internal size of the box.
     *
     * @type {number}
     * @private
     */
    _size = 0.06;

    /**
     * Create a new BoxShape.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {ShapeArgs & BoxShapeArgs} args - The shape options.
     */
    constructor(device, args = {}) {
        super(device, 'boxCenter', args);

        this._size = args.size ?? this._size;

        // intersect
        this.triData = [
            new TriData(new BoxGeometry(), 2)
        ];

        // render
        this._createRenderComponent(this.entity, [
            Mesh.fromGeometry(this.device, new BoxGeometry())
        ]);

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

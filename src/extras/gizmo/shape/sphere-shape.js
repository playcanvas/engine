import { SphereGeometry } from '../../../scene/geometry/sphere-geometry.js';
import { Mesh } from '../../../scene/mesh.js';
import { TriData } from './tri-data.js';
import { Shape } from './shape.js';

/**
 * @import { ShapeArgs } from './shape.js'
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

/**
 * @typedef {object} SphereShapeArgs
 * @property {number} [radius] - The radius of the sphere.
 */

/**
 * @ignore
 */
class SphereShape extends Shape {
    /**
     * The size.
     *
     * @private
     */
    _radius = 0.03;

    /**
     * Create a new SphereShape.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {ShapeArgs & SphereShapeArgs} args - The shape options.
     */
    constructor(device, args = {}) {
        super(device, 'sphereCenter', args);

        this._radius = args.radius ?? this._radius;

        this.triData = [
            new TriData(new SphereGeometry(), 2)
        ];

        this._createRenderComponent(this.entity, [
            Mesh.fromGeometry(this.device, new SphereGeometry({
                latitudeBands: 32,
                longitudeBands: 32
            }))
        ]);

        this._update();
    }

    /**
     * Set the rendered radius.
     *
     * @param {number} value - The new radius of the sphere.
     */
    set radius(value) {
        this._radius = value ?? this._radius;
        this._update();
    }

    /**
     * Get the rendered radius.
     *
     * @returns {number} The radius of the sphere.
     */
    get radius() {
        return this._radius;
    }

    /**
     * Updates the transform.
     *
     * @protected
     * @override
     */
    _update() {
        const scale = this._radius * 2;
        this.entity.setLocalScale(scale, scale, scale);
    }
}

export { SphereShape };

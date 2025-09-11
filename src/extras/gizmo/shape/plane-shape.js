import { Vec3 } from '../../../core/math/vec3.js';
import { CULLFACE_NONE } from '../../../platform/graphics/constants.js';
import { PlaneGeometry } from '../../../scene/geometry/plane-geometry.js';
import { Mesh } from '../../../scene/mesh.js';
import { TriData } from '../tri-data.js';
import { Shape } from './shape.js';

/** @import { ShapeArgs } from './shape.js' */
/** @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js' */

const UPDATE_EPSILON = 1e-6;

/**
 * @typedef {object} PlaneShapeArgs
 * @property {number} [size] - The size of the plane
 * @property {number} [gap] - The gap between the plane and the center
 */

/**
 * @ignore
 */
class PlaneShape extends Shape {
    /**
     * The culling mode for the plane.
     *
     * @type {number}
     * @protected
     */
    _cull = CULLFACE_NONE;

    /**
     * The size of the plane.
     *
     * @type {number}
     * @private
     */
    _size = 0.14;

    /**
     * The gap between the plane and the center.
     *
     * @type {number}
     * @private
     */
    _gap = 0.04;

    /**
     * The internal flipped state of the plane.
     *
     * @type {Vec3}
     * @private
     */
    _flipped = new Vec3();

    /**
     * Create a new PlaneShape.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {ShapeArgs & PlaneShapeArgs} args - The shape options.
     */
    constructor(device, args = {}) {
        super(device, 'plane', args);

        this._size = args.size ?? this._size;
        this._gap = args.gap ?? this._gap;

        // intersect
        this.triData = [
            new TriData(new PlaneGeometry())
        ];

        // render
        this._createRenderComponent(this.entity, [
            Mesh.fromGeometry(this.device, new PlaneGeometry())
        ]);

        // update transform
        this._update();
    }

    /**
     * Set the size of the plane.
     *
     * @type {number}
     */
    set size(value) {
        this._size = value ?? this._size;
        this._update();
    }

    /**
     * Get the size of the plane.
     *
     * @type {number}
     */
    get size() {
        return this._size;
    }

    /**
     * Set the gap between the plane and the center.
     *
     * @type {number}
     */
    set gap(value) {
        this._gap = value ?? this._gap;
        this._update();
    }

    /**
     * Get the gap between the plane and the center.
     *
     * @type {number}
     */
    get gap() {
        return this._gap;
    }

    /**
     * Set the flipped state of the plane.
     *
     * @type {Vec3}
     */
    set flipped(value) {
        if (this._flipped.distance(value) < UPDATE_EPSILON) {
            return;
        }
        this._flipped.copy(value);
        this._update();
    }

    /**
     * Get the flipped state of the plane.
     *
     * @type {Vec3}
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
        // intersect/render
        const offset = this._size / 2 + this._gap;
        this._position.set(
            this._flipped.x ? -offset : offset,
            this._flipped.y ? -offset : offset,
            this._flipped.z ? -offset : offset
        );
        this._position[this.axis] = 0;
        this.entity.setLocalPosition(this._position);
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._size, this._size, this._size);
    }
}

export { PlaneShape };

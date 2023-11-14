import { Vec3 } from '../math/vec3.js';

/**
 * An infinite ray.
 *
 * @category Math
 */
class Ray {
    /**
     * The starting point of the ray.
     *
     * @readonly
     * @type {Vec3}
     */
    origin = new Vec3();

    /**
     * The direction of the ray.
     *
     * @readonly
     * @type {Vec3}
     */
    direction = Vec3.FORWARD.clone();

    /**
     * Creates a new Ray instance. The ray is infinite, starting at a given origin and pointing in
     * a given direction.
     *
     * @param {Vec3} [origin] - The starting point of the ray. The constructor copies
     * this parameter. Defaults to the origin (0, 0, 0).
     * @param {Vec3} [direction] - The direction of the ray. The constructor copies
     * this parameter. Defaults to a direction down the world negative Z axis (0, 0, -1).
     * @example
     * // Create a new ray starting at the position of this entity and pointing down
     * // the entity's negative Z axis
     * const ray = new pc.Ray(this.entity.getPosition(), this.entity.forward);
     */
    constructor(origin, direction) {
        if (origin) {
            this.origin.copy(origin);
        }
        if (direction) {
            this.direction.copy(direction);
        }
    }

    /**
     * Sets origin and direction to the supplied vector values.
     *
     * @param {Vec3} origin - The starting point of the ray.
     * @param {Vec3} direction - The direction of the ray.
     * @returns {Ray} Self for chaining.
     */
    set(origin, direction) {
        this.origin.copy(origin);
        this.direction.copy(direction);
        return this;
    }

    /**
     * Copies the contents of a source Ray.
     *
     * @param {Ray} src - The Ray to copy from.
     * @returns {Ray} Self for chaining.
     */
    copy(src) {
        return this.set(src.origin, src.direction);
    }

    /**
     * Returns a clone of the Ray.
     *
     * @returns {this} A duplicate Ray.
     */
    clone() {
        return new this.constructor(this.origin, this.direction);
    }
}

export { Ray };

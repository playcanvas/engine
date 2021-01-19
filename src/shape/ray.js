import { Vec3 } from '../math/vec3.js';

/**
 * @class
 * @name Ray
 * @classdesc An infinite ray.
 * @description Creates a new infinite ray starting at a given origin and pointing in a given direction.
 * @example
 * // Create a new ray starting at the position of this entity and pointing down
 * // the entity's negative Z axis
 * var ray = new pc.Ray(this.entity.getPosition(), this.entity.forward);
 * @param {Vec3} [origin] - The starting point of the ray. The constructor takes a reference of this parameter.
 * Defaults to the origin (0, 0, 0).
 * @param {Vec3} [direction] - The direction of the ray. The constructor takes a reference of this parameter.
 * Defaults to a direction down the world negative Z axis (0, 0, -1).
 * @property {pc.Vec3} origin The starting point of the ray.
 * @property {pc.Vec3} direction The direction of the ray.
 */
class Ray {
    constructor(origin = new Vec3(), direction = new Vec3(0, 0, -1)) {
        this.origin = origin;
        this.direction = direction;
    }

    /**
     * @function
     * @name Ray#set
     * @description Sets origin and direction to the supplied vector values.
     * @param {Vec3} origin - The starting point of the ray.
     * @param {Vec3} direction - The direction of the ray.
     * @returns {Ray} Self for chaining.
     */
    set(origin, direction) {
        this.origin.copy(origin);
        this.direction.copy(direction);
        return this;
    }
}

export { Ray };

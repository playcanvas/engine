import { Vec3 } from '../math/vec3';

/**
 * @class
 * @name pc.Ray
 * @classdesc An infinite ray.
 * @description Creates a new infinite ray starting at a given origin and pointing in a given direction.
 * @example
 * // Create a new ray starting at the position of this entity and pointing down
 * // the entity's negative Z axis
 * var ray = new pc.Ray(this.entity.getPosition(), this.entity.forward);
 * @param {pc.Vec3} [origin] - The starting point of the ray. The constructor takes a reference of this parameter.
 * Defaults to the origin (0, 0, 0).
 * @param {pc.Vec3} [direction] - The direction of the ray. The constructor takes a reference of this parameter.
 * Defaults to a direction down the world negative Z axis (0, 0, -1).
 * @property {pc.Vec3} origin The starting point of the ray.
 * @property {pc.Vec3} direction The direction of the ray.
 */
class Ray {
    origin: Vec3;
    direction: Vec3;

    constructor(origin?: Vec3, direction?: Vec3) {
        this.origin = origin || new Vec3(0, 0, 0);
        this.direction = direction || new Vec3(0, 0, -1);
    }

    /**
     * @function
     * @name pc.Ray#set
     * @description Sets origin and direction to the supplied vector values.
     * @param {pc.Vec3} origin - The starting point of the ray.
     * @param {pc.Vec3} direction - The direction of the ray.
     * @returns {pc.Ray} Self for chaining.
     */
    set(origin: Vec3, direction: Vec3): Ray {
        this.origin.copy(origin);
        this.direction.copy(direction);
        return this;
    }
}

export { Ray };

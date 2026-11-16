import { Vec3 } from '../math/vec3.js';

/**
 * @import { Ray } from './ray.js'
 */

const tmpVecA = new Vec3();
const tmpVecB = new Vec3();

/**
 * A bounding sphere is a volume for facilitating fast intersection testing.
 *
 * A sphere is a {@link center} and a {@link radius}. It is the cheapest bounding volume to test, so
 * it suits broad-phase checks made before a finer test. {@link containsPoint},
 * {@link intersectsBoundingSphere} and {@link intersectsRay} return a boolean and allocate nothing.
 * Like {@link BoundingBox}, the constructor copies the center vector it is given, so later changes
 * to that vector do not affect the sphere.
 *
 * @example
 * // A trigger volume 2 units around an entity
 * const sphere = new BoundingSphere(entity.getPosition(), 2);
 * if (sphere.containsPoint(player.getPosition())) {
 *     // the player is within 2 units of the entity
 * }
 * @category Math
 */
class BoundingSphere {
    /**
     * Center of sphere.
     *
     * @type {Vec3}
     * @readonly
     */
    center;

    /**
     * Creates a new BoundingSphere instance.
     *
     * @param {Vec3} [center] - The world space coordinate marking the center of the sphere. The
     * constructor copies this parameter. Defaults to (0, 0, 0).
     * @param {number} [radius] - The radius of the bounding sphere. Defaults to 0.5.
     * @example
     * // Create a new bounding sphere centered on the origin with a radius of 0.5
     * const sphere = new BoundingSphere();
     */
    constructor(center, radius = 0.5) {
        this.center = center ? center.clone() : new Vec3();

        // Assigned here instead of declared as a class field, so V8 can store it as an unboxed
        // double (see Vec3).

        /**
         * The radius of the bounding sphere.
         *
         * @type {number}
         */
        this.radius = radius;
    }

    /**
     * Test if a point is inside the sphere.
     *
     * @param {Vec3} point - Point to test.
     * @returns {boolean} True if the point is inside the sphere and false otherwise.
     * @example
     * const sphere = new BoundingSphere(new Vec3(0, 0, 0), 1);
     * const point = new Vec3(0.5, 0, 0);
     * const isInside = sphere.containsPoint(point); // true
     */
    containsPoint(point) {
        const lenSq = tmpVecA.sub2(point, this.center).lengthSq();
        const r = this.radius;
        return lenSq < r * r;
    }

    /**
     * Test if a ray intersects with the sphere. A ray that starts inside the sphere intersects it.
     *
     * @param {Ray} ray - Ray to test against (direction must be normalized).
     * @param {Vec3} [point] - If there is an intersection, the intersection point will be copied
     * into here. For a ray that starts inside the sphere, this is the point where the ray leaves
     * it.
     * @returns {boolean} True if there is an intersection.
     */
    intersectsRay(ray, point) {
        const m = tmpVecA.copy(ray.origin).sub(this.center);
        const b = m.dot(tmpVecB.copy(ray.direction).normalize());
        const c = m.dot(m) - this.radius * this.radius;

        // exit if ray's origin outside of sphere (c > 0) and ray pointing away from s (b > 0)
        if (c > 0 && b > 0) {
            return false;
        }

        const discr = b * b - c;
        // a negative discriminant corresponds to ray missing sphere
        if (discr < 0) {
            return false;
        }

        // ray intersects sphere; a negative entry distance means the ray starts inside the
        // sphere, so use the exit distance instead
        const sqrtDiscr = Math.sqrt(discr);
        const tEnter = -b - sqrtDiscr;
        const t = tEnter >= 0 ? tEnter : -b + sqrtDiscr;

        if (point) {
            point.copy(ray.direction).mulScalar(t).add(ray.origin);
        }

        return true;
    }

    /**
     * Test if a Bounding Sphere is overlapping, enveloping, or inside this Bounding Sphere.
     *
     * @param {BoundingSphere} sphere - Bounding Sphere to test.
     * @returns {boolean} True if the Bounding Sphere is overlapping, enveloping, or inside this Bounding Sphere and false otherwise.
     */
    intersectsBoundingSphere(sphere) {
        tmpVecA.sub2(sphere.center, this.center);
        const totalRadius = sphere.radius + this.radius;
        if (tmpVecA.lengthSq() <= totalRadius * totalRadius) {
            return true;
        }

        return false;
    }
}

export { BoundingSphere };

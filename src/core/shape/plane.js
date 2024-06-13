import { Vec3 } from '../math/vec3.js';

/**
 * An infinite plane. Internally it's represented in a parametric equation form:
 * ax + by + cz + distance = 0.
 *
 * @category Math
 */
class Plane {
    /**
     * The normal of the plane.
     *
     * @type {Vec3}
     * @readonly
     */
    normal = new Vec3();

    /**
     * The distance from the plane to the origin, along its normal.
     *
     * @type {number}
     */
    distance;

    /**
     * Create a new Plane instance.
     *
     * @param {Vec3} [normal] - Normal of the plane. The constructor copies this parameter. Defaults
     * to {@link Vec3.UP}.
     * @param {number} [distance] - The distance from the plane to the origin, along its normal.
     * Defaults to 0.
     */
    constructor(normal = Vec3.UP, distance = 0) {
        this.normal.copy(normal);
        this.distance = distance;
    }

    /**
     * Sets the plane based on a specified normal and a point on the plane.
     *
     * @param {Vec3} point - The point on the plane.
     * @param {Vec3} normal - The normal of the plane.
     * @returns {Plane} Self for chaining.
     */
    setFromPointNormal(point, normal) {
        this.normal.copy(normal);
        this.distance = -this.normal.dot(point);
        return this;
    }

    /**
     * Test if the plane intersects between two points.
     *
     * @param {Vec3} start - Start position of line.
     * @param {Vec3} end - End position of line.
     * @param {Vec3} [point] - If there is an intersection, the intersection point will be copied
     * into here.
     * @returns {boolean} True if there is an intersection.
     */
    intersectsLine(start, end, point) {
        const d = this.distance;
        const d0 = this.normal.dot(start) + d;
        const d1 = this.normal.dot(end) + d;

        const t = d0 / (d0 - d1);
        const intersects = t >= 0 && t <= 1;
        if (intersects && point)
            point.lerp(start, end, t);

        return intersects;
    }

    /**
     * Test if a ray intersects with the infinite plane.
     *
     * @param {import('./ray.js').Ray} ray - Ray to test against (direction must be normalized).
     * @param {Vec3} [point] - If there is an intersection, the intersection point will be copied
     * into here.
     * @returns {boolean} True if there is an intersection.
     */
    intersectsRay(ray, point) {
        const denominator = this.normal.dot(ray.direction);
        if (denominator === 0)
            return false;

        const t = -(this.normal.dot(ray.origin) + this.distance) / denominator;
        if (t >= 0 && point) {
            point.copy(ray.direction).mulScalar(t).add(ray.origin);
        }

        return t >= 0;
    }

    /**
     * Copies the contents of a source Plane.
     *
     * @param {Plane} src - The Plane to copy from.
     * @returns {Plane} Self for chaining.
     */
    copy(src) {
        this.normal.copy(src.normal);
        this.distance = src.distance;
        return this;
    }

    /**
     * Returns a clone of the Plane.
     *
     * @returns {this} A duplicate Plane.
     */
    clone() {
        /** @type {this} */
        const cstr = this.constructor;
        return new cstr().copy(this);
    }
}

export { Plane };

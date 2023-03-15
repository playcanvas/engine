import { Vec3 } from '../math/vec3.js';

const tmpVecA = new Vec3();

/**
 * An infinite plane.
 *
 * @ignore
 */
class Plane {
    /**
     * The starting point of the plane.
     *
     * @readonly
     * @type {Vec3}
     */
    point = new Vec3();

    /**
     * The normal of the plane.
     *
     * @readonly
     * @type {Vec3}
     */
    normal = Vec3.BACK.clone();

    /**
     * Create a new Plane instance.
     *
     * @param {Vec3} [point] - Point position on the plane. The constructor copies this parameter.
     * @param {Vec3} [normal] - Normal of the plane. The constructor copies this parameter.
     */
    constructor(point, normal) {
        if (point) {
            this.point.copy(point);
        }
        if (normal) {
            this.normal.copy(normal);
        }
    }

    /**
     * Sets point and normal to the supplied vector values.
     *
     * @param {Vec3} point - The starting point of the plane.
     * @param {Vec3} normal - The normal of the plane.
     * @returns {Plane} Self for chaining.
     */
    set(point, normal) {
        this.point.copy(point);
        this.normal.copy(normal);
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
        const d = -this.normal.dot(this.point);
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
        const pointToOrigin = tmpVecA.sub2(this.point, ray.origin);
        const t = this.normal.dot(pointToOrigin) / this.normal.dot(ray.direction);
        const intersects = t >= 0;

        if (intersects && point)
            point.copy(ray.direction).mulScalar(t).add(ray.origin);

        return intersects;
    }

    /**
     * Copies the contents of a source Plane.
     *
     * @param {Plane} src - The Plane to copy from.
     * @returns {Plane} Self for chaining.
     */
    copy(src) {
        return this.set(src.point, src.normal);
    }

    /**
     * Returns a clone of the Plane.
     *
     * @returns {this} A duplicate Plane.
     */
    clone() {
        return new this.constructor(this.point, this.normal);
    }
}

export { Plane };

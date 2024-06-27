import { Vec3 } from '../math/vec3.js';

const e1 = new Vec3();
const e2 = new Vec3();
const h = new Vec3();
const s = new Vec3();
const q = new Vec3();

// constants
const EPSILON = 1e-6;

/**
 * A triangle.
 *
 * @category Math
 */
class Tri {
    /**
     * The first 3-dimensional vector of the triangle.
     *
     * @readonly
     * @type {Vec3}
     */
    v0 = new Vec3();

    /**
     * The second 3-dimensional vector of the triangle.
     *
     * @type {Vec3}
     * @readonly
     */
    v1 = new Vec3();

    /**
     * The third 3-dimensional vector of the triangle.
     *
     * @type {Vec3}
     * @readonly
     */
    v2 = new Vec3();

    /**
     * Creates a new Tri object.
     *
     * @param {Vec3} [v0] - The first 3-dimensional vector.
     * @param {Vec3} [v1] - The second 3-dimensional vector.
     * @param {Vec3} [v2] - The third 3-dimensional vector.
     * @example
     * const v0 = new pc.Vec3(1, 0, 0);
     * const v1 = new pc.Vec3(0, 1, 0);
     * const v2 = new pc.Vec3(2, 2, 1);
     * const t = new pc.Tri(v0, v1, v2);
     */
    constructor(v0 = Vec3.ZERO, v1 = Vec3.ZERO, v2 = Vec3.ZERO) {
        this.set(v0, v1, v2);
    }

    /**
     * Sets the specified triangle to the supplied 3-dimensional vectors.
     *
     * @param {Vec3} v0 - The value set on the first 3-dimensional vector of the triangle.
     * @param {Vec3} v1 - The value set on the second 3-dimensional vector of the triangle.
     * @param {Vec3} v2 - The value set on the third 3-dimensional vector of the triangle.
     * @returns {Tri} Self for chaining
     * @example
     * const t = new pc.Tri(pc.Vec3.UP, pc.Vec3.RIGHT, pc.Vec3.BACK);
     * const v0 = new pc.Vec3(1, 0, 0);
     * const v1 = new pc.Vec3(0, 1, 0);
     * const v2 = new pc.Vec3(2, 2, 1);
     * t.set(v0, v1, v2);
     *
     * // Outputs [[1, 0, 0], [0, 1, 0], [2, 2, 1]]
     * console.log("The result of the triangle set is: " + t.toString());
     */
    set(v0, v1, v2) {
        this.v0.copy(v0);
        this.v1.copy(v1);
        this.v2.copy(v2);

        return this;
    }

    /**
     * Test if a ray intersects with the triangle.
     *
     * @param {import('./ray.js').Ray} ray - Ray to test against (direction must be normalized).
     * @param {Vec3} [point] - If there is an intersection, the intersection point will be copied
     * into here.
     * @returns {boolean} True if there is an intersection.
     */
    intersectsRay(ray, point) {
        e1.sub2(this.v1, this.v0);
        e2.sub2(this.v2, this.v0);
        h.cross(ray.direction, e2);
        const a = e1.dot(h);
        if (a > -EPSILON && a < EPSILON) {
            return false;
        }

        const f = 1 / a;
        s.sub2(ray.origin, this.v0);
        const u = f * s.dot(h);
        if (u < 0 || u > 1) {
            return false;
        }

        q.cross(s, e1);
        const v = f * ray.direction.dot(q);
        if (v < 0 || u + v > 1) {
            return false;
        }

        const t = f * e2.dot(q);
        if (t > EPSILON) {
            if (point instanceof Vec3) {
                point.copy(ray.direction).mulScalar(t).add(ray.origin);
            }
            return true;
        }

        return false;
    }

    /**
     * Converts the specified triangle to string form.
     *
     * @returns {string} The triangle in string form.
     * @example
     * const t = new pc.Tri(pc.Vec3.UP, pc.Vec3.RIGHT, pc.Vec3.BACK);
     * // Outputs [[0, 1, 0], [1, 0, 0], [0, 0, 1]]
     * console.log(t.toString());
     */
    toString() {
        return '[' + this.v0.toString() + ', ' + this.v1.toString() + ', ' + this.v2.toString() + ']';
    }
}

export { Tri };

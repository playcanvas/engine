import { Vec3 } from '../math/vec3.js';

var tmpVecA = new Vec3();
var tmpVecB = new Vec3();

/**
 * @class
 * @name BoundingSphere
 * @classdesc A bounding sphere is a volume for facilitating fast intersection testing.
 * @description Creates a new bounding sphere.
 * @example
 * // Create a new bounding sphere centered on the origin with a radius of 0.5
 * var sphere = new pc.BoundingSphere();
 * @param {Vec3} [center] - The world space coordinate marking the center of the sphere. The constructor takes a reference of this parameter.
 * @param {number} [radius] - The radius of the bounding sphere. Defaults to 0.5.
 */
class BoundingSphere {
    constructor(center = new Vec3(), radius = 0.5) {
        this.center = center;
        this.radius = radius;
    }

    containsPoint(point) {
        var lenSq = tmpVecA.sub2(point, this.center).lengthSq();
        var r = this.radius;
        return lenSq < r * r;
    }

    /**
     * @function
     * @name BoundingSphere#intersectsRay
     * @description Test if a ray intersects with the sphere.
     * @param {Ray} ray - Ray to test against (direction must be normalized).
     * @param {Vec3} [point] - If there is an intersection, the intersection point will be copied into here.
     * @returns {boolean} True if there is an intersection.
     */
    intersectsRay(ray, point) {
        var m = tmpVecA.copy(ray.origin).sub(this.center);
        var b = m.dot(tmpVecB.copy(ray.direction).normalize());
        var c = m.dot(m) - this.radius * this.radius;

        // exit if ray's origin outside of sphere (c > 0) and ray pointing away from s (b > 0)
        if (c > 0 && b > 0)
            return null;

        var discr = b * b - c;
        // a negative discriminant corresponds to ray missing sphere
        if (discr < 0)
            return false;

        // ray intersects sphere, compute smallest t value of intersection
        var t = Math.abs(-b - Math.sqrt(discr));

        // if t is negative, ray started inside sphere so clamp t to zero
        if (point)
            point.copy(ray.direction).scale(t).add(ray.origin);

        return true;
    }

    /**
     * @function
     * @name BoundingSphere#intersectsBoundingSphere
     * @description Test if a Bounding Sphere is overlapping, enveloping, or inside this Bounding Sphere.
     * @param {BoundingSphere} sphere - Bounding Sphere to test.
     * @returns {boolean} True if the Bounding Sphere is overlapping, enveloping, or inside this Bounding Sphere and false otherwise.
     */
    intersectsBoundingSphere(sphere) {
        tmpVecA.sub2(sphere.center, this.center);
        var totalRadius = sphere.radius + this.radius;
        if (tmpVecA.lengthSq() <= totalRadius * totalRadius) {
            return true;
        }

        return false;
    }
}

export { BoundingSphere };

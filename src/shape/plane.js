import { Vec3 } from '../math/vec3.js';

var tmpVecA = new Vec3();

/**
 * @private
 * @class
 * @name pc.Plane
 * @classdesc An infinite plane.
 * @description Create an infinite plane.
 * @param {pc.Vec3} [point] - Point position on the plane. The constructor takes a reference of this parameter.
 * @param {pc.Vec3} [normal] - Normal of the plane. The constructor takes a reference of this parameter.
 */
class Plane {
    constructor(point, normal) {
        this.normal = normal || new Vec3(0, 0, 1);
        this.point = point || new Vec3(0, 0, 0);
    }

    /**
     * @private
     * @function
     * @name pc.Plane#intersectsLine
     * @description Test if the plane intersects between two points.
     * @param {pc.Vec3} start - Start position of line.
     * @param {pc.Vec3} end - End position of line.
     * @param {pc.Vec3} [point] - If there is an intersection, the intersection point will be copied into here.
     * @returns {boolean} True if there is an intersection.
     */
    intersectsLine(start, end, point) {
        var d = -this.normal.dot(this.point);
        var d0 = this.normal.dot(start) + d;
        var d1 = this.normal.dot(end) + d;

        var t = d0 / (d0 - d1);
        var intersects = t >= 0 && t <= 1;
        if (intersects && point)
            point.lerp(start, end, t);

        return intersects;
    }

    /**
     * @private
     * @function
     * @name pc.Plane#intersectsRay
     * @description Test if a ray intersects with the infinite plane.
     * @param {pc.Ray} ray - Ray to test against (direction must be normalized).
     * @param {pc.Vec3} [point] - If there is an intersection, the intersection point will be copied into here.
     * @returns {boolean} True if there is an intersection.
     */
    intersectsRay(ray, point) {
        var pointToOrigin = tmpVecA.sub2(this.point, ray.origin);
        var t = this.normal.dot(pointToOrigin) / this.normal.dot(ray.direction);
        var intersects = t >= 0;

        if (intersects && point)
            point.copy(ray.direction).scale(t).add(ray.origin);

        return intersects;
    }
}

export { Plane };

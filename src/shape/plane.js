pc.extend(pc, function () {
    var tmpVecA = new pc.Vec3();

    /**
     * @private
     * @name pc.Plane
     * @class An infinite plane.
     * @description Create an infinite plane.
     * @param {pc.Vec3} [point] Point position on the plane.
     * @param {pc.Vec3} [normal] Normal of the plane.
     */
    var Plane = function Plane (point, normal) {
        this.normal = normal ? normal.clone() : new pc.Vec3(0, 0, 1);
        this.point = point ? point.clone() : new pc.Vec3(0, 0, 0);
    };

    Plane.prototype = {
        _intersect: function (p0, p1) {
            var d = -this.normal.dot(this.point);
            var d0 = this.normal.dot(p0) + d;
            var d1 = this.normal.dot(p1) + d;

            return d0 / (d0 - d1);
        },

        /**
         * @function
         * @name pc.Plane#intersectsLine
         * @description Test if the plane intersects between two points.
         * @param {pc.Vec3} start Start position of line.
         * @param {pc.Vec3} end End position of line.
         * @param {pc.Vec3} [point] If there is an intersection, the intersection point will be copied into here.
         * @returns {Boolean} True if there is an intersection.
         */
        intersectsLine: function (start, end, point) {
            var t = this._intersect(start, end);
            var intersects = t >= 0 && t <= 1;
            if (intersects && point)
                point.lerp(start, end, t);

            return intersects;
        },

        /**
         * @function
         * @name pc.Plane#intersectsRay
         * @description Test if a ray intersects with the infinite plane
         * @param {pc.Ray} ray Ray to test against (direction must be normalized)
         * @param {pc.Vec3} [point] If there is an intersection, the intersection point will be copied into here
         * @returns {Boolean} True if there is an intersection
         */
        intersectsRay: function (ray, point) {
            var pointToOrigin = tmpVecA.sub2(this.point, ray.origin);
            var t = this.normal.dot(pointToOrigin) / this.normal.dot(ray.direction);
            var intersects = t >= 0;

            if (intersects && point)
                point.copy(ray.direction).scale(t).add(ray.origin);

            return intersects;
        },
    };

    return {
        Plane: Plane
    };
}());

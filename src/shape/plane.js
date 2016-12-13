pc.extend(pc, function () {
    var rayDepth = 100000;
    var tmpVecA = new pc.Vec3();

    /**
     * @private
     * @name pc.Plane
     * @class An infinite plane
     * @description Create an infinite plane
     */
    var Plane = function Plane (point, normal) {
        this.normal = normal || new pc.Vec3(0, 0, 1);
        this.point  = point || new pc.Vec3(0, 0, 0);
        this.d = -this.normal.dot(this.point);
    };

    Plane.prototype = {
        distance: function (pos) {
            return this.normal.dot(pos) + this.d;
        },

        intersect: function (p0, p1) {
            var d0 = this.distance(p0);
            var d1 = this.distance(p1);

            return d0 / (d0 - d1);
        },

        intersectPosition: function (p0, p1) {
            var t = this.intersect(p0, p1);
            var r = new pc.Vec3();
            r.lerp(p0, p1, t);
            return r;
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
            var p0 = ray.origin;
            var p1 = tmpVecA.copy(ray.direction).scale(rayDepth).add(p0);

            var t = this.intersect(p0, p1);

            var intersects = t >= 0;
            if (intersects && point)
                point.copy(ray.direction).scale(t * rayDepth).add(ray.origin);

            return intersects;
        },
    };

    return {
        Plane: Plane
    };
}());

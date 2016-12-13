pc.extend(pc, function () {
    var rayDepth = 100000;
    var tmpVecA = new pc.Vec3();

    /**
     * @private
     * @name pc.Plane
     * @class An infinite plane.
     * @description Create an infinite plane.
     * @param {pc.Vec3} point Point position on the plane.
     * @param {pc.Vec3} normal Normal of the plane.
     */
    var Plane = function Plane (point, normal) {
        this.normal = normal ? normal.clone() : new pc.Vec3(0, 0, 1);
        this.point = point ? point.clone() : new pc.Vec3(0, 0, 0);
        this.d = -this.normal.dot(this.point);
    };

    Plane.prototype = {
         /**
         * @function
         * @name pc.Plane#set
         * @description Sets the plane point and normal. Use this method when moving the plane.
         * @param {pc.Vec3} point Point position on the plane.
         * @param {pc.Vec3} normal Normal of the plane.
         */
        set: function (point, normal) {
            this.normal.copy(normal);
            this.point.copy(point);
            this.d = -this.normal.dot(this.point);
        },

        _intersect: function (p0, p1) {
            var d0 = this.normal.dot(p0) + this.d;
            var d1 = this.normal.dot(p1) + this.d;

            return d0 / (d0 - d1);
        },

        /**
         * @function
         * @name pc.Plane#intersectsPoint
         * @description Test if the plane intersects between two points.
         * @param {pc.Vec3} p0 First point position.
         * @param {pc.Vec3} p1 Second point position.
         * @param {pc.Vec3} [point] If there is an intersection, the intersection point will be copied into here.
         * @returns {Boolean} True if there is an intersection.
         */
        intersectsPoint: function (p0, p1, point) {
            var t = this._intersect(p0, p1);
            var intersects = t >= 0;
            if (intersects && point)
                point.lerp(p0, p1, t);

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

pc.extend(pc, function () {
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
        this._normal = normal ? normal.clone() : new pc.Vec3(0, 0, 1);
        this._point = point ? point.clone() : new pc.Vec3(0, 0, 0);
        this._d = -this._normal.dot(this._point);
    };

    Plane.prototype = {
        _intersect: function (p0, p1) {
            var d0 = this._normal.dot(p0) + this._d;
            var d1 = this._normal.dot(p1) + this._d;

            return d0 / (d0 - d1);
        },

        /**
         * @function
         * @name pc.Plane#intersectsLine
         * @description Test if the plane intersects between two points.
         * @param {pc.Vec3} p0 First point position.
         * @param {pc.Vec3} p1 Second point position.
         * @param {pc.Vec3} [point] If there is an intersection, the intersection point will be copied into here.
         * @returns {Boolean} True if there is an intersection.
         */
        intersectsLine: function (p0, p1, point) {
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
            var pointToOrigin = tmpVecA.sub2(this._point, ray.origin);
            var t = this._normal.dot(pointToOrigin) / this._normal.dot(ray.direction);
            var intersects = t >= 0;

            if (intersects && point)
                point.copy(ray.direction).scale(t).add(ray.origin);

            return intersects;
        },
    };

    /**
     * @name pc.Plane#normal
     * @type pc.Vec3
     * @description The normal of the plane.
     */
    Object.defineProperty(Plane.prototype, 'normal', {
        get: function () {
            return this._normal;
        },
        set: function (value) {
            this._normal.copy(value);
            this._d = -this._normal.dot(this._point);
        }
    });

    /**
     * @name pc.Plane#point
     * @type pc.Vec3
     * @description A point on the plane.
     */
    Object.defineProperty(Plane.prototype, 'point', {
        get: function () {
            return this._point;
        },
        set: function (value) {
            this._point.copy(value);
            this._d = -this._normal.dot(this._point);
        }
    });

    return {
        Plane: Plane
    };
}());

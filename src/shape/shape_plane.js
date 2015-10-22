pc.extend(pc, function () {
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
        }
    };

    return {
        Plane: Plane
    };
}());

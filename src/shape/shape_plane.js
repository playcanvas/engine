pc.extend(pc.shape, function () {
    // Add to the enumeration of types
    pc.shape.Type.PLANE = "Plane";

    /**
     * Plane
     * @constructor
     */
    var Plane = function Plane (point, normal) {
        this.normal = normal || new pc.Vec3(0, 0, 1);
        this.point  = point  || new pc.Vec3(0, 0, 0);
        this.d      = -this.normal.dot(this.point);
        this.type = pc.shape.Type.PLANE;
    };
    Plane = pc.inherits(Plane, pc.shape.Shape);
    
    /**
     * Tests whether a point is inside the plane.
     * @param {pc.Vec3} point Point to test
     * @returns {Boolean} true if the point is inside the frustum, false otherwise
     */
    Plane.prototype.containsPoint = function (point) {
        return false;
    };

    Plane.prototype.distance = function (pos) {
        return this.normal.dot(pos) + this.d;
    };

    Plane.prototype.intersect = function (p0, p1) {
        var d0 = this.distance(p0);
        var d1 = this.distance(p1);

        return d0 / (d0 - d1);
    };

    Plane.prototype.intersectPosition = function (p0, p1) {
        var t = this.intersect(p0, p1);
        var r = new pc.Vec3();
        r.lerp(p0, p1, t);
        return r;
    };

    return {
        Plane: Plane
    };
}());
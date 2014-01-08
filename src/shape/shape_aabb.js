pc.extend(pc.shape, function () {
    // Add to enumeration of shape types
    pc.shape.Type.AABB = "Aabb";
    
    /**
     * @name pc.shape.Aabb
     * @constructor Create a new Axis-Aligned Bounding Box
     * @class Axis-Aligned Bounding Box
     * @param {pc.Vec3} center - center of box
     * @param {pc.Vec3} halfExtents - half the distance across the box in each axis
     */
    var Aabb = function Aabb(center, halfExtents) {
        this.center = center || new pc.Vec3(0, 0, 0);
        this.halfExtents = halfExtents || new pc.Vec3(0.5, 0.5, 0.5);
        this.type = pc.shape.Type.AABB;
    };
    Aabb = pc.inherits(Aabb, pc.shape.Shape);

    Aabb.prototype.add = function (other) {
        var tc = this.center;
        var th = this.halfExtents;
        var tminx = tc.x - th.x;
        var tmaxx = tc.x + th.x;
        var tminy = tc.y - th.y;
        var tmaxy = tc.y + th.y;
        var tminz = tc.z - th.z;
        var tmaxz = tc.z + th.z;
        var oc = other.center;
        var oh = other.halfExtents;
        var ominx = oc.x - oh.x;
        var omaxx = oc.x + oh.x;
        var ominy = oc.y - oh.y;
        var omaxy = oc.y + oh.y;
        var ominz = oc.z - oh.z;
        var omaxz = oc.z + oh.z;
        if (ominx < tminx) tminx = ominx;
        if (omaxx > tmaxx) tmaxx = omaxx;
        if (ominy < tminy) tminy = ominy;
        if (omaxy > tmaxy) tmaxy = omaxy;
        if (ominz < tminz) tminz = ominz;
        if (omaxz > tmaxz) tmaxz = omaxz;
        tc.set(tminx + tmaxx, tminy + tmaxy, tminz + tmaxz).scale(0.5);
        th.set(tmaxx - tminx, tmaxy - tminy, tmaxz - tminz).scale(0.5);
    };

    Aabb.prototype.copy = function (src) {
        this.center.copy(src.center);
        this.halfExtents.copy(src.halfExtents);
        this.type = src.type;
    };

    Aabb.prototype.setMinMax = function (min, max) {
        this.center.add2(max, min).scale(0.5);
        this.halfExtents.sub2(max, min).scale(0.5);
    };
    
    /**
     * @function
     * @name pc.shape.Aabb#getMin
     * @description Return the minimum corner of the AABB.
     * @returns {pc.Vec3} minimum corner
     */
    Aabb.prototype.getMin = function () {
        return this.center.clone().sub(this.halfExtents);
    };
    
    /**
     * @function
     * @name pc.shape.Aabb#getMax
     * @description Return the maximum corner of the AABB.
     * @returns {pc.Vec3} maximum corner
     */
    Aabb.prototype.getMax = function () {
        return this.center.clone().add(this.halfExtents);
    };
    
    /**
     * @function
     * @name pc.shape.Aabb#containsPoint
     * @description Test if a point is inside a AABB
     * @param {pc.Vec3} point Point to test
     * @returns {Boolean} true if the point is inside the AABB and false otherwise
     */
    Aabb.prototype.containsPoint = function (point) {
        var min = this.getMin(), max = this.getMax(), i;
        
        for (i = 0; i < 3; ++i) {
            if (point.data[i] < min.data[i] || point.data[i] > max.data[i]) {
                return false;
            }
        }
        
        return true;
    };

    /**
     * @function
     * @name pc.shape.Aabb#setFromTransformedAabb
     * @description Set an AABB to enclose the specified AABB if it were to be
     * transformed by the specified 4x4 matrix.
     * @param {pc.shape.Aabb} aabb Box to transform and enclose
     * @param {pc.Mat4} m Transformation matrix to apply to source AABB.
     */
    Aabb.prototype.setFromTransformedAabb = function (aabb, m) {
        var bc = this.center;
        var br = this.halfExtents;
        var ac = aabb.center.data;
        var ar = aabb.halfExtents.data;

        m = m.data;
        var mx0 = m[0];
        var mx1 = m[4];
        var mx2 = m[8];
        var my0 = m[1];
        var my1 = m[5];
        var my2 = m[9];
        var mz0 = m[2];
        var mz1 = m[6];
        var mz2 = m[10];

        var mx0a = Math.abs(mx0);
        var mx1a = Math.abs(mx1);
        var mx2a = Math.abs(mx2);
        var my0a = Math.abs(my0);
        var my1a = Math.abs(my1);
        var my2a = Math.abs(my2);
        var mz0a = Math.abs(mz0);
        var mz1a = Math.abs(mz1);
        var mz2a = Math.abs(mz2);

        bc.set(
            m[12] + mx0 * ac[0] + mx1 * ac[1] + mx2 * ac[2],
            m[13] + my0 * ac[0] + my1 * ac[1] + my2 * ac[2],
            m[14] + mz0 * ac[0] + mz1 * ac[1] + mz2 * ac[2]
        );

        br.set(
            mx0a * ar[0] + mx1a * ar[1] + mx2a * ar[2],
            my0a * ar[0] + my1a * ar[1] + my2a * ar[2],
            mz0a * ar[0] + mz1a * ar[1] + mz2a * ar[2]
        );
    };

    Aabb.prototype.compute = function (vertices) {
        var min = new pc.Vec3(vertices[0], vertices[1], vertices[2]);
        var max = new pc.Vec3(vertices[0], vertices[1], vertices[2]);
        var numVerts = vertices.length / 3;

        for (var i = 1; i < numVerts; i++) {
            var x = vertices[i * 3 + 0];
            var y = vertices[i * 3 + 1];
            var z = vertices[i * 3 + 2];
            if (x < min.x) min.x = x;
            if (y < min.y) min.y = y;
            if (z < min.z) min.z = z;
            if (x > max.x) max.x = x;
            if (y > max.y) max.y = y;
            if (z > max.z) max.z = z;
        }

        this.setMinMax(min, max);
    };

    return {
        Aabb: Aabb
    };
}());

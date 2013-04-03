pc.extend(pc.shape, function () {
    // Add to enumeration of shape types
    pc.shape.Type.AABB = "Aabb";
    
    /**
     * @name pc.shape.Aabb
     * @constructor Create a new Axis-Aligned Bounding Box
     * @class Axis-Aligned Bounding Box
     * @param {pc.math.vec3} center - center of box
     * @param {pc.math.vec3} halfExtents - half the distance across the box in each axis
     */
    var Aabb = function Aabb(center, halfExtents) {
        this.center = center || pc.math.vec3.create(0, 0, 0);
        this.halfExtents = halfExtents || pc.math.vec3.create(0.5, 0.5, 0.5);
        this.type = pc.shape.Type.AABB;
    };
    Aabb = pc.inherits(Aabb, pc.shape.Shape);

    Aabb.prototype.add = function (other) {
        var tc = this.center;
        var th = this.halfExtents;
        var tminx = tc[0] - th[0];
        var tmaxx = tc[0] + th[0];
        var tminy = tc[1] - th[1];
        var tmaxy = tc[1] + th[1];
        var tminz = tc[2] - th[2];
        var tmaxz = tc[2] + th[2];
        var oc = other.center;
        var oh = other.halfExtents;
        var ominx = oc[0] - oh[0];
        var omaxx = oc[0] + oh[0];
        var ominy = oc[1] - oh[1];
        var omaxy = oc[1] + oh[1];
        var ominz = oc[2] - oh[2];
        var omaxz = oc[2] + oh[2];
        if (ominx < tminx) tminx = ominx;
        if (omaxx > tmaxx) tmaxx = omaxx;
        if (ominy < tminy) tminy = ominy;
        if (omaxy > tmaxy) tmaxy = omaxy;
        if (ominz < tminz) tminz = ominz;
        if (omaxz > tmaxz) tmaxz = omaxz;
        tc[0] = (tminx + tmaxx) * 0.5;
        tc[1] = (tminy + tmaxy) * 0.5;
        tc[2] = (tminz + tmaxz) * 0.5;
        th[0] = (tmaxx - tminx) * 0.5;
        th[1] = (tmaxy - tminy) * 0.5;
        th[2] = (tmaxz - tminz) * 0.5;
    };

    Aabb.prototype.copy = function (src) {
        pc.math.vec3.copy(src.center, this.center);
        pc.math.vec3.copy(src.halfExtents, this.halfExtents);
        this.type = src.type;
    };

    Aabb.prototype.setMinMax = function (min, max) {
        this.center[0] = (min[0] + max[0]) * 0.5;
        this.center[1] = (min[1] + max[1]) * 0.5;
        this.center[2] = (min[2] + max[2]) * 0.5;

        this.halfExtents[0] = (max[0] - min[0]) * 0.5;
        this.halfExtents[1] = (max[1] - min[1]) * 0.5;
        this.halfExtents[2] = (max[2] - min[2]) * 0.5;
    };
    
    /**
     * @function
     * @name pc.shape.Aabb#getMin
     * @description Return the minimum corner of the AABB.
     * @return {pc.math.vec3} minimum corner
     */
    Aabb.prototype.getMin = function () {
        var min = pc.math.vec3.create(0.0, 0.0, 0.0);
        pc.math.vec3.subtract(this.center, this.halfExtents, min);
        return min;
    };
    
    /**
     * @function
     * @name pc.shape.Aabb#getMax
     * @description Return the maximum corner of the AABB.
     * @return {pc.shape.vec3} maximum corner
     */
    Aabb.prototype.getMax = function () {
        var max = pc.math.vec3.create(0.0, 0.0, 0.0);
        pc.math.vec3.add(this.center, this.halfExtents, max);
        return max;
    };
    
    /**
     * @function
     * @name pc.shape.Aabb#containsPoint
     * @description Test if a point is inside a AABB
     * @param {Vec3} point - point to test
     * @param {Aabb} aabb - box to test point against
     */
    Aabb.prototype.containsPoint = function (point) {
        var min = this.getMin(), max = this.getMax(), i;
        
        for (i = 0; i < 3; ++i) {
            if (point[i] < min[i] || point[i] > max[i]) {
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
     * @param {pc.math.mat4} m Transformation matrix to apply to source AABB.
     */
    Aabb.prototype.setFromTransformedAabb = function (aabb, m) {
        var bc = this.center;
        var br = this.halfExtents;
        var ac = aabb.center;
        var ar = aabb.halfExtents;

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

        bc[0] = m[12] + mx0 * ac[0] + mx1 * ac[1] + mx2 * ac[2];
        bc[1] = m[13] + my0 * ac[0] + my1 * ac[1] + my2 * ac[2];
        bc[2] = m[14] + mz0 * ac[0] + mz1 * ac[1] + mz2 * ac[2];

        br[0] = mx0a * ar[0] + mx1a * ar[1] + mx2a * ar[2];
        br[1] = my0a * ar[0] + my1a * ar[1] + my2a * ar[2];
        br[2] = mz0a * ar[0] + mz1a * ar[1] + mz2a * ar[2];
    };

    Aabb.prototype.compute = function (vertices) {
        var min = pc.math.vec3.create(vertices[0], vertices[1], vertices[2]);
        var max = pc.math.vec3.create(vertices[0], vertices[1], vertices[2]);

        var numVerts = vertices.length / 3;
        for (var i = 1; i < numVerts; i++) {
            if (vertices[i*3+0] < min[0]) min[0] = vertices[i*3+0];
            if (vertices[i*3+1] < min[1]) min[1] = vertices[i*3+1];
            if (vertices[i*3+2] < min[2]) min[2] = vertices[i*3+2];
            if (vertices[i*3+0] > max[0]) max[0] = vertices[i*3+0];
            if (vertices[i*3+1] > max[1]) max[1] = vertices[i*3+1];
            if (vertices[i*3+2] > max[2]) max[2] = vertices[i*3+2];
        }

        this.setMinMax(min, max);
    };

    return {
        Aabb: Aabb
    };
    
}());

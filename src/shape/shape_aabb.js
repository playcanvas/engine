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
    }
    Aabb = Aabb.extendsFrom(pc.shape.Shape);

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
    }
    
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
    }
    
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
        var mx1 = m[1];
        var mx2 = m[2];
        var my0 = m[4];
        var my1 = m[5];
        var my2 = m[6];
        var mz0 = m[8];
        var mz1 = m[9];
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
    
    return {
        Aabb: Aabb
    };
    
}());

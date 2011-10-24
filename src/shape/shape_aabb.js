pc.extend(pc.shape, function () {
    /**
     * @name pc.shape.Aabb
     * @constructor Create a new Axis-Aligned Bounding Box
     * @class Axis-Aligned Bounding Box
     * @param {pc.math.vec3} center - center of box
     * @param {pc.math.vec3} halfExtents - half the distance across the box in each axis
     */
    var Aabb = function Aabb (center, halfExtents) {
        this.center = center || pc.math.vec3.create(0, 0, 0);
        this.halfExtents = halfExtents || pc.math.vec3.create(0.5, 0.5, 0.5);
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
    Aabb.prototype.getMax = function() {
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
    Aabb.prototype.containsPoint = function(point){
        var min = this.getMin(), max = this.getMax(), i;
        
        for (i = 0; i < 3; ++i) {
            if (point[i] < min[i] || point[i] > max[i]) {
                return false;
            }
        }
        
        return true;
    };
    
    return {
        Aabb: Aabb
    };
    
}());

pc.extend(pc.shape, function () {
    // Add to the enumeration of types
    pc.shape.Type.BOX = "Box";

    /**
     * Orientated Box
     * @constructor
     * @param {Mat4} transform The transform that describes the translation and rotate of the box.
     * @param {Vec3} halfExtents The size of the box where 2 * halfExtents[0] is the size in the local x axis, etc.
     */
    var Box = function Box (transform, halfExtents) {
        if(!transform) {
            transform = pc.math.mat4.create();
        }
        if(!halfExtents) {
            halfExtents = pc.math.vec3.create(0.5, 0.5, 0.5);
        }
        
        this.transform = transform;
        this.halfExtents = halfExtents;
        this.type = pc.shape.Type.BOX;
    };
    Box = Box.extendsFrom(pc.shape.Shape);
    
    /**
     * Return true if point is inside the box
     * @param {Object} point Point to test
     */
    Box.prototype.containsPoint = function (point) {
        var center = pc.math.mat4.getTranslation(this.transform),
        extents = this.getHalfExtents(),
        min = pc.math.vec3.create(center[0] - extents[0], center[1] - extents[1], center[2] - extents[2]),
        max = pc.math.vec3.create(center[0] + extents[0], center[1] + extents[1], center[2] + extents[2]);
        
        //transform point in to local space
        point = pc.math.vec3.subtract(point, center, point);
        pc.math.mat4.multiplyVec3(point, 1, this.transform, point);
        
        for (i = 0; i < 3; ++i) {
            if (point[i] < min[i] || point[i] > max[i]) {
                return false;
            }
        }

        return true;
    };
    
    /**
     * Get the half extents as Vec3 [x,y,z]
     */
    Box.prototype.getHalfExtents = function () {
        return this.halfExtents;
    }
    
    return {
        Box: Box
    }
}());
  
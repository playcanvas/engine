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
    Box = pc.inherits(Box, pc.shape.Shape);
    
    /**
     * Return true if point is inside the box
     * @param {Object} point Point to test
     */
    Box.prototype.containsPoint = function (point) {
        var p = pc.math.vec3.clone(point);
        var center = pc.math.mat4.getTranslation(this.transform),
        extents = this.getHalfExtents(),
        min = [-0.5,-0.5,-0.5];
        max = [0.5,0.5,0.5];
        
        // Add scale as it is missing from box.transform
        var t = pc.math.mat4.clone(this.transform);
        var scale = pc.math.mat4.makeScale(extents[0]*2, extents[1]*2,extents[2]*2);
        pc.math.mat4.multiply(t, scale, t);
        
        // transform point into local space
        var inv = pc.math.mat4.invert(t);
        pc.math.mat4.multiplyVec3(point, 1, inv, p);
        
        for (i = 0; i < 3; ++i) {
            if (p[i] < min[i] || p[i] > max[i]) {
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
    };
    
    return {
        Box: Box
    };
}());
  
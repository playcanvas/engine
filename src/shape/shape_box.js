pc.extend(pc.shape, function () {
    // Add to the enumeration of types
    pc.shape.Type.BOX = "Box";
    var center = new pc.Vec3();
    var p = new pc.Vec3();
    var t = new pc.Mat4();
    var scale = new pc.Mat4();

    /**
     * Orientated Box
     * @constructor
     * @param {pc.Mat4} transform The transform that describes the translation and rotate of the box.
     * @param {pc.Vec3} halfExtents The size of the box where 2 * halfExtents[0] is the size in the local x axis, etc.
     */
    function Box(transform, halfExtents) {
        this.transform = (transform === undefined) ? new pc.Mat4() : transform;
        this.halfExtents = (halfExtents === undefined) ? new pc.Vec3(0.5, 0.5, 0.5) : halfExtents;

        this.type = pc.shape.Type.BOX;
    };
    Box = pc.inherits(Box, pc.shape.Shape);

    /**
     * Return true if point is inside the box
     * @param {pc.Vec3} point Point to test
     */
    Box.prototype.containsPoint = function (point) {
        this.transform.getTranslation(center);
        var extents = this.getHalfExtents();

        // Add scale as it is missing from box.transform
        t.copy(this.transform);

        p.copy(extents).scale(2);
        scale.setTRS(pc.Vec3.ZERO, pc.Quat.IDENTITY, p);
        t.mul(scale).invert();

        // transform point into local space
        t.transformPoint(point, p);

        var min = -0.5;
        var max = 0.5;
        
        if (p.x < min || p.x > max) {
            return false;
        }
        else if (p.y < min || p.y > max) {
            return false;
        } 
        else if (p.z < min || p.z > max) { 
            return false;
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
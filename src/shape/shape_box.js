pc.extend(pc.shape, function () {
    // Add to the enumeration of types
    pc.shape.Type.BOX = "Box";

    /**
     * Orientated Box
     * @constructor
     * @param {pc.Mat4} transform The transform that describes the translation and rotate of the box.
     * @param {pc.Vec3} halfExtents The size of the box where 2 * halfExtents[0] is the size in the local x axis, etc.
     */
    function Box(transform, halfExtents) {
        this.transform = (typeof transform === 'undefined') ? new pc.Mat4() : transform;
        this.halfExtents = (typeof halfExtents === 'undefined') ? new pc.Vec3(0.5, 0.5, 0.5) : halfExtents;

        this.type = pc.shape.Type.BOX;
    };
    Box = pc.inherits(Box, pc.shape.Shape);

    /**
     * Return true if point is inside the box
     * @param {pc.Vec3} point Point to test
     */
    Box.prototype.containsPoint = function (point) {
        var center = new pc.Vec3();
        this.transform.getTranslation(center);
        var extents = this.getHalfExtents();
        var min = new pc.Vec3(-0.5,-0.5,-0.5);
        var max = new pc.Vec3(0.5,0.5,0.5);

        // Add scale as it is missing from box.transform
        var t = this.transform.clone();
        var scale = new pc.Mat4().setScale(extents.x * 2, extents.y * 2, extents.z * 2);
        t.mul(scale).invert();

        // transform point into local space
        var p = new pc.Vec3();
        t.transformPoint(point, p);

        if (p.x < min.x || p.x > max.x) return false;
        if (p.y < min.y || p.y > max.y) return false;
        if (p.z < min.z || p.z > max.z) return false;

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
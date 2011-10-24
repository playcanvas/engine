pc.extend(pc.shape, function () {
    
    /**
     * A torus shape
     * With the identity matrix the Torus lies in the XZ plane
     * @param {Object} transform Orientation
     * @param {Object} iradius Inner radius
     * @param {Object} oradius Outer radius
     */
    var Torus = function Torus(transform, iradius, oradius) {
        this.transform = transform;
        this.iradius = iradius;
        this.oradius = oradius;
    };
    Torus = Torus.extendsFrom(pc.shape.Shape);
    // Add to the enumeration of types
    pc.shape.Type.TORUS = "Torus";
    
    Torus.prototype.containsPoint = function (point) {
        throw new Error("Not implemented yet");    
    };
    
    return {
        Torus: Torus
    }
}());

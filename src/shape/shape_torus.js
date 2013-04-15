pc.extend(pc.shape, function () {
    // Add to the enumeration of types
    pc.shape.Type.TORUS = "Torus";    

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
        
        this.type = pc.shape.Type.TORUS;
    };
    Torus = pc.inherits(Torus, pc.shape.Shape);
    
    Torus.prototype.containsPoint = function (point) {
        throw new Error("Not implemented yet");    
    };
    
    return {
        Torus: Torus
    };
}());

pc.extend(pc.fw, function() {
    
    SimpleBodyComponentData = function () {
        this.mass = 1;
        this.inertia = 1;
        
        this.velocity = pc.math.vec3.create(0, 0, 0);
        this.force    = pc.math.vec3.create(0, 0, 0);
        
        this.angles      = pc.math.vec3.create(0, 0, 0);
        this.angVelocity = pc.math.vec3.create(0, 0, 0);
        this.torque      = pc.math.vec3.create(0, 0, 0);
    }
    SimpleBodyComponentData = pc.inherits(SimpleBodyComponentData, pc.fw.ComponentData);
    
    return {
        SimpleBodyComponentData: SimpleBodyComponentData
    }
}());

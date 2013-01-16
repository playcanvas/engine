pc.extend(pc.fw, function () {
    /**
     * @component
     * @name pc.fw.CollisionSphereComponent
     * @constructor Create a new CollisionSphereComponent
     * @class A sphere-shaped collision volume. Use in conjunction with {@link pc.fw.RigidBodyComponent} to create a sphere that can be simulated using the physics engine.
     * @param {pc.fw.CollisionSphereComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity that this Component is attached to.     
     * @extends pc.fw.Component
     * @property {Number} radius The radius of the sphere
     */
    var CollisionSphereComponent = function CollisionSphereComponent (system, entity) {
        this.on('set_radius', this.onSetRadius, this);
    };
    CollisionSphereComponent = pc.inherits(CollisionSphereComponent, pc.fw.Component);
    
    pc.extend(CollisionSphereComponent.prototype, {

        onSetRadius: function (name, oldValue, newValue) {
            if (this.entity.rigidbody) {
                if (typeof(Ammo) !== 'undefined') {
                    this.data.shape = new Ammo.btSphereShape(newValue);    
                }
                
                this.entity.rigidbody.createBody();
            }
        }
    });

    return {
        CollisionSphereComponent: CollisionSphereComponent
    };
}());
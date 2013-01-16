pc.extend(pc.fw, function () {
    /**
     * @component
     * @name pc.fw.CollisionBoxComponent
     * @constructor Create a new CollisionBoxComponent
     * @class A box-shaped collision volume. use this in conjunction with a RigidBodyComponent to make a Box that can be simulated using the physics engine.
     * @param {pc.fw.CollisionBoxComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity that this Component is attached to.     
     * @property {pc.math.vec3} halfExtents The half-extents of the box in the x, y and z axes.
     * @extends pc.fw.Component
     */
    var CollisionBoxComponent = function CollisionBoxComponent (system, entity) {
        this.on('set_halfExtents', this.onSetHalfExtents, this);
    };
    CollisionBoxComponent = pc.inherits(CollisionBoxComponent, pc.fw.Component);
    
    pc.extend(CollisionBoxComponent.prototype, {

        onSetHalfExtents: function (name, oldValue, newValue) {
            if (this.entity.rigidbody) {
                this.data.shape = this.createShape(this.data.halfExtents[0], this.data.halfExtents[1], this.data.halfExtents[2]);
                this.entity.rigidbody.createBody();
            }
        },

        createShape: function (x, y, z) {
            if (typeof(Ammo) !== 'undefined') {
                return new Ammo.btBoxShape(new Ammo.btVector3(x, y, z));    
            } else {
                return undefined;
            }
        }
    });

    return {
        CollisionBoxComponent: CollisionBoxComponent
    };
}());
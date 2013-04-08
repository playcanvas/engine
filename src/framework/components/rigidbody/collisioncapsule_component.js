pc.extend(pc.fw, function () {
    /**
     * @component
     * @name pc.fw.CollisionCapsuleComponent
     * @constructor Create a new CollisionCapsuleComponent
     * @class A capsule-shaped collision volume. Use in conjunction with {@link pc.fw.RigidBodyComponent} to create a capsule that can be simulated using the physics engine.
     * @param {pc.fw.CollisionCapsuleComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity that this Component is attached to.     
     * @extends pc.fw.Component
     * @property {Number} height The total height of the capsule from tip to tip.
     * @property {Number} radius The radius of the capsule.
     */
    var CollisionCapsuleComponent = function CollisionCapsuleComponent(system, entity) {
        this.on('set_height', this.onSetHeight, this);
        this.on('set_radius', this.onSetRadius, this);
    };
    CollisionCapsuleComponent = pc.inherits(CollisionCapsuleComponent, pc.fw.Component);
    
    pc.extend(CollisionCapsuleComponent.prototype, {

        onSetHeight: function (name, oldValue, newValue) {
            if (this.entity.rigidbody) {
                if (typeof(Ammo) !== 'undefined') {
                    var radius = this.data.radius;
                    var height = Math.max(newValue - 2 * radius, 0);
                    this.data.shape = new Ammo.btCapsuleShape(radius, height);
                }

                this.entity.rigidbody.createBody();
            }
        },

        onSetRadius: function (name, oldValue, newValue) {
            if (this.entity.rigidbody) {
                if (typeof(Ammo) !== 'undefined') {
                    var radius = newValue;
                    var height = Math.max(this.data.height - 2 * radius, 0);
                    this.data.shape = new Ammo.btCapsuleShape(radius, height);
                }

                this.entity.rigidbody.createBody();
            }
        }
    });

    return {
        CollisionCapsuleComponent: CollisionCapsuleComponent
    };
}());
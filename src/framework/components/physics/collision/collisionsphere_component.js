pc.extend(pc.fw, function () {
    /**
     * @component
     * @name pc.fw.CollisionSphereComponent
     * @constructor Create a new CollisionSphereComponent
     * @class A sphere-shaped collision volume. Use in conjunction with {@link pc.fw.RigidBodyComponent} to create a sphere that can be simulated using the physics engine.
     * <p>This volume will act as a trigger if there is no RigidBodyComponent attached. A trigger is a volume that raises events when other rigid bodies enter it.</p>
     * @param {pc.fw.CollisionSphereComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity that this Component is attached to.     
     * @extends pc.fw.Component
     * @property {Number} radius The radius of the sphere
     */


     // Events Documentation   
    /**
     * @event
     * @name pc.fw.CollisionSphereComponent#contact
     * @description Fired when a contact occurs between this collider and a rigid body
     * @param {pc.fw.ColliderContactResult} result Details of the contact between the two bodies
    */

    /**
     * @event
     * @name pc.fw.CollisionSphereComponent#triggerenter
     * @description Fired when a rigid body enters this collider
     * @param {pc.fw.Entity} other The entity that entered this collider
    */

    /**
     * @event
     * @name pc.fw.CollisionSphereComponent#triggerleave
     * @description Fired when a rigid body has stopped touching this collider
     * @param {pc.fw.Entity} other The entity that stopped touching this collider
    */
    
    var CollisionSphereComponent = function CollisionSphereComponent (system, entity) {
        entity.collider = this;
        this.on('set_radius', this.onSetRadius, this);
        if( !entity.rigidbody )
            entity.on('livelink:updatetransform', this.onLiveLinkUpdateTransform, this);
    };
    CollisionSphereComponent = pc.inherits(CollisionSphereComponent, pc.fw.Component);
    
    pc.extend(CollisionSphereComponent.prototype, {

        onSetRadius: function (name, oldValue, newValue) {
            if (typeof(Ammo) !== 'undefined') {
                this.data.shape = new Ammo.btSphereShape(newValue);    
            }

            if (this.entity.rigidbody) {                            
                this.entity.rigidbody.createBody();
            } else if (this.entity.trigger) {
                this.entity.trigger.initialize( this.data );
            }
        },

        /**
         * Handle an update over livelink from the tools updating the Entities transform
         */
        onLiveLinkUpdateTransform: function (position, rotation, scale) {
            if (this.entity.trigger) {
                this.entity.trigger.syncEntityToBody();
            } else {
                 this.entity.off('livelink:updatetransform', this.onLiveLinkUpdateTransform, this);
            }
        }
    });

    return {
        CollisionSphereComponent: CollisionSphereComponent
    };
}());
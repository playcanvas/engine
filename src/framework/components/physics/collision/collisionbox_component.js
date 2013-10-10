pc.extend(pc.fw, function () {
    /**
     * @component
     * @name pc.fw.CollisionBoxComponent
     * @constructor Create a new CollisionBoxComponent
     * @class A box-shaped collision volume. use this in conjunction with a RigidBodyComponent to make a Box that can be simulated using the physics engine.
     * <p>This volume will act as a trigger if there is no RigidBodyComponent attached. A trigger is a volume that raises events when other rigid bodies enter it.</p>
     * @param {pc.fw.CollisionBoxComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity that this Component is attached to.     
     * @property {pc.math.vec3} halfExtents The half-extents of the box in the x, y and z axes. 
     * @extends pc.fw.Component
     */

    // Events Documentation   
    /**
     * @event
     * @name pc.fw.CollisionBoxComponent#contact
     * @description Fired when a contact occurs between this collider and another one
     * @param {pc.fw.ColliderContactResult} result Details of the contact between the two bodies
    */

    /**
     * @event
     * @name pc.fw.CollisionBoxComponent#collisionstart
     * @description Fired when another collider enters this collider
     * @param {pc.fw.ColliderContactResult} result Details of the contact between the two bodies
    */

    /**
     * @event
     * @name pc.fw.CollisionBoxComponent#collisionend
     * @description Fired when a collider has stopped touching this collider
     * @param {pc.fw.Entity} other The entity that stopped touching this collider
    */

    var CollisionBoxComponent = function CollisionBoxComponent (system, entity) {
        entity.collider = this;
        this.on('set_halfExtents', this.onSetHalfExtents, this);
        if( !entity.rigidbody )
            entity.on('livelink:updatetransform', this.onLiveLinkUpdateTransform, this);
    };
    CollisionBoxComponent = pc.inherits(CollisionBoxComponent, pc.fw.Component);
    
    pc.extend(CollisionBoxComponent.prototype, {

        onSetHalfExtents: function (name, oldValue, newValue) {
            if (this.entity.rigidbody) {
                this.data.shape = this.createShape(this.data.halfExtents[0], this.data.halfExtents[1], this.data.halfExtents[2]);
                this.entity.rigidbody.createBody();
            } else if (this.entity.trigger) {
                this.data.shape = this.createShape(this.data.halfExtents[0], this.data.halfExtents[1], this.data.halfExtents[2]);
                this.entity.trigger.initialize( this.data );
            }
        },

        createShape: function (x, y, z) {
            if (typeof(Ammo) !== 'undefined') {
                return new Ammo.btBoxShape(new Ammo.btVector3(x, y, z));    
            } else {
                return undefined;
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
        CollisionBoxComponent: CollisionBoxComponent
    };
}());
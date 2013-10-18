pc.extend(pc.fw, function () {
    /**
     * @component
     * @name pc.fw.CollisionComponent
     * @constructor Create a new CollisionComponent
     * @class A collision volume. use this in conjunction with a {@link pc.fw.RigidBodyComponent} to make a collision volume that can be simulated using the physics engine.
     * <p>If the {@link pc.fw.Entity} does not have a {@link pc.fw.RigidBodyComponent} then this collision volume will act as a trigger volume. Trigger volumes fire collision events on
     * other non-static entities that have a {@link pc.fw.RigidBodyComponent} attached.</p>
     * @param {pc.fw.CollisionComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity that this Component is attached to.     
     * @property {String} type The type of the collision volume. Defaults to 'box'. Can be one of the following:
     * <ul>
     * <li><strong>box</strong>: A box-shaped collision volume.</li>
     * <li><strong>sphere</strong>: A sphere-shaped collision volume.</li>
     * <li><strong>capsulse</strong>: A capsule-shaped collision volume.</li>
     * <li><strong>mesh</strong>: A collision volume that uses a model asset as its shape.</li>
     * </ul>
     * @property {pc.math.vec3} halfExtents The half-extents of the box-shaped collision volume in the x, y and z axes. Defaults to [0.5, 0.5, 0.5]
     * @property {pc.math.vec3} radius The radius of the sphere or capsule-shaped collision volumes. Defaults to 0.5
     * @property {Number} axis The local space axis with which the capsule-shaped collision volume's length is aligned. 0 for X, 1 for Y and 2 for Z. Defaults to 1 (Y-axis).
     * @property {Number} height The total height of the capsule-shaped collision volume from tip to tip. Defaults to 2.
     * @property {String} asset The GUID of the asset for the model of the mesh collision volume.
     * @property {pc.scene.Model} model The model that is added to the scene graph for the mesh collision volume.
     * @extends pc.fw.Component
     */

    // Events Documentation   
    /**
     * @event
     * @name pc.fw.CollisionComponent#contact
     * @description The {@link pc.fw.EVENT_CONTACT} event is fired when a contact occurs between this collision volume and a {@link pc.fw.RigidBodyComponent}.
     * @param {pc.fw.ContactResult} result Details of the contact between the two Entities.
    */

    /**
     * @event
     * @name pc.fw.CollisionComponent#collisionstart
     * @description The {@link pc.fw.EVENT_COLLISIONSTART} event is fired when another {@link pc.fw.RigidBodyComponent} enters this collision volume.
     * @param {pc.fw.ContactResult} result Details of the contact between the two Entities.
    */

    /**
     * @event
     * @name pc.fw.CollisionComponent#collisionend
     * @description The {@link pc.fw.EVENT_COLLISIONEND} event is fired when a {@link pc.fw.RigidBodyComponent} has stopped touching this collision volume.
     * @param {pc.fw.Entity} other The {@link pc.fw.Entity} that stopped touching this collision volume.
    */
    var CollisionComponent = function CollisionComponent (system, entity) {
        this.on('set_type', this.onSetType, this);
        this.on('set_halfExtents', this.onSetHalfExtents, this);
        this.on('set_radius', this.onSetRadius, this);
        this.on('set_height', this.onSetHeight, this);
        this.on('set_axis', this.onSetAxis, this);
        this.on("set_asset", this.onSetAsset, this);

        if (!entity.rigidbody) {
            entity.on('livelink:updatetransform', this.onLiveLinkUpdateTransform, this);
        }

    };
    CollisionComponent = pc.inherits(CollisionComponent, pc.fw.Component);
    
    pc.extend(CollisionComponent.prototype, {

        onSetType: function (name, oldValue, newValue) {
            if (oldValue !== newValue) {
                this.system.changeType(this, oldValue, newValue);
            }
        },

        onSetHalfExtents: function (name, oldValue, newValue) {
            if (this.data.type === 'box') {
                this.system.refreshPhysicalShapes(this);
            }
        },

        onSetRadius: function (name, oldValue, newValue) {
            if (this.data.type === 'sphere' || this.data.type === 'capsule') {
                this.system.refreshPhysicalShapes(this);
            }
        },

        onSetHeight: function (name, oldValue, newValue) {
            if (this.data.type === 'capsule') {
                this.system.refreshPhysicalShapes(this);
            }
        },

        onSetAxis: function (name, oldValue, newValue) {
            if (this.data.type === 'capsule') {
                this.system.refreshPhysicalShapes(this);
            }
        },

        onSetAsset: function (name, oldValue, newValue) {
            if (this.data.type === 'mesh') {
                this.system.refreshPhysicalShapes(this);
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
        CollisionComponent: CollisionComponent
    };
}());
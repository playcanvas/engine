pc.extend(pc.fw, function () {
    /**
     * @component
     * @name pc.fw.CollisionComponent
     * @constructor Create a new CollisionComponent
     * @class A collision volume. use this in conjunction with a {@link pc.fw.RigidBodyComponent} to make a collision volume that can be simulated using the physics engine.
     * <p>If the {@link pc.fw.Entity} does not have a {@link pc.fw.RigidBodyComponent} then this collision volume will act as a trigger volume. When an entity with a dynamic 
     * or kinematic body enters or leaves an entity with a trigger volume, both entities will receive trigger events.
     * <p>The following table shows all the events that can be fired between two Entities:
     * <table class="table table-striped table-condensed">
     *  <tr><td></td><td><strong>Rigid Body (Static)</strong></td><td><strong>Rigid Body (Dynamic or Kinematic)</strong></td><td><strong>Trigger Volume</strong></td></tr>
     *  <tr>
     *       <td><strong>Rigid Body (Static)</strong></td>
     *       <td>-</td>
     *       <td><ul class="list-group">
     *           <li class="list-group-item">contact</li>
     *           <li class="list-group-item">collisionstart</li>
     *           <li class="list-group-item">collisionend</li>
     *       </td>
     *       <td>-</td>
     *   </tr>
     *  <tr>
     *       <td><strong>Rigid Body (Dynamic or Kinematic)</strong></td>
     *       <td><ul class="list-group">
     *           <li class="list-group-item">contact</li>
     *           <li class="list-group-item">collisionstart</li>
     *           <li class="list-group-item">collisionend</li>
     *       </td>
     *       <td><ul class="list-group">
     *           <li class="list-group-item">contact</li>
     *           <li class="list-group-item">collisionstart</li>
     *           <li class="list-group-item">collisionend</li>
     *       </td>
     *       <td><ul class="list-group">
     *           <li class="list-group-item">triggerenter</li>
     *           <li class="list-group-item">triggerleave</li>
     *       </td>
     *   </tr>     
     *  <tr>
     *       <td><strong>Trigger Volume</strong></td>
     *       <td>-</td>
     *       <td><ul class="list-group">
     *           <li class="list-group-item">triggerenter</li>
     *           <li class="list-group-item">triggerleave</li>
     *       </td>
     *       <td>-</td>
     *   </tr>   
     * </table>
     * </p>
     * @param {pc.fw.CollisionComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity that this Component is attached to.     
     * @property {String} type The type of the collision volume. Defaults to 'box'. Can be one of the following:
     * <ul>
     * <li><strong>box</strong>: A box-shaped collision volume.</li>
     * <li><strong>sphere</strong>: A sphere-shaped collision volume.</li>
     * <li><strong>capsulse</strong>: A capsule-shaped collision volume.</li>
     * <li><strong>cylinder</strong>: A cylinder-shaped collision volume.</li>
     * <li><strong>mesh</strong>: A collision volume that uses a model asset as its shape.</li>
     * </ul>     
     * @property {pc.math.vec3} halfExtents The half-extents of the box-shaped collision volume in the x, y and z axes. Defaults to [0.5, 0.5, 0.5]
     * @property {pc.math.vec3} radius The radius of the sphere, capsule or cylinder-shaped collision volumes. Defaults to 0.5
     * @property {Number} axis The local space axis with which the capsule or cylinder-shaped collision volume's length is aligned. 0 for X, 1 for Y and 2 for Z. Defaults to 1 (Y-axis).
     * @property {Number} height The total height of the capsule or cylinder-shaped collision volume from tip to tip. Defaults to 2.
     * @property {String} asset The GUID of the asset for the model of the mesh collision volume.
     * @property {pc.scene.Model} model The model that is added to the scene graph for the mesh collision volume.
     * @extends pc.fw.Component
     */

    // Events Documentation   
    /**
     * @event
     * @name pc.fw.CollisionComponent#contact
     * @description The 'contact' event is fired when a contact occurs between two rigid bodies
     * @param {pc.fw.ContactResult} result Details of the contact between the two rigid bodies.
    */

    /**
     * @event
     * @name pc.fw.CollisionComponent#collisionstart
     * @description The 'collisionstart' event is fired when two rigid bodies start touching.
     * @param {pc.fw.ContactResult} result Details of the contact between the two Entities.
    */

    /**
     * @event
     * @name pc.fw.CollisionComponent#collisionend
     * @description The 'collisionend' event is fired two rigid-bodies stop touching.
     * @param {pc.fw.Entity} other The {@link pc.fw.Entity} that stopped touching this collision volume.
    */

    /**
     * @event
     * @name pc.fw.CollisionComponent#triggerenter
     * @description The 'triggerenter' event is fired when a rigid body enters a trigger volume.
     * a {@link pc.fw.RigidBodyComponent} attached.
     * @param {pc.fw.Entity} other The {@link pc.fw.Entity} that entered this collision volume.
    */

    /**
     * @event
     * @name pc.fw.CollisionComponent#triggerleave
     * @description The 'triggerleave' event is fired when a rigid body exits a trigger volume.
     * a {@link pc.fw.RigidBodyComponent} attached.
     * @param {pc.fw.Entity} other The {@link pc.fw.Entity} that exited this collision volume.
    */
    var CollisionComponent = function CollisionComponent (system, entity) {
        this.on('set_type', this.onSetType, this);
        this.on('set_halfExtents', this.onSetHalfExtents, this);
        this.on('set_radius', this.onSetRadius, this);
        this.on('set_height', this.onSetHeight, this);
        this.on('set_axis', this.onSetAxis, this);
        this.on("set_asset", this.onSetAsset, this);

        entity.on('livelink:updatetransform', this.onLiveLinkUpdateTransform, this);
        system.on('beforeremove', this.onBeforeRemove, this);
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
                this.system.recreatePhysicalShapes(this);
            }
        },

        onSetRadius: function (name, oldValue, newValue) {
            if (this.data.type === 'sphere' || this.data.type === 'capsule' || this.data.type === 'cylinder') {
                this.system.recreatePhysicalShapes(this);
            }
        },

        onSetHeight: function (name, oldValue, newValue) {
            if ((this.data.type === 'capsule') || (this.data.type === 'cylinder')) {
                this.system.recreatePhysicalShapes(this);
            }
        },

        onSetAxis: function (name, oldValue, newValue) {
            if ((this.data.type === 'capsule') || (this.data.type === 'cylinder')) {
                this.system.recreatePhysicalShapes(this);
            }
        },

        onSetAsset: function (name, oldValue, newValue) {
            if (this.data.type === 'mesh') {
                this.system.recreatePhysicalShapes(this);
            }
        },
 
        /**
         * Handle an update over livelink from the tools updating the Entities transform
         */
        onLiveLinkUpdateTransform: function (position, rotation, scale) {
            this.system.onTransformChanged(this, position, rotation, scale);
        },

        onBeforeRemove: function(entity, component) {
            if (this === component) {
                entity.off('livelink:updatetransform', this.onLiveLinkUpdateTransform, this);
                this.system.off('beforeremove', this.onBeforeRemove, this);
            }
        }
    });

    return {
        CollisionComponent: CollisionComponent
    };
}());
Object.assign(pc, function () {
    /**
     * @component
     * @constructor
     * @name pc.CollisionComponent
     * @classdesc A collision volume. Use this in conjunction with a {@link pc.RigidBodyComponent} to make a collision volume that can be simulated using the physics engine.
     * <p>If the {@link pc.Entity} does not have a {@link pc.RigidBodyComponent} then this collision volume will act as a trigger volume. When an entity with a dynamic
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
     * @description Create a new CollisionComponent
     * @param {pc.CollisionComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @property {String} type The type of the collision volume. Defaults to 'box'. Can be one of the following:
     * <ul>
     * <li><strong>box</strong>: A box-shaped collision volume.</li>
     * <li><strong>sphere</strong>: A sphere-shaped collision volume.</li>
     * <li><strong>capsule</strong>: A capsule-shaped collision volume.</li>
     * <li><strong>cylinder</strong>: A cylinder-shaped collision volume.</li>
     * <li><strong>mesh</strong>: A collision volume that uses a model asset as its shape.</li>
     * </ul>
     * @property {pc.Vec3} halfExtents The half-extents of the box-shaped collision volume in the x, y and z axes. Defaults to [0.5, 0.5, 0.5]
     * @property {Number} radius The radius of the sphere, capsule or cylinder-shaped collision volumes. Defaults to 0.5
     * @property {Number} axis The local space axis with which the capsule or cylinder-shaped collision volume's length is aligned. 0 for X, 1 for Y and 2 for Z. Defaults to 1 (Y-axis).
     * @property {Number} height The total height of the capsule or cylinder-shaped collision volume from tip to tip. Defaults to 2.
     * @property {pc.Asset} asset The asset for the model of the mesh collision volume - can also be an asset id.
     * @property {pc.Model} model The model that is added to the scene graph for the mesh collision volume.
     * @extends pc.Component
     */
    var CollisionComponent = function CollisionComponent(system, entity) {
        pc.Component.call(this, system, entity);

        this.on('set_type', this.onSetType, this);
        this.on('set_halfExtents', this.onSetHalfExtents, this);
        this.on('set_radius', this.onSetRadius, this);
        this.on('set_height', this.onSetHeight, this);
        this.on('set_axis', this.onSetAxis, this);
        this.on("set_asset", this.onSetAsset, this);
        this.on("set_model", this.onSetModel, this);
    };
    CollisionComponent.prototype = Object.create(pc.Component.prototype);
    CollisionComponent.prototype.constructor = CollisionComponent;

    // Events Documentation
    /**
     * @event
     * @name pc.CollisionComponent#contact
     * @description The 'contact' event is fired when a contact occurs between two rigid bodies
     * @param {pc.ContactResult} result Details of the contact between the two rigid bodies.
     */

    /**
     * @event
     * @name pc.CollisionComponent#collisionstart
     * @description The 'collisionstart' event is fired when two rigid bodies start touching.
     * @param {pc.ContactResult} result Details of the contact between the two Entities.
     */

    /**
     * @event
     * @name pc.CollisionComponent#collisionend
     * @description The 'collisionend' event is fired two rigid-bodies stop touching.
     * @param {pc.Entity} other The {@link pc.Entity} that stopped touching this collision volume.
     */

    /**
     * @event
     * @name pc.CollisionComponent#triggerenter
     * @description The 'triggerenter' event is fired when a rigid body enters a trigger volume.
     * a {@link pc.RigidBodyComponent} attached.
     * @param {pc.Entity} other The {@link pc.Entity} that entered this collision volume.
     */

    /**
     * @event
     * @name pc.CollisionComponent#triggerleave
     * @description The 'triggerleave' event is fired when a rigid body exits a trigger volume.
     * a {@link pc.RigidBodyComponent} attached.
     * @param {pc.Entity} other The {@link pc.Entity} that exited this collision volume.
     */

    Object.assign(CollisionComponent.prototype, {

        onSetType: function (name, oldValue, newValue) {
            if (oldValue !== newValue) {
                this.system.changeType(this, oldValue, newValue);
            }
        },

        onSetHalfExtents: function (name, oldValue, newValue) {
            if (this.data.initialized && this.data.type === 'box') {
                this.system.recreatePhysicalShapes(this);
            }
        },

        onSetRadius: function (name, oldValue, newValue) {
            if (this.data.initialized && (this.data.type === 'sphere' || this.data.type === 'capsule' || this.data.type === 'cylinder')) {
                this.system.recreatePhysicalShapes(this);
            }
        },

        onSetHeight: function (name, oldValue, newValue) {
            if (this.data.initialized && (this.data.type === 'capsule' || this.data.type === 'cylinder')) {
                this.system.recreatePhysicalShapes(this);
            }
        },

        onSetAxis: function (name, oldValue, newValue) {
            if (this.data.initialized && (this.data.type === 'capsule' || this.data.type === 'cylinder')) {
                this.system.recreatePhysicalShapes(this);
            }
        },

        onSetAsset: function (name, oldValue, newValue) {
            var asset;
            var assets = this.system.app.assets;

            if (oldValue) {
                // Remove old listeners
                asset = assets.get(oldValue);
                if (asset) {
                    asset.off('remove', this.onAssetRemoved, this);
                }
            }

            if (newValue) {
                if (newValue instanceof pc.Asset) {
                    this.data.asset = newValue.id;
                }

                asset = assets.get(this.data.asset);
                if (asset) {
                    // make sure we don't subscribe twice
                    asset.off('remove', this.onAssetRemoved, this);
                    asset.on('remove', this.onAssetRemoved, this);
                }
            }

            if (this.data.initialized && this.data.type === 'mesh') {
                if (!newValue) {
                    // if asset is null set model to null
                    // so that it's going to be removed from the simulation
                    this.data.model = null;
                }
                this.system.recreatePhysicalShapes(this);
            }
        },

        onSetModel: function (name, oldValue, newValue) {
            if (this.data.initialized && this.data.type === 'mesh') {
                // recreate physical shapes skipping loading the model
                // from the 'asset' as the model passed in newValue might
                // have been created procedurally
                this.system.implementations.mesh.doRecreatePhysicalShape(this);
            }
        },

        onAssetRemoved: function (asset) {
            asset.off('remove', this.onAssetRemoved, this);
            if (this.data.asset === asset.id) {
                this.asset = null;
            }
        },

        onEnable: function () {
            if (this.data.type === 'mesh' && this.data.asset && this.data.initialized) {
                var asset = this.system.app.assets.get(this.data.asset);
                // recreate the collision shape if the model asset is not loaded
                // or the shape does not exist
                if (asset && (!asset.resource || !this.data.shape)) {
                    this.system.recreatePhysicalShapes(this);
                    return;
                }
            }

            if (this.entity.trigger) {
                this.entity.trigger.enable();
            } else if (this.entity.rigidbody) {
                if (this.entity.rigidbody.enabled) {
                    this.entity.rigidbody.enableSimulation();
                }
            }
        },

        onDisable: function () {
            if (this.entity.trigger) {
                this.entity.trigger.disable();
            } else if (this.entity.rigidbody) {
                this.entity.rigidbody.disableSimulation();
            }
        }
    });

    return {
        CollisionComponent: CollisionComponent
    };
}());

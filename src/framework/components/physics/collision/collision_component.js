pc.extend(pc.fw, function () {
    var CollisionComponent = function CollisionComponent (system, entity) {
        entity.collider = this;

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
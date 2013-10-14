pc.extend(pc.fw, function () {
    var CollisionComponent = function CollisionComponent (system, entity) {
        entity.collider = this;

        this.on('set_type', this.onSetType, this);
        this.on('set_halfExtents', this.onSetHalfExtents, this);
        this.on('set_radius', this.onSetRadius, this);
        this.on('set_height', this.onSetHeight, this);
        this.on('set_axis', this.onSetAxis, this);

        if (!entity.rigidbody) {
            entity.on('livelink:updatetransform', this.onLiveLinkUpdateTransform, this);
        }

    };
    CollisionComponent = pc.inherits(CollisionComponent, pc.fw.Component);
    
    pc.extend(CollisionComponent.prototype, {

        onSetType: function (name, oldValue, newValue) {
            this.system.recreateDebugShapes(this, oldValue);
        },

        onSetHalfExtents: function (name, oldValue, newValue) {
            this.system.refreshPhysicsShapes(this);
        },

        onSetRadius: function (name, oldValue, newValue) {
            this.system.refreshPhysicsShapes(this);
        },

        onSetHeight: function (name, oldValue, newValue) {
            this.system.refreshPhysicsShapes(this);
        },

        onSetAxis: function (name, oldValue, newValue) {
            this.system.refreshPhysicsShapes(this);
        },
 
        /**
         * Handle an update over livelink from the tools updating the Entities transform
         */
        onLiveLinkUpdateTransform: function (position, rotation, scale) {
            console.log("helloooo");
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
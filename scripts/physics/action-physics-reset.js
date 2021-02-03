var ActionPhysicsReset = pc.createScript('actionPhysicsReset');

ActionPhysicsReset.attributes.add('event', {
    type: 'string',
    title: 'Event',
    description: 'If the specified event is fired and this entity has a dynamic rigid body, it will be reset to its initial position and orientation. The event must be fired on the app.'
});

// initialize code called once per entity
ActionPhysicsReset.prototype.postInitialize = function () {
    var app = this.app;
    var entity = this.entity;

    var pos = entity.getPosition().clone();
    var rot = entity.getRotation().clone();

    var reset = function () {
        var rigidbody = entity.rigidbody;
        if (rigidbody && rigidbody.type === 'dynamic') {
            // Reset the body to its initial state (with zero linear and angular velocity)
            rigidbody.teleport(pos, rot);
            rigidbody.linearVelocity = pc.Vec3.ZERO;
            rigidbody.angularVelocity = pc.Vec3.ZERO;
        }
    };

    if (this.event && this.event.length > 0) {
        app.on(this.event, reset);
    }

    this.on('attr:event', function (value, prev) {
        if (prev && prev.length > 0) {
            app.off(prev, reset);
        }
        if (value && value.length > 0) {
            app.on(value, reset);
        }
    });

    this.on('destroy', function () {
        if (this.event && this.event.length > 0) {
            app.off(this.event, reset);
        }
    });
};

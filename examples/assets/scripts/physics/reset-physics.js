var ResetPhysics = pc.createScript('resetPhysics');

// initialize code called once per entity
ResetPhysics.prototype.postInitialize = function () {
    // Record the start state of all dynamic rigid bodies
    this.bodies = [];
    this.app.root.findComponents('rigidbody').forEach(function (bodyComponent) {
        if (bodyComponent.type === 'dynamic') {
            this.bodies.push({
                entity: bodyComponent.entity,
                initialPos: bodyComponent.entity.getPosition().clone(),
                initialRot: bodyComponent.entity.getRotation().clone()
            });
        }
    }, this);
};

// update code called every frame
ResetPhysics.prototype.update = function (dt) {
    if (this.app.keyboard.wasPressed(pc.KEY_R)) {
        this.bodies.forEach(function (body) {
            // Reset all dynamic bodies to their initial state
            body.entity.rigidbody.teleport(body.initialPos, body.initialRot);
            body.entity.rigidbody.linearVelocity = pc.Vec3.ZERO;
            body.entity.rigidbody.angularVelocity = pc.Vec3.ZERO;
        });
    }
};

pc.extend(pc.fw, function () {
    /**
     * @private
     * @name pc.fw.CollisionSphereComponentData
     * @constructor Create a new CollisionSphereComponentData
     * @class A sphere-shaped collision volume. Use in conjunction with {@link pc.fw.RigidBodyComponent} to create a sphere that can be simulated using the physics engine.
     * @extends pc.fw.ComponentData
     */
    var CollisionSphereComponentData = function () {
        this.radius = 0.5;

        // Non-serialized properties
        this.shape = null;
        this.model = null;
    };
    CollisionSphereComponentData = pc.inherits(CollisionSphereComponentData, pc.fw.ComponentData);

    return {
        CollisionSphereComponentData: CollisionSphereComponentData
    };
}());
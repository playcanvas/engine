pc.extend(pc.fw, function () {
    /**
     * @private
     * @name pc.fw.CollisionCapsuleComponentData
     * @constructor Create a new CollisionCapsuleComponentData
     * @class A capsule-shaped collision volume. Use in conjunction with {@link pc.fw.RigidBodyComponent} to create a capsule that can be simulated using the physics engine.
     * @extends pc.fw.ComponentData
     */
    var CollisionCapsuleComponentData = function () {
        this.axis = 1;
        this.radius = 0.5;
        this.height = 2;

        // Non-serialized properties
        this.shape = null;
        this.model = null;
    };
    CollisionCapsuleComponentData = pc.inherits(CollisionCapsuleComponentData, pc.fw.ComponentData);

    return {
        CollisionCapsuleComponentData: CollisionCapsuleComponentData
    };
}());
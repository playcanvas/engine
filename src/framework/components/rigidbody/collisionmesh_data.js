pc.extend(pc.fw, function () {

    /**
     * @private
     * @name pc.fw.CollisionMeshComponentData
     * @constructor Create a new CollisionMeshComponentData
     * @class A collision mesh. Use this in conjunction with a RigidBodyComponent to make a
     * mesh based rigid body that can be simulated using the physics engine.
     * @extends pc.fw.ComponentData
     */
    var CollisionMeshComponentData = function () {
        // Serialized properties
        this.asset = null;

        // Non-serialized properties
        this.shape = null;
        this.model = null;
    };
    CollisionMeshComponentData = pc.inherits(CollisionMeshComponentData, pc.fw.ComponentData);

    return {
        CollisionMeshComponentData: CollisionMeshComponentData
    };
}());
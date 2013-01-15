pc.extend(pc.fw, function () {
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
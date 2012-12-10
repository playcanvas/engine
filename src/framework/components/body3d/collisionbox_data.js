pc.extend(pc.fw, function () {
    var CollisionBoxComponentData = function () {
        this.x = 0.5;
        this.y = 0.5;
        this.z = 0.5;

        // Non-serialized properties
        this.shape = null;
    };
    CollisionBoxComponentData = pc.inherits(CollisionBoxComponentData, pc.fw.ComponentData);

    return {
        CollisionBoxComponentData: CollisionBoxComponentData
    };
}());
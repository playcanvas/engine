pc.extend(pc.fw, function () {
    var CollisionBoxComponentData = function () {
        this.size = [0.5, 0.5, 0.5];

        // Non-serialized properties
        this.shape = null;
        this.model = null;
    };
    CollisionBoxComponentData = pc.inherits(CollisionBoxComponentData, pc.fw.ComponentData);

    return {
        CollisionBoxComponentData: CollisionBoxComponentData
    };
}());
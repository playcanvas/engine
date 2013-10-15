pc.extend(pc.fw, function () {
    var CollisionComponentData = function () {
        this.type = 'Box';
        this.halfExtents = [0.5, 0.5, 0.5];
        this.radius = 0.5;
        this.axis = 1;
        this.height = 2;
        this.asset = null;

        // Non-serialized properties
        this.shape = null;
        this.model = null;
    };
    CollisionComponentData = pc.inherits(CollisionComponentData, pc.fw.ComponentData);

    return {
        CollisionComponentData: CollisionComponentData
    };
}());
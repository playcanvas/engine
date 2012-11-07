pc.extend(pc.fw, function () {
    var CollisionCircleComponentData = function () {
        this.density = 1;
        this.friction = 0.5;
        this.restitution = 0;
        this.radius = 1;
    };
    CollisionCircleComponentData = pc.inherits(CollisionCircleComponentData, pc.fw.ComponentData);

    return {
        CollisionCircleComponentData: CollisionCircleComponentData
    };
}());
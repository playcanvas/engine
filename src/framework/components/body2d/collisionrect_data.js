pc.extend(pc.fw, function () {
    var CollisionRectComponentData = function () {
        this.density = 1;
        this.friction = 0.5;
        this.restitution = 0;
        this.x = 0.5;
        this.y = 0.5;
    };
    CollisionRectComponentData = pc.inherits(CollisionRectComponentData, pc.fw.ComponentData);

    return {
        CollisionRectComponentData: CollisionRectComponentData
    };
}());
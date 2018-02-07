pc.extend(pc, function () {
    var SpriteComponentData = function () {
        this.enabled = true;
    };
    SpriteComponentData = pc.inherits(SpriteComponentData, pc.ComponentData);

    return {
        SpriteComponentData: SpriteComponentData
    };
}());

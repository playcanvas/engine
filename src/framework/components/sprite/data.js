Object.assign(pc, (function () {
    function SpriteComponentData() {
        this.enabled = true;
    }
    SpriteComponentData = pc.inherits(SpriteComponentData, pc.ComponentData);

    return {
        SpriteComponentData: SpriteComponentData
    };
}()));

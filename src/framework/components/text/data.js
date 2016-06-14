pc.extend(pc, function () {
    var TextComponentData = function () {
        this.enabled = true;
    };
    TextComponentData = pc.inherits(TextComponentData, pc.ComponentData);

    return {
        TextComponentData: TextComponentData
    };
}());

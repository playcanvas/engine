pc.extend(pc, function () {
    var LayoutChildComponentData = function () {
        this.enabled = true;
    };
    LayoutChildComponentData = pc.inherits(LayoutChildComponentData, pc.ComponentData);

    return {
        LayoutChildComponentData: LayoutChildComponentData
    };
}());

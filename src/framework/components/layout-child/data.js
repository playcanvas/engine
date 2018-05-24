Object.assign(pc, (function () {
    function LayoutChildComponentData() {
        this.enabled = true;
    }
    LayoutChildComponentData = pc.inherits(LayoutChildComponentData, pc.ComponentData);

    return {
        LayoutChildComponentData: LayoutChildComponentData
    };
}()));

pc.extend(pc, function () {
    function LayoutGroupComponentData() {
        this.enabled = true;
    }
    LayoutGroupComponentData = pc.inherits(LayoutGroupComponentData, pc.ComponentData);

    return {
        LayoutGroupComponentData: LayoutGroupComponentData
    };
}());

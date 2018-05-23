pc.extend(pc, function () {
    function ScreenComponentData() {
        this.enabled = true;
    }
    ScreenComponentData = pc.inherits(ScreenComponentData, pc.ComponentData);

    return {
        ScreenComponentData: ScreenComponentData
    };
}());

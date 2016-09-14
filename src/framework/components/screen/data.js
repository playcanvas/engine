pc.extend(pc, function () {
    var ScreenComponentData = function () {
        this.enabled = true;
    };
    ScreenComponentData = pc.inherits(ScreenComponentData, pc.ComponentData);

    return {
        ScreenComponentData: ScreenComponentData
    };
}());

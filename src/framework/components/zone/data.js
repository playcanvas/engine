pc.extend(pc, function () {
    var ZoneComponentData = function () {
        this.enabled = true;
    };
    ZoneComponentData = pc.inherits(ZoneComponentData, pc.ComponentData);

    return {
        ZoneComponentData: ZoneComponentData
    };
}());

Object.assign(pc, (function () {
    function ZoneComponentData() {
        this.enabled = true;
    }
    ZoneComponentData = pc.inherits(ZoneComponentData, pc.ComponentData);

    return {
        ZoneComponentData: ZoneComponentData
    };
}()));

pc.extend(pc.fw, function () {
    function PackComponentData() {
    }
    PackComponentData = pc.inherits(PackComponentData, pc.fw.ComponentData);
    
    return {
        PackComponentData: PackComponentData
    };
}());

pc.extend(pc.fw, function () {
    function PackComponentData() {
    }
    PackComponentData = PackComponentData.extendsFrom(pc.fw.ComponentData);
    
    return {
        PackComponentData: PackComponentData
    };
}());

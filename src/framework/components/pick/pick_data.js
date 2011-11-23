pc.extend(pc.fw, function() {
    function PickComponentData() {
        this.layer = 'default';
        this.shapes = [];
        this.material = null;
    };
    PickComponentData = PickComponentData.extendsFrom(pc.fw.ComponentData);
    
    return {
        PickComponentData: PickComponentData    
    }
}());

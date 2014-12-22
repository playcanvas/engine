pc.extend(pc, function() {
    function PickComponentData() {
        this.layer = 'default';
        this.shapes = [];
        this.material = null;
    };
    PickComponentData = pc.inherits(PickComponentData, pc.ComponentData);
    
    return {
        PickComponentData: PickComponentData    
    }
}());

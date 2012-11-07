pc.extend(pc.fw, function() {
    
    function ModelComponentData() {
        // serialized
        this.asset = null;
        this.castShadows = false;
        this.receiveShadows = true;
        
        // non-serialized
        this.model = null;
    }
    ModelComponentData = pc.inherits(ModelComponentData, pc.fw.ComponentData);
    
    return {
        ModelComponentData:ModelComponentData 
    };
}());
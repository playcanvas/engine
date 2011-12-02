pc.extend(pc.fw, function() {
    
    function ModelComponentData() {
        // serialized
        this.asset = null;
        
        // non-serialized
        this.model = null;
    }
    ModelComponentData = ModelComponentData.extendsFrom(pc.fw.ComponentData);
    
    return {
        ModelComponentData:ModelComponentData 
    };
}());
editor.link.addComponentType("model");

editor.link.expose({
    system: "model",
    variable: "asset",
    displayName: "Asset",
    description: "Model Asset to render",
    type: "asset",
    options: {
        max: 1
    },
    defaultValue: null
});

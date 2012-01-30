pc.extend(pc.fw, function() {
    
    function ModelComponentData() {
        // serialized
        this.assets = [];
        
        // non-serialized
        this.models = [];
        this.assetList = [];
    }
    ModelComponentData = ModelComponentData.extendsFrom(pc.fw.ComponentData);
    
    return {
        ModelComponentData:ModelComponentData 
    };
}());
editor.link.addComponentType("model");

editor.link.expose({
    system: "model",
    variable: "assets",
    displayName: "Asset",
    description: "Model Asset to render",
    type: "asset",
    options: {
        max: 100,
        type: 'model'
    },
    defaultValue: []
});

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
// editor.link.addComponentType("model");

// editor.link.expose({
//     system: "model",
//     variable: "asset",
//     displayName: "Asset",
//     description: "Model Asset to render",
//     type: "asset",
//     options: {
//         max: 1,
//         type: 'model'
//     },
//     defaultValue: null
// });

// editor.link.expose({
//     system: "model",
//     variable: "castShadows",
//     displayName: "Cast shadows",
//     description: "Occlude light from shadow casting lights",
//     type: "boolean",
//     defaultValue: false
// });

// editor.link.expose({
//     system: "model",
//     variable: "receiveShadows",
//     displayName: "Receive shadows",
//     description: "Receive shadows cast from occluders",
//     type: "boolean",
//     defaultValue: true
// });
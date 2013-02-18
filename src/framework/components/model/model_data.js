pc.extend(pc.fw, function() {
    
    /**
    * @private
    * @name pc.fw.ModelComponentData
    * @class Data for a {@link pc.fw.ModelComponent}
    * @constructor Create a new data object
    * @property {String} asset The GUID of the asset for the model
    * @property {Boolean} castShadows If true, this model will cast shadows for lights that have shadow casting enabled.
    * @property {Boolean} receiveShadows If true, shadows will be cast on this model
    * @property {pc.scene.Model} model The mode; node that is added to the scene graph.
    * @extends pc.fw.ComponentData
    */
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
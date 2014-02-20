pc.extend(pc.fw, function() {
    
    /**
    * @private
    * @name pc.fw.ModelComponentData
    * @class Data for a {@link pc.fw.ModelComponent}
    * @constructor Create a new data object
    * @extends pc.fw.ComponentData
    */
    var ModelComponentData = function () {
        // serialized
        this.enabled = true;
        this.type = 'asset';
        this.asset = null;
        this.castShadows = false;
        this.receiveShadows = true;
        this.materialAsset = null;
        
        // non-serialized
        this.material = null;
        this.model = null;
    };
    ModelComponentData = pc.inherits(ModelComponentData, pc.fw.ComponentData);
    
    return {
        ModelComponentData:ModelComponentData 
    };
}());
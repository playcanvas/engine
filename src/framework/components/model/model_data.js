pc.extend(pc, function() {

    /**
    * @private
    * @name pc.ModelComponentData
    * @class Data for a {@link pc.ModelComponent}
    * @constructor Create a new data object
    * @extends pc.ComponentData
    */
    var ModelComponentData = function () {
        // serialized
        this.enabled = true;
        this.type = 'asset';
        this.asset = null;
        this.castShadows = false;
        this.receiveShadows = true;
        this.materialAsset = null;
        this.mapping = null;

        // non-serialized
        this.material = null;
        this.model = null;
    };
    ModelComponentData = pc.inherits(ModelComponentData, pc.ComponentData);

    return {
        ModelComponentData:ModelComponentData
    };
}());
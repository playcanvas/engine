pc.extend(pc, function() {

    /**
    * @private
    * @name pc.ModelComponentData
    * @class Data for a {@link pc.ModelComponent}
    * @description Create a new data object
    * @extends pc.ComponentData
    */
    var ModelComponentData = function () {
        // serialized
        this.enabled = true;
        this.type = 'asset';
        this.asset = null;
        this.castShadows = true;
        this.receiveShadows = true;
        this.materialAsset = null;
        this.mapping = null;
        this.castShadowsLightmap = true;
        this.lightmapped = false;
        this.lightmapSizeMultiplier = 1;
        this.isStatic = false;

        // non-serialized
        this.material = null;
        this.model = null;
    };
    ModelComponentData = pc.inherits(ModelComponentData, pc.ComponentData);

    return {
        ModelComponentData:ModelComponentData
    };
}());

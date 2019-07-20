Object.assign(pc, function () {

    /**
     * @deprecated
     * @private
     * @constructor
     * @name pc.ModelComponentData
     * @classdesc Data for a {@link pc.ModelComponent}
     * @description Create a new data object
     * @extends pc.ComponentData
     */
    var ModelComponentData = function () {
        this.enabled = true;
    };

    return {
        ModelComponentData: ModelComponentData
    };
}());

Object.assign(pc, function () {

    /**
     * @deprecated
     * @private
     * @constructor
     * @name pc.ModelComponentData
     * @extends pc.ComponentData
     * @classdesc Data for a {@link pc.ModelComponent}
     * @description Create a new data object
     */
    var ModelComponentData = function () {
        this.enabled = true;
    };

    return {
        ModelComponentData: ModelComponentData
    };
}());

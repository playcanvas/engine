Object.assign(pc, function () {
    /**
     * @class
     * @name pc.AnimComponentData
     * @property {number} speed
     * @property {boolean} active
     * @property {boolean} enabled
     * @property {boolean} playing
     * @property {pc.AnimComponentLayer[]} layers
     * @property {object|undefined} parameters
     * @property {pc.Model|null} model
     */
    var AnimComponentData = function () {
        // Serialized
        this.stateGraphAsset = null;
        this.speed = 1.0;
        this.activate = true;
        this.enabled = true;
        this.playing = false;

        // Non-serialized
        this.stateGraph = null;
        this.layers = [];
        this.layerIndices = {};
        this.parameters = {};
    };

    return {
        AnimComponentData: AnimComponentData
    };
}());

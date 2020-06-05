Object.assign(pc, function () {
    /**
     * @class
     * @name pc.AnimComponentData
     * @property {number} speed Speed
     * @property {boolean} active Active
     * @property {boolean} enabled Enabled
     * @property {boolean} playing Playing
     * @property {pc.AnimComponentLayer[]} layers Layers
     * @property {object|undefined} parameters Parameters
     * @property {pc.Model|null} model Model
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

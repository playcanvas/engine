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
        this.speed = 1.0;
        this.activate = true;
        this.enabled = true;
        this.playing = false;

        // Non-serialized
        this.layers = [];
        this.layerIndicies = {};
        this.parameters = {};
        this.model = null;
    };

    return {
        AnimComponentData: AnimComponentData
    };
}());

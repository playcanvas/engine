Object.assign(pc, function () {
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
        this.layerIndicies = {};
        this.parameters = {};
    };

    return {
        AnimComponentData: AnimComponentData
    };
}());

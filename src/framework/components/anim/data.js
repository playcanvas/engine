Object.assign(pc, function () {
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

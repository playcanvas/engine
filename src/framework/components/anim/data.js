Object.assign(pc, function () {
    var AnimComponentData = function () {
        // Serialized
        this.speed = 1.0;
        this.activate = true;
        this.enabled = true;

        // Non-serialized
        this.animController = null;
        this.model = null;
        this.playing = false;
    };

    return {
        AnimComponentData: AnimComponentData
    };
}());

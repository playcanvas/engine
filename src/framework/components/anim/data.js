class AnimComponentData {
    constructor() {
        // Serialized
        this.stateGraphAsset = null;
        this.animationAssets = {};
        this.speed = 1.0;
        this.activate = true;
        this.enabled = true;
        this.playing = false;

        // Non-serialized
        this.rootBone = null;
        this.stateGraph = null;
        this.layers = [];
        this.layerIndices = {};
        this.parameters = {};
    }
}

export { AnimComponentData };

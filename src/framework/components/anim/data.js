function AnimComponentData() {
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
}

export { AnimComponentData };

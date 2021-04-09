// Storage of shadow casters for a single light
class LightCompositionData {
    constructor() {
        // stored in a set for fast de-duplication
        this.shadowCastersSet = new Set();

        // stored in an array for fast iteration
        this.shadowCastersList = [];
    }

    clearShadowCasters() {
        this.shadowCastersSet.clear();
        this.shadowCastersList.length = 0;
    }

    addShadowCaster(item) {
        if (!this.shadowCastersSet.has(item)) {
            this.shadowCastersSet.add(item);
            this.shadowCastersList.push(item);
        }
    }
}

export { LightCompositionData };

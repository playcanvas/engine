// Storage of data the LayerComposition needs to manage a light
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

    addShadowCasters(casters) {

        // add unique casters to the set and the list
        for (let i = 0; i < casters.length; i++) {
            const item = casters[i];
            if (!this.shadowCastersSet.has(item)) {
                this.shadowCastersSet.add(item);
                this.shadowCastersList.push(item);
            }
        }
    }
}

export { LightCompositionData };

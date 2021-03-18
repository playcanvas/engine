// Storage of shadow casters for a single light
class ShadowCasters {
    constructor() {
        // stored in a set for fast de-duplication
        this.set = new Set();

        // stored in an array for fast iteration
        this.list = [];
    }

    clear() {
        this.set.clear();
        this.list.length = 0;
    }

    add(item) {
        if (!this.set.has(item)) {
            this.set.add(item);
            this.list.push(item);
        }
    }
}

export { ShadowCasters };

// Class implementing reference counting cache for objects
class RefCountedCache {
    constructor() {
        // The cache. The key is the object being stored in the cache.
        // The value is ref count of the object. When that reaches zero,
        // destroy function on the object gets called and object is removed
        // from the cache.
        this.cache = new Map();
    }

    // destroy all stored objects
    destroy() {
        this.cache.forEach((refCount, object) => {
            object.destroy();
        });
        this.cache.clear();
    }

    // add object reference to the cache
    incRef(object) {
        const refCount = (this.cache.get(object) || 0) + 1;
        this.cache.set(object, refCount);
    }

    // remove object reference from the cache
    decRef(object) {
        if (object) {
            let refCount = this.cache.get(object);
            if (refCount) {
                refCount--;
                if (refCount === 0) {
                    // destroy object and remove it from cache
                    this.cache.delete(object);
                    object.destroy();
                } else {
                    // update new ref count in the cache
                    this.cache.set(object, refCount);
                }
            }
        }
    }
}

export { RefCountedCache };

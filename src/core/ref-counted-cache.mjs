/**
 * Class implementing reference counting cache for objects.
 *
 * @ignore
 */
class RefCountedCache {
    /**
     * The cache. The key is the object being stored in the cache. The value is ref count of the
     * object. When that reaches zero, destroy function on the object gets called and object is
     * removed from the cache.
     *
     * @type {Map<object, number>}
     */
    cache = new Map();

    /**
     * Destroy all stored objects.
     */
    destroy() {
        this.cache.forEach((refCount, object) => {
            object.destroy();
        });
        this.cache.clear();
    }

    /**
     * Add object reference to the cache.
     *
     * @param {object} object - The object to add.
     */
    incRef(object) {
        const refCount = (this.cache.get(object) || 0) + 1;
        this.cache.set(object, refCount);
    }

    /**
     * Remove object reference from the cache.
     *
     * @param {object} object - The object to remove.
     */
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

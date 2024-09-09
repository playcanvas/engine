import { Debug } from "./debug.js";
import { RefCountedObject } from "./ref-counted-object.js";

/**
 * An entry in the RefCountedKeyCache cache, which wraps the object with a reference count.
 */
class Entry extends RefCountedObject {
	object;

    constructor(obj) {
        super();
        this.object = obj;
        this.incRefCount();
    }
};

/**
 * Class implementing reference counting cache for objects accessed by a key. Reference counting is
 * separate from the stored object.
 */
class RefCountedKeyCache {
	
	/**
     * Map storing the cache. They key is a look up key for the object, the value is an instance
     * of the Entry class, which wraps the object with a reference count.
     *
     * {@type <object, Entry>}
     * @private
     * */
	cache = new Map();

    /**
     * Destroy all stored objects.
     */
    destroy() {
        this.cache.forEach((entry) => {
            entry.object?.destroy();
        });
        this.cache.clear();
    }

    /**
     * Clear the cache, without destroying the objects.
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Get the object from the cache with the given key, while incrementing the reference count. If
     * the object is not in the cache, returns null.
     * 
     * @param {object} key - The key to look up the object.
     * @returns {object} The object, or null if not found.
     */
	get(key) {
        const entry = this.cache.get(key);
        if (entry) {
            entry.incRefCount();
            return entry.object;
        }
        return null;
    }

    /**
     * Put the object in the cache with the given key. The object cannot be in the cache already.
     * This sets its reference count to 1.
     *
     * @param {object} key - The key to store the object under.
     * @param {object} object - The object to store.
     */
    set(key, object) {
        Debug.assert(!this.cache.has(key), `RefCountedKeyCache: Trying to put object with key that already exists in the cache`, { key, object });
        this.cache.set(key, new Entry(object));
    }

    /**
     * Remove the object reference from the cache with the given key. If the reference count reaches
     * zero, the object is destroyed.
     *
     * @param {object} key - The key to remove the object under.
     */
	release(key) {
        const entry = this.cache.get(key);
        if (entry) {
            entry.decRefCount();

            // last reference removed, destroy the object
            if (entry.refCount === 0) {
                this.cache.delete(key); // remove the entry from the cache
                entry.object?.destroy(); // destroy the object
            }
        } else {
            Debug.warn(`RefCountedKeyCache: Trying to release object that is not in the cache`, { key });
        }
	}
};

export { RefCountedKeyCache };

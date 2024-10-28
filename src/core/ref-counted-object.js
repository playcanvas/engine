/**
 * Base class that implements reference counting for objects.
 */
class RefCountedObject {
    /**
     * @type {number}
     * @private
     */
    _refCount = 0;

    /**
     * Increments the reference counter.
     */
    incRefCount() {
        this._refCount++;
    }

    /**
     * Decrements the reference counter.
     */
    decRefCount() {
        this._refCount--;
    }

    /**
     * Gets the current reference count.
     *
     * @type {number}
     */
    get refCount() {
        return this._refCount;
    }
}

export { RefCountedObject };

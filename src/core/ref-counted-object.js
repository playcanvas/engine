/**
 * Base class implementing reference counting for objects.
 *
 * @ignore
 */
class RefCountedObject {
    /**
     * @type {number}
     * @private
     */
    _refCount = 0;

    /**
     * Inrements the counter.
     */
    incRefCount() {
        this._refCount++;
    }

    /**
     * Decrements the counter. When the value reaches zero, destroy is called.
     */
    decRefCount() {
        this._refCount--;
    }

    /**
     * The current reference count.
     *
     * @type {number}
     */
    get refCount() {
        return this._refCount;
    }
}

export { RefCountedObject };

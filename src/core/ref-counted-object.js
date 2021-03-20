// base class implementing reference counting for objects
class RefCountedObject {
    constructor() {
        // counter
        this._refCount = 0;
    }

    // inrements the counter
    incRefCount() {
        this._refCount++;
    }

    // decrements the counter. When the value reaches zero, destroy is called
    decRefCount() {
        this._refCount--;
    }

    // returns current count
    getRefCount() {
        return this._refCount;
    }
}

export { RefCountedObject };

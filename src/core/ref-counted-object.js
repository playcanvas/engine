// base class for reference counted objects
class RefCountedObject {
    constructor(autoDestroy = true) {
        // counter
        this._refCount = 0;

        // true if the object should be destroyed when refcount reaches zero
        this._refAutoDestroy = autoDestroy;
    }

    // inrements the counter
    incRefCount() {
        this._refCount++;
    }

    // decrements the counter. When the value reaches zero, destroy is called
    decRefCount() {
        if (--this._refCount === 0) {
            if (this._refAutoDestroy) {
                this.destroy();
            }
        }
    }

    // returns current count
    getRefCount() {
        return this._refCount;
    }

    // default version of destroy functionality
    destroy() {
        // #ifdef DEBUG
        console.error("Class extended from the RefCountedObject class needs to have a destroy function implemented.");
        // #endif
    }
}

export { RefCountedObject };

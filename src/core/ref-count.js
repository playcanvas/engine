// base class for reference counted objects
class RefCount {
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
        if (--this._refCount === 0) {
            this.destroy();
        }
    }

    // returns current count
    getRefCount() {
        return this._refCount;
    }

    // default version of destroy functionality
    destroy() {
        // #ifdef DEBUG
        console.error("Class extended from the RefCount class needs to have a destroy function implemented.");
        // #endif
    }
}

export { RefCount };

/**
 * A pool of reusable objects of the same type. Designed to promote reuse of objects to reduce
 * garbage collection.
 *
 * @ignore
 */
class ObjectPool {
    /**
     * The constructor function for the objects in the pool.
     *
     * @type {new (...args: any[]) => any}
     * @private
     */
    _constructor;

    /**
     * Array of object instances.
     *
     * @type {object[]}
     * @private
     */
    _pool = [];

    /**
     * The number of object instances that are currently allocated.
     *
     * @type {number}
     * @private
     */
    _count = 0;

    /**
     * @param {new (...args: any[]) => any} constructorFunc - The constructor function for the
     * objects in the pool.
     * @param {number} size - The initial number of object instances to allocate.
     */
    constructor(constructorFunc, size) {
        this._constructor = constructorFunc;

        this._resize(size);
    }

    /**
     * @param {number} size - The number of object instances to allocate.
     * @private
     */
    _resize(size) {
        if (size > this._pool.length) {
            for (let i = this._pool.length; i < size; i++) {
                this._pool[i] = new this._constructor();
            }
        }
    }

    /**
     * Returns an object instance from the pool. If no instances are available, the pool will be
     * doubled in size and a new instance will be returned.
     *
     * @returns {object} An object instance from the pool.
     */
    allocate() {
        if (this._count >= this._pool.length) {
            this._resize(this._pool.length * 2);
        }
        return this._pool[this._count++];
    }

    /**
     * All object instances in the pool will be available again. The pool itself will not be
     * resized.
     */
    freeAll() {
        this._count = 0;
    }
}

export { ObjectPool };

/**
 * A pool of reusable objects of the same type. Designed to promote reuse of objects to reduce
 * garbage collection.
 *
 * @template {new (...args: any[]) => any} T
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
     * @type {InstanceType<T>[]}
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
     * A map from object references to their index in `_pool`. This is used to determine
     * whether an object is actually allocated from this pool (and at which index).
     *
     * @type {WeakMap<InstanceType<T>, number>}
     * @private
     */
    _objToIndexMap = new WeakMap();

    /**
     * @param {T} constructorFunc - The constructor function for the
     * objects in the pool.
     * @param {number} size - The initial number of object instances to allocate.
     */
    constructor(constructorFunc, size) {
        this._constructor = constructorFunc;

        this._resize(size);
    }

    /**
     * Returns an object instance from the pool. If no instances are available, the pool will be
     * doubled in size and a new instance will be returned.
     *
     * @returns {InstanceType<T>} An object instance from the pool.
     */
    allocate() {
        if (this._count >= this._pool.length) {
            this._resize(Math.max(1, this._pool.length * 2));
        }
        return this._pool[this._count++];
    }

    /**
     * Attempts to free the given object back into the pool. This only works if the object
     * was previously allocated (i.e. it exists in `_objToIndexMap`) and is still in use
     * (i.e., its index is below `_count`).
     *
     * @param {InstanceType<T>} obj - The object instance to be freed back into the pool.
     * @returns {boolean} Whether freeing succeeded.
     */
    free(obj) {
        const index = this._objToIndexMap.get(obj);
        if (index === undefined) {
            return false;
        }

        if (index >= this._count) {
            return false;
        }

        // Swap this object with the last allocated object, then decrement `_count`
        const lastIndex = this._count - 1;
        const lastObj = this._pool[lastIndex];

        this._pool[index] = lastObj;
        this._pool[lastIndex] = obj;

        this._objToIndexMap.set(lastObj, index);
        this._objToIndexMap.set(obj, lastIndex);

        this._count -= 1;
        return true;
    }

    /**
     * All object instances in the pool will be available again. The pool itself will not be
     * resized.
     */
    freeAll() {
        this._count = 0;
    }

    /**
     * @param {number} size - The number of object instances to allocate.
     * @private
     */
    _resize(size) {
        if (size > this._pool.length) {
            for (let i = this._pool.length; i < size; i++) {
                const obj = new this._constructor();
                this._pool[i] = obj;

                this._objToIndexMap.set(obj, i);
            }
        }
    }
}

export { ObjectPool };

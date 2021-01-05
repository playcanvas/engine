class AllocatePool {
    constructor(constructorFunc, size) {
        this._constructor = constructorFunc;
        this._pool = [];
        this._count = 0;

        this._resize(size);
    }

    _resize(size) {
        if (size > this._pool.length) {
            for (var i = this._pool.length; i < size; i++) {
                this._pool[i] = new this._constructor();
            }
        }
    }

    allocate() {
        if (this._count >= this._pool.length) {
            this._resize(this._pool.length * 2);
        }
        return this._pool[this._count++];
    }

    freeAll() {
        this._count = 0;
    }
}

export { AllocatePool };

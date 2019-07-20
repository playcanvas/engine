Object.assign(pc, (function () {
    var AllocatePool = function (constructor, size) {
        this._constructor = constructor;
        this._pool = [];
        this._count = 0;

        this._resize(size);
    };

    Object.assign(AllocatePool.prototype, {
        _resize: function (size) {
            if (size > this._pool.length) {
                for (var i = this._pool.length; i < size; i++) {
                    this._pool[i] = new this._constructor();
                }
            }
        },

        allocate: function () {
            if (this._count >= this._pool.length) {
                this._resize(this._pool.length * 2);
            }
            return this._pool[this._count++];
        },

        freeAll: function () {
            this._count = 0;
        }
    });

    return {
        AllocatePool: AllocatePool
    };
}()));

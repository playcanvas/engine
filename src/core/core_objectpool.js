pc.extend(pc, (function () {
    /**
    * @private
    * @name pc.ObjectPool
    * @class A pool of objects that can be reused to avoid excessive heap allocations. The pool
    * allocates new objects or returns existing unused objects for re-use. The user must explicitely
    * call pool.allocate and pool.free to allocate / free objects.
    * @constructor Create a new ObjectPool
    * @param {Function} constructor The constructor or create method for the objects we want to create
    * ( e.g. ObjectPool(pc.vec3.create) or ObjectPool(SomeCtor))
    * @param {Object} options Options for the pool:
    * <ul>
    * <li>{string} name The name of the pool</li>
    * <li>{Boolean} metrics Record various metrics like total allocated objects and used objects</li>
    * <li>Boolean} useNew Set to true if you want to use 'new' when allocating objects or 'false' if you just want to apply the constructor</li>
    * </ul>
    * @example
    * To create a pool of objects of type MyObject:
    * var pool = new ObjectPool(MyObject, {
    *   name: "my pool"
    * })
    *
    * To create a pool of vec3's:
    * var pool = new ObjectPool(pc.Vec3, {
    *   name: "my pool",
    *   useNew: false
    * })
    *
    * Then to create a new object for example a vec3:
    * var myVector = pool.allocate(x, y, z);
    *
    * To free an allocated object:
    * pool.free(myVector);
    */
    var ObjectPool = function (constructor, options) {
        this.objects = [];
        this.ctor = constructor;
        this.name = options.name;
        this.useNew = options.useNew === undefined || options.useNew;
        this.metrics = options.metrics;
        if (options.metrics) {
            this.total = 0;
            this.used = 0;
        }
    };

    ObjectPool.prototype = {

        _construct: function(constructor, args) {
            function F() {
                return constructor.apply(this, args);
            };

            F.prototype = constructor.prototype;

            return new F();
        },

        allocate: function () {
            var object;
            if (this.objects.length) {
                object = this.objects.pop();
                this.ctor.apply(object, arguments);

                if( this.metrics ) {
                    this.used++;
                }

            } else {
                if( this.useNew ) {
                    object = this._construct(this.ctor, arguments);
                } else {
                    object = this.ctor.apply(this, arguments);
                }

                if( this.metrics ) {
                    this.total++;
                    this.used++;
                }
            }

            return object;
        },

        free: function(object) {
            this.objects.push(object);

            if (this.metrics) {
                this.used--;
            }

            if( object.onFree ) {
                object.onFree();
            }


        },

        usage: function () {
            return pc.string.format("{0} - total: {1}, used: {2}", this.name, this.total, this.used);
        }
    };


    var AllocatePool = function (constructor, size) {
        this._constructor = constructor;
        this._pool = [];
        this._count = 0;

        this._resize(size);
    };

    AllocatePool.prototype = {
        _resize: function (size) {
            if (size > this._pool.length) {
                for (var i = this._pool.length; i < size; i++) {
                    this._pool[i] = new this._constructor();
                }
            }
        },

        allocate: function () {
            if (this._count >= this._pool.length) {
                this._resize(this._pool.length*2);
            }
            return this._pool[this._count++];
        },

        freeAll: function () {
            this._count = 0;
        }
    }

    return {
        AllocatePool: AllocatePool,
        ObjectPool: ObjectPool
    };

}()));

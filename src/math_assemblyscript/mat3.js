var mat3_add             = assemblyscript.instance.exports["Mat3#add"];
// var mat3_add2         = assemblyscript.instance.exports["Mat3#add2"];
var mat3_clone           = assemblyscript.instance.exports["Mat3#clone"];
var mat3_constructor     = assemblyscript.instance.exports["Mat3#constructor"];
var mat3_copy            = assemblyscript.instance.exports["Mat3#copy"];
var mat3_equals          = assemblyscript.instance.exports["Mat3#equals"];
var mat3_isIdentity      = assemblyscript.instance.exports["Mat3#isIdentity"];
var mat3_setIdentity     = assemblyscript.instance.exports["Mat3#setIdentity"];
var mat3_transpose       = assemblyscript.instance.exports["Mat3#transpose"];
// var mat3_mul2         = assemblyscript.instance.exports["Mat3#mul2"];
// var mat3_mul          = assemblyscript.instance.exports["Mat3#mul"];

/**
 * @class
 */

function Mat3() {
    this.ptr = mat3_constructor(0);
    // if (assemblyscript.module.tlfs) {
    //    this.bufferByteLength = 0;
    // } else {
    this.assignDataView();
    // }
}

Mat3.wrap = function (ptr) {
    var tmp = Object.create(Mat3.prototype);
    tmp.ptr = ptr;
    // if (assemblyscript.module.tlfs) {
    //     tmp.bufferByteLength = 0;
    // } else {
    this.assignDataView();
    // }
    return tmp;
};

Mat3.prototype.assignDataView = function () {
    // #ifdef X32
    this.data = new Float32Array(assemblyscript.module.memory.buffer, this.ptr, 9);
    // #endif

    // #ifdef X64
    this.data = new Float64Array(assemblyscript.module.memory.buffer, this.ptr, 9);
    // #endif
};

Mat3.prototype.add = function (rhs) {
    mat3_add(this.ptr, rhs.ptr);
    return this;
};

Mat3.prototype.add2 = function (lhs, rhs) {
    mat3_add(this.ptr, lhs.ptr, rhs.ptr);
    return this;
};

Mat3.prototype.clone = function () {
    var ptr = mat3_clone(this.ptr);
    var tmp = Mat3.wrap(ptr);
    return tmp;
};

Mat3.prototype.copy = function (rhs) {
    mat3_copy(this.ptr, rhs.ptr);
    return this;
};

Mat3.prototype.set = function (src) {
    var dst = this.data;

    dst[0] = src[0];
    dst[1] = src[1];
    dst[2] = src[2];
    dst[3] = src[3];
    dst[4] = src[4];
    dst[5] = src[5];
    dst[6] = src[6];
    dst[7] = src[7];
    dst[8] = src[8];

    return this;
};

Mat3.prototype.equals = function (rhs) {
    return !!mat3_equals(this.ptr, rhs.ptr);
};

Mat3.prototype.isIdentity = function () {
    return !!mat3_isIdentity(this.ptr);
};

Mat3.prototype.setIdentity = function () {
    mat3_setIdentity(this.ptr);
    return this;
};

Mat3.prototype.transpose = function () {
    mat3_transpose(this.ptr);
    return this;
};

Mat3.prototype.toString = function () {
    var t = '[';
    for (var i = 0; i < 9; i++) {
        t += this.data[i];
        t += (i !== 8) ? ', ' : '';
    }
    t += ']';
    return t;
};

Mat3.prototype.toStringFixed = function (n) {
    var t = '[';
    for (var i = 0; i < 9; i++) {
        t += this.data[i].toFixed(n);
        t += (i !== 8) ? ', ' : '';
    }
    t += ']';
    return t;
};

// Useful for: TLSF allocator.
// But currently I use the Arena allocator, because it's faster.
// I simply preallocate 300mb and update the dataviews *never*.
// Object.defineProperty(Mat3.prototype, 'data', {
//     get: function () {
//         if (this.bufferByteLength != assemblyscript.module.memory.buffer.byteLength) {
//             // Recreate dataview when the wasm arraybuffer changed size.
//             // Needed because dataviews become invalid when original arraybuffer resizes.
//             // I cache them because recreating dataviews for 64 animated models costs like 5ms per frame.
//             this.cachedDataView = new Float32Array(assemblyscript.module.memory.buffer, this.ptr, 9);
//             this.bufferByteLength = assemblyscript.module.memory.buffer.byteLength;
//             //console.log("recreate dataview for ", this);
//         }
//         return this.cachedDataView;
//     }
// });

Object.defineProperty(Mat3, 'IDENTITY', {
    get: function () {
        var identity = new Mat3();
        return function () {
            return identity;
        };
    }()
});

Object.defineProperty(Mat3, 'ZERO', {
    get: function () {
        var zero = new Mat3().set([0, 0, 0, 0, 0, 0, 0, 0, 0]);
        return function () {
            return zero;
        };
    }()
});

export { Mat3 };

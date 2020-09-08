import { Vec3 } from "./vec3";

var mat4_add                = assemblyscript.instance.exports["Mat4#add"];
var mat4_add2               = assemblyscript.instance.exports["Mat4#add2"];
var mat4_clone              = assemblyscript.instance.exports["Mat4#clone"];
var mat4_constructor        = assemblyscript.instance.exports["Mat4#constructor"];
var mat4_copy               = assemblyscript.instance.exports["Mat4#copy"];
var mat4_equals             = assemblyscript.instance.exports["Mat4#equals"];
var mat4_getEulerAngles     = assemblyscript.instance.exports["Mat4#getEulerAngles"];
var mat4_getScale           = assemblyscript.instance.exports["Mat4#getScale"];
var mat4_getTranslation     = assemblyscript.instance.exports["Mat4#getTranslation"];
var mat4_getX               = assemblyscript.instance.exports["Mat4#getX"];
var mat4_getY               = assemblyscript.instance.exports["Mat4#getY"];
var mat4_getZ               = assemblyscript.instance.exports["Mat4#getZ"];
var mat4_invert             = assemblyscript.instance.exports["Mat4#invert"];
var mat4_invertTo3x3        = assemblyscript.instance.exports["Mat4#invertTo3x3"];
var mat4_isIdentity         = assemblyscript.instance.exports["Mat4#isIdentity"];
var mat4_mul                = assemblyscript.instance.exports["Mat4#mul"];
var mat4_mul2               = assemblyscript.instance.exports["Mat4#mul2"];
var mat4_mulAffine2         = assemblyscript.instance.exports["Mat4#mulAffine2"];
var mat4_setFromAxisAngle   = assemblyscript.instance.exports["Mat4#setFromAxisAngle"];
var mat4_setFromEulerAngles = assemblyscript.instance.exports["Mat4#setFromEulerAngles"];
var mat4_setFrustum         = assemblyscript.instance.exports["Mat4#setFrustum"];
var mat4_setIdentity        = assemblyscript.instance.exports["Mat4#setIdentity"];
var mat4_setLookAt          = assemblyscript.instance.exports["Mat4#setLookAt"];
var mat4_setOrtho           = assemblyscript.instance.exports["Mat4#setOrtho"];
var mat4_setPerspective     = assemblyscript.instance.exports["Mat4#setPerspective"];
var mat4_setScale           = assemblyscript.instance.exports["Mat4#setScale"];
var mat4_setTRS             = assemblyscript.instance.exports["Mat4#setTRS"];
var mat4_setTranslate       = assemblyscript.instance.exports["Mat4#setTranslate"];
var mat4_transformPoint     = assemblyscript.instance.exports["Mat4#transformPoint"];
var mat4_transformVec4      = assemblyscript.instance.exports["Mat4#transformVec4"];
var mat4_transformVector    = assemblyscript.instance.exports["Mat4#transformVector"];
var mat4_transpose          = assemblyscript.instance.exports["Mat4#transpose"];

/**
 * @class
 */

function Mat4() {
    this.ptr = mat4_constructor(0);
    // if (assemblyscript.module.tlfs) {
    //    this.bufferByteLength = 0;
    // } else {
    this.assignDataView();
    // }
}

Mat4.wrap = function (ptr) {
    var tmp = Object.create(Mat4.prototype);
    tmp.ptr = ptr;
    // if (tlfs) {
    //    tmp.bufferByteLength = 0;
    // } else {
    tmp.assignDataView();
    // }
    return tmp;
};

Mat4.prototype.assignDataView = function () {
    // #ifdef X32
    this.data = new Float32Array(assemblyscript.module.memory.buffer, this.ptr, 16);
    // #endif

    // #ifdef X64
    this.data = new Float64Array(assemblyscript.module.memory.buffer, this.ptr, 16);
    // #endif
};

Mat4.prototype.add = function (rhs) {
    mat4_add(this.ptr, rhs.ptr);
    return this;
};

Mat4.prototype.add2 = function (lhs, rhs) {
    mat4_add2(this.ptr, lhs.ptr, rhs.ptr);
    return this;
};

Mat4.prototype.clone = function () {
    var ptr = mat4_clone(this.ptr);
    var tmp = Mat4.wrap(ptr);
    return tmp;
};

Mat4.prototype.copy = function (rhs) {
    mat4_copy(this.ptr, rhs.ptr);
    return this;
};

Mat4.prototype.equals = function (rhs) {
    return !!mat4_equals(this.ptr, rhs.ptr);
};

Mat4.prototype.getEulerAngles = function (eulers) {
    if (eulers === undefined) {
        eulers = new Vec3();
    }
    mat4_getEulerAngles(this.ptr, eulers.ptr);
    return eulers;
};

Mat4.prototype.getScale = function (scale) {
    if (scale === undefined) {
        scale = new Vec3();
    }
    mat4_getScale(this.ptr, scale.ptr);
    return scale;
};

Mat4.prototype.getTranslation = function (t) {
    if (t === undefined) {
        t = new Vec3();
    }
    mat4_getTranslation(this.ptr, t.ptr);
    return t;
};

Mat4.prototype.getX = function (x) {
    if (x === undefined) {
        x = new Vec3();
    }
    mat4_getX(this.ptr, x.ptr);
    return x;
};

Mat4.prototype.getY = function (y) {
    if (y === undefined) {
        y = new Vec3();
    }
    mat4_getY(this.ptr, y.ptr);
    return y;
};

Mat4.prototype.getZ = function (z) {
    if (z === undefined) {
        z = new Vec3();
    }
    mat4_getZ(this.ptr, z.ptr);
    return z;
};

Mat4.prototype.invert = function () {
    mat4_invert(this.ptr);
    return this;
};

Mat4.prototype.invertTo3x3 = function (mat3) {
    mat4_invertTo3x3(this.ptr, mat3.ptr);
    return this;
};

Mat4.prototype.isIdentity = function () {
    return !!mat4_isIdentity(this.ptr);
};

Mat4.prototype.mul = function (rhs) {
    mat4_mul(this.ptr, rhs.ptr);
    return this;
};

Mat4.prototype.mul2 = function (lhs, rhs) {
    mat4_mul2(this.ptr, lhs.ptr, rhs.ptr);
    return this;
};

Mat4.prototype.mulAffine2 = function (lhs, rhs) {
    mat4_mulAffine2(this.ptr, lhs.ptr, rhs.ptr);
    return this;
};

Mat4.prototype.setFromAxisAngle = function (axis, angle) {
    mat4_setFromAxisAngle(this.ptr, axis.ptr, angle);
    return this;
};

Mat4.prototype.setFromEulerAngles = function (ex, ey, ez) {
    mat4_setFromEulerAngles(this.ptr, ex, ey, ez);
    return this;
};

Mat4.prototype.setFrustum = function (left, right, bottom, top, znear, zfar) {
    mat4_setFrustum(this.ptr, left, right, bottom, top, znear, zfar);
    return this;
};

Mat4.prototype.setIdentity = function () {
    mat4_setIdentity(this.ptr);
    return this;
};

Mat4.prototype.setLookAt = function (position, target, up) {
    mat4_setLookAt(this.ptr, position.ptr, target.ptr, up.ptr);
    return this;
};

Mat4.prototype.setOrtho = function (left, right, bottom, top, near, far) {
    mat4_setOrtho(this.ptr, left, right, bottom, top, near, far);
    return this;
};

Mat4.prototype.setPerspective = function (fov, aspect, znear, zfar, fovIsHorizontal) {
    mat4_setPerspective(this.ptr, fov, aspect, znear, zfar, fovIsHorizontal);
    return this;
};

Mat4.prototype.setScale = function (x, y, z) {
    mat4_setScale(this.ptr, x, y, z);
    return this;
};

Mat4.prototype.setTRS = function (t, r, s) {
    mat4_setTRS(this.ptr, t.ptr, r.ptr, s.ptr);
    return this;
};

Mat4.prototype.setTranslate = function (x, y, z) {
    mat4_setTranslate(this.ptr, x, y, z);
    return this;
};

Mat4.prototype.transformPoint = function (vec, res) {
    if (res === undefined) {
        res = new Vec3();
    }
    mat4_transformPoint(this.ptr, vec.ptr, res.ptr);
    return res;
};

Mat4.prototype.transformVec4 = function (vec, res) {
    if (res === undefined) {
        res = new Vec3();
    }
    mat4_transformVec4(this.ptr, vec.ptr, res.ptr);
    return res;
};

Mat4.prototype.transformVector = function (vec, res) {
    if (res === undefined) {
        res = new Vec3();
    }
    mat4_transformVector(this.ptr, vec.ptr, res.ptr);
    return res;
};

Mat4.prototype.transpose = function () {
    mat4_transpose(this.ptr);
    return this;
};

Mat4.prototype.set = function (src) {
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
    dst[9] = src[9];
    dst[10] = src[10];
    dst[11] = src[11];
    dst[12] = src[12];
    dst[13] = src[13];
    dst[14] = src[14];
    dst[15] = src[15];
    return this;
};

Mat4.prototype.toString = function () {
    var i, t;
    t = '[';
    for (i = 0; i < 16; i += 1) {
        t += this.data[i];
        t += (i !== 15) ? ', ' : '';
    }
    t += ']';
    return t;
};

Mat4.prototype.toStringFixed = function (n) {
    var i, t;
    t = '[';
    for (i = 0; i < 16; i += 1) {
        t += this.data[i].toFixed(n);
        t += (i !== 15) ? ', ' : '';
    }
    t += ']';
    return t;
};

// Useful for: TLSF allocator.
// But currently I use the Arena allocator, because it's faster.
// I simply preallocate 300mb and update the dataviews *never*.
// Object.defineProperty(Mat4.prototype, 'data', {
//     get: function () {
//         if (this.bufferByteLength != assemblyscript.module.memory.buffer.byteLength) {
//             // Recreate dataview when the wasm arraybuffer changed size.
//             // Needed because dataviews become invalid when original arraybuffer resizes.
//             // I cache them because recreating dataviews for 64 animated models costs like 5ms per frame.
//             this.cachedDataView = new Float32Array(assemblyscript.module.memory.buffer, this.ptr, 16);
//             this.bufferByteLength = assemblyscript.module.memory.buffer.byteLength;
//             //console.log("recreate dataview for ", this);
//         }
//         return this.cachedDataView;
//     }
// });

Object.defineProperty(Mat4, 'IDENTITY', {
    get: (function () {
        var identity = new Mat4();
        return function () {
            return identity;
        };
    }())
});

Object.defineProperty(Mat4, 'ONE', {
    get: (function () {
        var zero = new Mat4().set([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
        return function () {
            return zero;
        };
    }())
});

Object.defineProperty(Mat4, 'ZERO', {
    get: (function () {
        var zero = new Mat4().set([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        return function () {
            return zero;
        };
    }())
});

export { Mat4 };

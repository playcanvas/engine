
import { Mat3 as Mat3_AS } from "../../assembly/Mat3";

class Mat3 extends Mat3_AS {
    constructor() {
        super();
        console.log("HELLO FROM Mat3 AS JS")
    }

    set(src: any) {
        this.m0 = src[0];
        this.m1 = src[1];
        this.m2 = src[2];
        this.m3 = src[3];
        this.m4 = src[4];
        this.m5 = src[5];
        this.m6 = src[6];
        this.m7 = src[7];
        this.m8 = src[8];
        return this;
    }
}

//Mat3.prototype.add = function (rhs) {
//    mat3_add(this.ptr, rhs.ptr);
//    return this;
//};
//
//Mat3.prototype.add2 = function (lhs, rhs) {
//    mat3_add(this.ptr, lhs.ptr, rhs.ptr);
//    return this;
//};
//
//Mat3.prototype.clone = function () {
//    var ptr = mat3_clone(this.ptr);
//    var tmp = Mat3.wrap(ptr);
//    return tmp;
//};
//
//Mat3.prototype.copy = function (rhs) {
//    mat3_copy(this.ptr, rhs.ptr);
//    return this;
//};
//
//
//Mat3.prototype.equals = function (rhs) {
//    return !!mat3_equals(this.ptr, rhs.ptr);
//};
//
//Mat3.prototype.isIdentity = function () {
//    return !!mat3_isIdentity(this.ptr);
//};
//
//Mat3.prototype.setIdentity = function () {
//    mat3_setIdentity(this.ptr);
//    return this;
//};
//
//Mat3.prototype.transpose = function () {
//    mat3_transpose(this.ptr);
//    return this;
//};

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

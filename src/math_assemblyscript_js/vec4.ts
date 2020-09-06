
import { Vec4 as Vec4_AS } from "../../assembly/Vec4";

class Vec4 extends Vec4_AS {
    constructor(x, y, z, w) {
        if (x && x.length === 4) {
            super(
                x[0],
                x[1],
                x[2],
                x[3]
            );
        } else {
            super(
                x || 0,
                y || 0,
                z || 0,
                w || 0
            );
        }
        console.log("HELLO FROM Vec4 AS JS")
    }
}

//Vec4.prototype.add = function (rhs) {
//    vec4_add(this.ptr, rhs.ptr);
//    return this;
//};
//
//Vec4.prototype.add2 = function (lhs, rhs) {
//    vec4_add2(this.ptr, lhs.ptr, rhs.ptr);
//    return this;
//};
//
//Vec4.prototype.clone = function () {
//    var tmp = vec4_clone(this.ptr);
//    return Vec4.wrap(tmp);
//};
//
//Vec4.prototype.copy = function (rhs) {
//    vec4_copy(this.ptr, rhs.ptr);
//    return this;
//};
//
//Vec4.prototype.dot = function (rhs) {
//    return vec4_dot(this.ptr, rhs.ptr);
//};
//
//Vec4.prototype.equals = function (rhs) {
//    return !!vec4_equals(this.ptr, rhs.ptr);
//};
//
//Vec4.prototype.length = function () {
//    return vec4_length(this.ptr);
//};
//
//Vec4.prototype.lengthSq = function () {
//    return vec4_lengthSq(this.ptr);
//};
//
//Vec4.prototype.lerp = function (lhs, rhs, alpha) {
//    vec4_lerp(this.ptr, lhs.ptr, rhs.ptr, alpha);
//    return this;
//};
//
//Vec4.prototype.mul = function (rhs) {
//    vec4_mul(this.ptr, rhs.ptr);
//    return this;
//};
//
//Vec4.prototype.mul2 = function (lhs, rhs) {
//    vec4_mul2(this.ptr, lhs.ptr, rhs.ptr);
//    return this;
//};
//
//Vec4.prototype.normalize = function () {
//    vec4_normalize(this.ptr);
//    return this;
//};
//
//Vec4.prototype.scale = function (scalar) {
//    vec4_scale(this.ptr, scalar);
//    return this;
//};
//
//Vec4.prototype.set = function (x, y, z, w) {
//    vec4_set(this.ptr, x, y, z, w);
//    return this;
//};
//
//Vec4.prototype.sub = function (rhs) {
//    vec4_sub(this.ptr, rhs.ptr);
//    return this;
//};
//
//Vec4.prototype.sub2 = function (lhs, rhs) {
//    vec4_sub2(this.ptr, lhs.ptr, rhs.ptr);
//    return this;
//};

Vec4.prototype.toString = function () {
    return '[' + this.x + ', ' + this.y + ', ' + this.z + ', ' + this.w + ']';
};

Vec4.prototype.toStringFixed = function (n) {
    return '[' + this.x.toFixed(n) + ', ' + this.y.toFixed(n) + ', ' + this.z.toFixed(n) + ', ' + this.w.toFixed(n) + ']';
};

/**
 * @field
 * @static
 * @readonly
 * @type Vec4
 * @name Vec4.ONE
 * @description A constant vector set to [1, 1, 1, 1].
 */
Object.defineProperty(Vec4, 'ONE', {
    get: (function () {
        var one = new Vec4(1, 1, 1, 1);
        return function () {
            return one;
        };
    }())
});

/**
 * @field
 * @static
 * @readonly
 * @type Vec4
 * @name Vec4.ZERO
 * @description A constant vector set to [0, 0, 0, 0].
 */
Object.defineProperty(Vec4, 'ZERO', {
    get: (function () {
        var zero = new Vec4(0, 0, 0, 0);
        return function () {
            return zero;
        };
    }())
});

export { Vec4 };

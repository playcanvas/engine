
import { Vec2 as Vec2_AS } from "../../assembly/Vec2";

class Vec2 extends Vec2_AS {
    constructor(x, y) {
        if (x && x.length === 2) {
            super(
                x[0],
                x[1]
            );
        } else {
            super(
                x || 0,
                y || 0
            );
        }
        console.log("HELLO FROM Vec2 AS JS")
    }
}

//Vec2.prototype.add = function (rhs) {
//    vec2_add(this.ptr, rhs.ptr);
//    return this;
//};
//
//Vec2.prototype.add2 = function (lhs, rhs) {
//    vec2_add2(this.ptr, lhs.ptr, rhs.ptr);
//    return this;
//};
//
//Vec2.prototype.clone = function () {
//    var tmp = vec2_clone(this.ptr);
//    return Vec2.wrap(tmp);
//};
//
//Vec2.prototype.copy = function (rhs) {
//    vec2_copy(this.ptr, rhs.ptr);
//    return this;
//};
//
//Vec2.prototype.dot = function (rhs) {
//    return vec2_dot(this.ptr, rhs.ptr);
//};
//
//Vec2.prototype.equals = function (rhs) {
//    return !!vec2_equals(this.ptr, rhs.ptr);
//};
//
//Vec2.prototype.length = function () {
//    return vec2_length(this.ptr);
//};
//
//Vec2.prototype.lengthSq = function () {
//    return vec2_lengthSq(this.ptr);
//};
//
//Vec2.prototype.lerp = function (lhs, rhs, alpha) {
//    vec2_lerp(this.ptr, lhs.ptr, rhs.ptr, alpha);
//    return this;
//};
//
//Vec2.prototype.mul = function (rhs) {
//    vec2_mul(this.ptr, rhs.ptr);
//    return this;
//};
//
//Vec2.prototype.mul2 = function (lhs, rhs) {
//    vec2_mul2(this.ptr, lhs.ptr, rhs.ptr);
//    return this;
//};
//
//Vec2.prototype.normalize = function () {
//    vec2_normalize(this.ptr);
//    return this;
//};
//
//Vec2.prototype.scale = function (scalar) {
//    vec2_scale(this.ptr, scalar);
//    return this;
//};
//
//Vec2.prototype.set = function (x, y) {
//    vec2_set(this.ptr, x, y);
//    return this;
//};
//
//Vec2.prototype.sub = function (rhs) {
//    vec2_sub(this.ptr, rhs.ptr);
//    return this;
//};
//
//Vec2.prototype.sub2 = function (lhs, rhs) {
//    vec2_sub2(this.ptr, lhs.ptr, rhs.ptr);
//    return this;
//};

Vec2.prototype.toString = function () {
    return '[' + this.x + ', ' + this.y + ']';
};

Vec2.prototype.toStringFixed = function (n) {
    return '[' + this.x.toFixed(n) + ', ' + this.y.toFixed(n) + ']';
};

Object.defineProperty(Vec2, 'ONE', {
    get: (function () {
        var tmp = new Vec2(1, 1);
        return function () {
            return tmp;
        };
    }())
});

Object.defineProperty(Vec2, 'LEFT', {
    get: (function () {
        var tmp = new Vec2(-1, 0);
        return function () {
            return tmp;
        };
    }())
});

Object.defineProperty(Vec2, 'RIGHT', {
    get: (function () {
        var tmp = new Vec2(1, 0);
        return function () {
            return tmp;
        };
    }())
});

Object.defineProperty(Vec2, 'UP', {
    get: (function () {
        var tmp = new Vec2(0, 1);
        return function () {
            return tmp;
        };
    }())
});

Object.defineProperty(Vec2, 'DOWN', {
    get: (function () {
        var tmp = new Vec2(0, -1);
        return function () {
            return tmp;
        };
    }())
});

Object.defineProperty(Vec2, 'ZERO', {
    get: (function () {
        var tmp = new Vec2(0, 0);
        return function () {
            return tmp;
        };
    }())
});

export { Vec2 };

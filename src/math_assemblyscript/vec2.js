var vec2_add          = assemblyscript.instance.exports["Vec2#add"];
var vec2_add2         = assemblyscript.instance.exports["Vec2#add2"];
var vec2_clone        = assemblyscript.instance.exports["Vec2#clone"];
var vec2_constructor  = assemblyscript.instance.exports["Vec2#constructor"];
var vec2_copy         = assemblyscript.instance.exports["Vec2#copy"];
var vec2_dot          = assemblyscript.instance.exports["Vec2#dot"];
var vec2_equals       = assemblyscript.instance.exports["Vec2#equals"];
var vec2_length       = assemblyscript.instance.exports["Vec2#length"];
var vec2_lengthSq     = assemblyscript.instance.exports["Vec2#lengthSq"];
var vec2_lerp         = assemblyscript.instance.exports["Vec2#lerp"];
var vec2_mul          = assemblyscript.instance.exports["Vec2#mul"];
var vec2_mul2         = assemblyscript.instance.exports["Vec2#mul2"];
var vec2_normalize    = assemblyscript.instance.exports["Vec2#normalize"];
var vec2_scale        = assemblyscript.instance.exports["Vec2#scale"];
var vec2_set          = assemblyscript.instance.exports["Vec2#set"];
var vec2_sub          = assemblyscript.instance.exports["Vec2#sub"];
var vec2_sub2         = assemblyscript.instance.exports["Vec2#sub2"];

/**
 * @class
 */

function Vec2(x, y) {
    if (x && x.length === 2) {
        this.ptr = vec2_constructor(0,
            x[0],
            x[1]
        );
    } else {
        this.ptr = vec2_constructor(0,
            x || 0,
            y || 0
        );
    }
}

Vec2.wrap = function (ptr) {
    var tmp = Object.create(Vec2.prototype);
    tmp.ptr = ptr;
    return tmp;
};

Vec2.prototype.add = function (rhs) {
    vec2_add(this.ptr, rhs.ptr);
    return this;
};

Vec2.prototype.add2 = function (lhs, rhs) {
    vec2_add2(this.ptr, lhs.ptr, rhs.ptr);
    return this;
};

Vec2.prototype.clone = function () {
    var tmp = vec2_clone(this.ptr);
    return Vec2.wrap(tmp);
};

Vec2.prototype.copy = function (rhs) {
    vec2_copy(this.ptr, rhs.ptr);
    return this;
};

Vec2.prototype.dot = function (rhs) {
    return vec2_dot(this.ptr, rhs.ptr);
};

Vec2.prototype.equals = function (rhs) {
    return !!vec2_equals(this.ptr, rhs.ptr);
};

Vec2.prototype.length = function () {
    return vec2_length(this.ptr);
};

Vec2.prototype.lengthSq = function () {
    return vec2_lengthSq(this.ptr);
};

Vec2.prototype.lerp = function (lhs, rhs, alpha) {
    vec2_lerp(this.ptr, lhs.ptr, rhs.ptr, alpha);
    return this;
};

Vec2.prototype.mul = function (rhs) {
    vec2_mul(this.ptr, rhs.ptr);
    return this;
};

Vec2.prototype.mul2 = function (lhs, rhs) {
    vec2_mul2(this.ptr, lhs.ptr, rhs.ptr);
    return this;
};

Vec2.prototype.normalize = function () {
    vec2_normalize(this.ptr);
    return this;
};

Vec2.prototype.scale = function (scalar) {
    vec2_scale(this.ptr, scalar);
    return this;
};

Vec2.prototype.set = function (x, y) {
    vec2_set(this.ptr, x, y);
    return this;
};

Vec2.prototype.sub = function (rhs) {
    vec2_sub(this.ptr, rhs.ptr);
    return this;
};

Vec2.prototype.sub2 = function (lhs, rhs) {
    vec2_sub2(this.ptr, lhs.ptr, rhs.ptr);
    return this;
};

Vec2.prototype.toString = function () {
    return '[' + this.x + ', ' + this.y + ']';
};

Vec2.prototype.toStringFixed = function (n) {
    return '[' + this.x.toFixed(n) + ', ' + this.y.toFixed(n) + ']';
};

Object.defineProperty(Vec2.prototype, 'x', {
    get: function () {
        return assemblyscript.module.F32[this.ptr >> 2]; // the shifting is same as dividing by 4, used to quickly lookup the value in assemblyscript.module.F32
    },
    set: function (newValue) {
        assemblyscript.module.F32[this.ptr >> 2] = newValue;
    }
});

Object.defineProperty(Vec2.prototype, 'y', {
    get: function () {
        return assemblyscript.module.F32[(this.ptr >> 2) + 1];
    },
    set: function (newValue) {
        assemblyscript.module.F32[(this.ptr >> 2) + 1] = newValue;
    }
});

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

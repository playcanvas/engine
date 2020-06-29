var vec4_add             = assemblyscript.instance.exports["Vec4#add"];
var vec4_add2            = assemblyscript.instance.exports["Vec4#add2"];
var vec4_clone           = assemblyscript.instance.exports["Vec4#clone"];
var vec4_constructor     = assemblyscript.instance.exports["Vec4#constructor"];
var vec4_copy            = assemblyscript.instance.exports["Vec4#copy"];
// var vec4_cross        = assemblyscript.instance.exports["Vec4#cross"];
var vec4_dot             = assemblyscript.instance.exports["Vec4#dot"];
var vec4_equals          = assemblyscript.instance.exports["Vec4#equals"];
var vec4_length          = assemblyscript.instance.exports["Vec4#length"];
var vec4_lengthSq        = assemblyscript.instance.exports["Vec4#lengthSq"];
var vec4_lerp            = assemblyscript.instance.exports["Vec4#lerp"];
var vec4_mul             = assemblyscript.instance.exports["Vec4#mul"];
var vec4_mul2            = assemblyscript.instance.exports["Vec4#mul2"];
var vec4_normalize       = assemblyscript.instance.exports["Vec4#normalize"];
// var vec4_project      = assemblyscript.instance.exports["Vec4#project"];
var vec4_scale           = assemblyscript.instance.exports["Vec4#scale"];
var vec4_set             = assemblyscript.instance.exports["Vec4#set"];
var vec4_sub             = assemblyscript.instance.exports["Vec4#sub"];
var vec4_sub2            = assemblyscript.instance.exports["Vec4#sub2"];

/**
 * @class
 */

function Vec4(x, y, z, w) {
    if (x && x.length === 4) {
        this.ptr = vec4_constructor(0,
            x[0],
            x[1],
            x[2],
            x[3]
        );
    } else {
        this.ptr = vec4_constructor(0,
            x || 0,
            y || 0,
            z || 0,
            w || 0
        );
    }
}

Vec4.wrap = function (ptr) {
    var tmp = Object.create(Vec4.prototype);
    tmp.ptr = ptr;
    return tmp;
};

Vec4.prototype.add = function (rhs) {
    vec4_add(this.ptr, rhs.ptr);
    return this;
};

Vec4.prototype.add2 = function (lhs, rhs) {
    vec4_add2(this.ptr, lhs.ptr, rhs.ptr);
    return this;
};

Vec4.prototype.clone = function () {
    var tmp = vec4_clone(this.ptr);
    return Vec4.wrap(tmp);
};

Vec4.prototype.copy = function (rhs) {
    vec4_copy(this.ptr, rhs.ptr);
    return this;
};

Vec4.prototype.dot = function (rhs) {
    return vec4_dot(this.ptr, rhs.ptr);
};

Vec4.prototype.equals = function (rhs) {
    return !!vec4_equals(this.ptr, rhs.ptr);
};

Vec4.prototype.length = function () {
    return vec4_length(this.ptr);
};

Vec4.prototype.lengthSq = function () {
    return vec4_lengthSq(this.ptr);
};

Vec4.prototype.lerp = function (lhs, rhs, alpha) {
    vec4_lerp(this.ptr, lhs.ptr, rhs.ptr, alpha);
    return this;
};

Vec4.prototype.mul = function (rhs) {
    vec4_mul(this.ptr, rhs.ptr);
    return this;
};

Vec4.prototype.mul2 = function (lhs, rhs) {
    vec4_mul2(this.ptr, lhs.ptr, rhs.ptr);
    return this;
};

Vec4.prototype.normalize = function () {
    vec4_normalize(this.ptr);
    return this;
};

Vec4.prototype.scale = function (scalar) {
    vec4_scale(this.ptr, scalar);
    return this;
};

Vec4.prototype.set = function (x, y, z, w) {
    vec4_set(this.ptr, x, y, z, w);
    return this;
};

Vec4.prototype.sub = function (rhs) {
    vec4_sub(this.ptr, rhs.ptr);
    return this;
};

Vec4.prototype.sub2 = function (lhs, rhs) {
    vec4_sub2(this.ptr, lhs.ptr, rhs.ptr);
    return this;
};

Vec4.prototype.toString = function () {
    return '[' + this.x + ', ' + this.y + ', ' + this.z + ', ' + this.w + ']';
};

Vec4.prototype.toStringFixed = function (n) {
    return '[' + this.x.toFixed(n) + ', ' + this.y.toFixed(n) + ', ' + this.z.toFixed(n) + ', ' + this.w.toFixed(n) + ']';
};

Object.defineProperty(Vec4.prototype, 'x', {
    get: function () {
        return assemblyscript.module.F32[this.ptr >> 2]; // the shifting is same as dividing by 4, used to quickly lookup the value in assemblyscript.module.F32
    },
    set: function (newValue) {
        assemblyscript.module.F32[this.ptr >> 2] = newValue;
    }
});

Object.defineProperty(Vec4.prototype, 'y', {
    get: function () {
        return assemblyscript.module.F32[(this.ptr >> 2) + 1];
    },
    set: function (newValue) {
        assemblyscript.module.F32[(this.ptr >> 2) + 1] = newValue;
    }
});

Object.defineProperty(Vec4.prototype, 'z', {
    get: function () {
        return assemblyscript.module.F32[(this.ptr >> 2) + 2];
    },
    set: function (newValue) {
        assemblyscript.module.F32[(this.ptr >> 2) + 2] = newValue;
    }
});

Object.defineProperty(Vec4.prototype, 'w', {
    get: function () {
        return assemblyscript.module.F32[(this.ptr >> 2) + 3];
    },
    set: function (newValue) {
        assemblyscript.module.F32[(this.ptr >> 2) + 3] = newValue;
    }
});


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

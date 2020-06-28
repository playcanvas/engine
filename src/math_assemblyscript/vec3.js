var vec3_add          = instance.exports["Vec3#add"];
var vec3_add2         = instance.exports["Vec3#add2"];
var vec3_clone        = instance.exports["Vec3#clone"];
var vec3_constructor  = instance.exports["Vec3#constructor"];
var vec3_copy         = instance.exports["Vec3#copy"];
var vec3_cross        = instance.exports["Vec3#cross"];
var vec3_dot          = instance.exports["Vec3#dot"];
var vec3_equals       = instance.exports["Vec3#equals"];
var vec3_length       = instance.exports["Vec3#length"];
var vec3_lengthSq     = instance.exports["Vec3#lengthSq"];
var vec3_lerp         = instance.exports["Vec3#lerp"];
var vec3_mul          = instance.exports["Vec3#mul"];
var vec3_mul2         = instance.exports["Vec3#mul2"];
var vec3_normalize    = instance.exports["Vec3#normalize"];
var vec3_project      = instance.exports["Vec3#project"];
var vec3_scale        = instance.exports["Vec3#scale"];
var vec3_set          = instance.exports["Vec3#set"];
var vec3_sub          = instance.exports["Vec3#sub"];
var vec3_sub2         = instance.exports["Vec3#sub2"];

/**
 * @class
 */

function Vec3(x, y, z) {
    if (x && x.length === 3) {
        this.ptr = vec3_constructor(0, x[0], x[1], x[2]);
    } else {
        this.ptr = vec3_constructor(0, x || 0, y || 0, z || 0);
    }
}

Vec3.wrap = function (ptr) {
    var tmp = Object.create(Vec3.prototype);
    tmp.ptr = ptr;
    return tmp;
};

Vec3.prototype.add = function (rhs) {
    vec3_add(this.ptr, rhs.ptr);
    return this;
};

Vec3.prototype.add2 = function (lhs, rhs) {
    vec3_add2(this.ptr, lhs.ptr, rhs.ptr);
    return this;
};

Vec3.prototype.clone = function () {
    var tmp = vec3_clone(this.ptr);
    return Vec3.wrap(tmp);
};

Vec3.prototype.copy = function (rhs) {
    vec3_copy(this.ptr, rhs.ptr);
    return this;
};

Vec3.prototype.cross = function (lhs, rhs) {
    vec3_cross(this.ptr, lhs.ptr, rhs.ptr);
    return this;
};

Vec3.prototype.dot = function (rhs) {
    return vec3_dot(this.ptr, rhs.ptr);
};

Vec3.prototype.equals = function (rhs) {
    return !!vec3_equals(this.ptr, rhs.ptr);
};

Vec3.prototype.length = function () {
    return vec3_length(this.ptr);
};

Vec3.prototype.lengthSq = function () {
    return vec3_lengthSq(this.ptr);
};

Vec3.prototype.lerp = function (lhs, rhs, alpha) {
    vec3_lerp(this.ptr, lhs.ptr, rhs.ptr, alpha);
    return this;
};

Vec3.prototype.mul = function (rhs) {
    vec3_mul(this.ptr, rhs.ptr);
    return this;
};

Vec3.prototype.mul2 = function (lhs, rhs) {
    vec3_mul2(this.ptr, lhs.ptr, rhs.ptr);
    return this;
};

Vec3.prototype.normalize = function () {
    vec3_normalize(this.ptr);
    return this;
};

Vec3.prototype.project = function (rhs) {
    vec3_project(this.ptr, rhs.ptr);
    return this;
};

Vec3.prototype.scale = function (scalar) {
    vec3_scale(this.ptr, scalar);
    return this;
};

Vec3.prototype.set = function (x, y, z) {
    vec3_set(this.ptr, x, y, z);
    return this;
};

Vec3.prototype.sub = function (rhs) {
    vec3_sub(this.ptr, rhs.ptr);
    return this;
};

Vec3.prototype.sub2 = function (lhs, rhs) {
    vec3_sub2(this.ptr, lhs.ptr, rhs.ptr);
    return this;
};

Vec3.prototype.toString = function () {
    return '[' + this.x + ', ' + this.y + ', ' + this.z + ']';
};

Vec3.prototype.toStringFixed = function (n) {
    return '[' + this.x.toFixed(n) + ', ' + this.y.toFixed(n) + ', ' + this.z.toFixed(n) + ']';
};

Object.defineProperty(Vec3.prototype, 'x', {
    get: function () {
        return module.F32[this.ptr >> 2]; // the shifting is same as dividing by 4, used to quickly lookup the value in module.F32
    },
    set: function (newValue) {
        module.F32[this.ptr >> 2] = newValue;
    }
});

Object.defineProperty(Vec3.prototype, 'y', {
    get: function () {
        return module.F32[(this.ptr >> 2) + 1];
    },
    set: function (newValue) {
        module.F32[(this.ptr >> 2) + 1] = newValue;
    }
});

Object.defineProperty(Vec3.prototype, 'z', {
    get: function () {
        return module.F32[(this.ptr >> 2) + 2];
    },
    set: function (newValue) {
        module.F32[(this.ptr >> 2) + 2] = newValue;
    }
});


/**
 * @static
 * @readonly
 * @type Vec3
 * @name Vec3.BACK
 * @description A constant vector set to [0, 0, 1].
 */
Object.defineProperty(Vec3, 'BACK', {
    get: (function () {
        var back = new Vec3(0, 0, 1);
        return function () {
            return back;
        };
    }())
});

/**
 * @static
 * @readonly
 * @type Vec3
 * @name Vec3.DOWN
 * @description A constant vector set to [0, -1, 0].
 */
Object.defineProperty(Vec3, 'DOWN', {
    get: (function () {
        var down = new Vec3(0, -1, 0);
        return function () {
            return down;
        };
    }())
});

/**
 * @static
 * @readonly
 * @type Vec3
 * @name Vec3.FORWARD
 * @description A constant vector set to [0, 0, -1].
 */
Object.defineProperty(Vec3, 'FORWARD', {
    get: (function () {
        var forward = new Vec3(0, 0, -1);
        return function () {
            return forward;
        };
    }())
});

/**
 * @field
 * @static
 * @readonly
 * @type Vec3
 * @name Vec3.LEFT
 * @description A constant vector set to [-1, 0, 0].
 */
Object.defineProperty(Vec3, 'LEFT', {
    get: (function () {
        var left = new Vec3(-1, 0, 0);
        return function () {
            return left;
        };
    }())
});

/**
 * @field
 * @static
 * @readonly
 * @type Vec3
 * @name Vec3.ONE
 * @description A constant vector set to [1, 1, 1].
 */
Object.defineProperty(Vec3, 'ONE', {
    get: (function () {
        var one = new Vec3(1, 1, 1);
        return function () {
            return one;
        };
    }())
});

/**
 * @field
 * @static
 * @readonly
 * @type Vec3
 * @name Vec3.RIGHT
 * @description A constant vector set to [1, 0, 0].
 */
Object.defineProperty(Vec3, 'RIGHT', {
    get: (function () {
        var right = new Vec3(1, 0, 0);
        return function () {
            return right;
        };
    }())
});

/**
 * @field
 * @static
 * @readonly
 * @type Vec3
 * @name Vec3.UP
 * @description A constant vector set to [0, 1, 0].
 */
Object.defineProperty(Vec3, 'UP', {
    get: (function () {
        var down = new Vec3(0, 1, 0);
        return function () {
            return down;
        };
    }())
});

/**
 * @field
 * @static
 * @readonly
 * @type Vec3
 * @name Vec3.ZERO
 * @description A constant vector set to [0, 0, 0].
 */
Object.defineProperty(Vec3, 'ZERO', {
    get: (function () {
        var zero = new Vec3(0, 0, 0);
        return function () {
            return zero;
        };
    }())
});

export { Vec3 };

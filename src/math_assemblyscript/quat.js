import { Vec3 } from "./vec3";

var quat_clone              = assemblyscript.instance.exports["Quat#clone"];
var quat_conjugate          = assemblyscript.instance.exports["Quat#conjugate"];
var quat_constructor        = assemblyscript.instance.exports["Quat#constructor"];
var quat_copy               = assemblyscript.instance.exports["Quat#copy"];
var quat_equals             = assemblyscript.instance.exports["Quat#equals"];
var quat_getAxisAngle       = assemblyscript.instance.exports["Quat#getAxisAngle"];
var quat_getEulerAngles     = assemblyscript.instance.exports["Quat#getEulerAngles"];
var quat_invert             = assemblyscript.instance.exports["Quat#invert"];
var quat_length             = assemblyscript.instance.exports["Quat#length"];
var quat_lengthSq           = assemblyscript.instance.exports["Quat#lengthSq"];
var quat_mul                = assemblyscript.instance.exports["Quat#mul"];
var quat_mul2               = assemblyscript.instance.exports["Quat#mul2"];
var quat_normalize          = assemblyscript.instance.exports["Quat#normalize"];
var quat_set                = assemblyscript.instance.exports["Quat#set"];
var quat_setFromAxisAngle   = assemblyscript.instance.exports["Quat#setFromAxisAngle"];
var quat_setFromEulerAngles = assemblyscript.instance.exports["Quat#setFromEulerAngles"];
var quat_setFromMat4        = assemblyscript.instance.exports["Quat#setFromMat4"];
var quat_slerp              = assemblyscript.instance.exports["Quat#slerp"];
var quat_transformVector    = assemblyscript.instance.exports["Quat#transformVector"];

/**
 * @class
 */

function Quat(x, y, z, w) {
    if (x && x.length === 4) {
        this.ptr = quat_constructor(0,
            x[0],
            x[1],
            x[2],
            x[3]
        );
    } else {
        this.ptr = quat_constructor(0,
            (x === undefined) ? 0 : x,
            (y === undefined) ? 0 : y,
            (z === undefined) ? 0 : z,
            (w === undefined) ? 1 : w
        );
    }
}

Quat.wrap = function (ptr) {
    var tmp = Object.create(Quat.prototype);
    tmp.ptr = ptr;
    return tmp;
};

Quat.prototype.clone = function () {
    var tmp = quat_clone(this.ptr);
    return Quat.wrap(tmp);
};

Quat.prototype.conjugate = function () {
    quat_conjugate(this.ptr);
    return this;
};

Quat.prototype.copy = function (rhs) {
    quat_copy(this.ptr, rhs.ptr);
    return this;
};

Quat.prototype.equals = function (rhs) {
    return !!quat_equals(this.ptr, rhs.ptr);
};

/**
 * @param {Vec3} axis - output vector
 */

Quat.prototype.getAxisAngle = function (axis) {
    return quat_getAxisAngle(this.ptr, axis.ptr);
};

Quat.prototype.getEulerAngles = function (eulers) {
    eulers = (eulers === undefined) ? new Vec3() : eulers;
    quat_getEulerAngles(this.ptr, eulers.ptr);
    return this;
};

Quat.prototype.invert = function () {
    quat_invert(this.ptr);
    return this;
};

Quat.prototype.length = function () {
    return quat_length(this.ptr);
};

Quat.prototype.lengthSq = function () {
    return quat_lengthSq(this.ptr);
};

Quat.prototype.mul = function (rhs) {
    quat_mul(this.ptr, rhs.ptr);
    return this;
};

Quat.prototype.mul2 = function (lhs, rhs) {
    quat_mul2(this.ptr, lhs.ptr, rhs.ptr);
    return this;
};

Quat.prototype.normalize = function () {
    quat_normalize(this.ptr);
    return this;
};

Quat.prototype.set = function (x, y, z, w) {
    quat_set(this.ptr, x, y, z, w);
    return this;
};

Quat.prototype.setFromAxisAngle = function (axis, angle) {
    quat_setFromAxisAngle(this.ptr, axis.ptr, angle);
    return this;
};

Quat.prototype.setFromEulerAngles = function (ex, ey, ez) {
    quat_setFromEulerAngles(this.ptr, ex, ey, ez);
    return this;
};

Quat.prototype.setFromMat4 = function (mat4) {
    quat_setFromMat4(this.ptr, mat4.ptr);
    return this;
};

Quat.prototype.slerp = function (lhs, rhs, alpha) {
    quat_slerp(this.ptr, lhs.ptr, rhs.ptr, alpha);
    return this;
};

Quat.prototype.transformVector = function (vec, res) {
    if (res === undefined) {
        res = new Vec3();
    }
    quat_transformVector(this.ptr, vec.ptr, res.ptr);
    return res;
};

Quat.prototype.toString = function () {
    return '[' + this.x + ', ' + this.y + ', ' + this.z + ', ' + this.w + ']';
};

Quat.prototype.toStringFixed = function (n) {
    return '[' + this.x.toFixed(n) + ', ' + this.y.toFixed(n) + ', ' + this.z.toFixed(n) + ', ' + this.w.toFixed(n) + ']';
};

Object.defineProperty(Quat.prototype, 'x', {
    get: function () {
        return assemblyscript.module.F32[this.ptr >> 2]; // the shifting is same as dividing by 4, used to quickly lookup the value in assemblyscript.module.F32
    },
    set: function (newValue) {
        assemblyscript.module.F32[this.ptr >> 2] = newValue;
    }
});

Object.defineProperty(Quat.prototype, 'y', {
    get: function () {
        return assemblyscript.module.F32[(this.ptr >> 2) + 1];
    },
    set: function (newValue) {
        assemblyscript.module.F32[(this.ptr >> 2) + 1] = newValue;
    }
});

Object.defineProperty(Quat.prototype, 'z', {
    get: function () {
        return assemblyscript.module.F32[(this.ptr >> 2) + 2];
    },
    set: function (newValue) {
        assemblyscript.module.F32[(this.ptr >> 2) + 2] = newValue;
    }
});

Object.defineProperty(Quat.prototype, 'w', {
    get: function () {
        return assemblyscript.module.F32[(this.ptr >> 2) + 3];
    },
    set: function (newValue) {
        assemblyscript.module.F32[(this.ptr >> 2) + 3] = newValue;
    }
});

Object.defineProperty(Quat, 'IDENTITY', {
    get: (function () {
        var identity = new Quat();
        return function () {
            return identity;
        };
    }())
});

Object.defineProperty(Quat, 'ZERO', {
    get: (function () {
        var zero = new Quat(0, 0, 0, 0);
        return function () {
            return zero;
        };
    }())
});

export { Quat };

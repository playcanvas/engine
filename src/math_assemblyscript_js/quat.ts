import { Vec3 } from "./vec3";

import { Quat as Quat_AS } from "../../assembly/Quat";

class Quat extends Quat_AS {
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
                (x === undefined) ? 0 : x,
                (y === undefined) ? 0 : y,
                (z === undefined) ? 0 : z,
                (w === undefined) ? 1 : w
            );
        }
    }

    getEulerAngles(eulers) {
        if (eulers === undefined) {
            eulers = new Vec3();
        }
        return Quat_AS.prototype.getEulerAngles.call(this, eulers);
    }

    transformVector(vec, res) {
        if (res === undefined) {
            res = new Vec3();
        }
        return Quat_AS.prototype.transformVector.call(this, vec, res);
    }
}


Quat.prototype.toString = function () {
    return '[' + this.x + ', ' + this.y + ', ' + this.z + ', ' + this.w + ']';
};

Quat.prototype.toStringFixed = function (n) {
    return '[' + this.x.toFixed(n) + ', ' + this.y.toFixed(n) + ', ' + this.z.toFixed(n) + ', ' + this.w.toFixed(n) + ']';
};

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

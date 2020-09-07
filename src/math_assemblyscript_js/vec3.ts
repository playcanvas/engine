
import { Vec3 as Vec3_AS } from "../../assembly/Vec3";

class Vec3 extends Vec3_AS {
    constructor(x, y, z) {
        if (x && x.length === 3) {
            super(
                x[0],
                x[1],
                x[2]
            );
        } else {
            super(
                x || 0,
                y || 0,
                z || 0
            );
        }
    }
}

Vec3.prototype.toString = function () {
    return '[' + this.x + ', ' + this.y + ', ' + this.z + ']';
};

Vec3.prototype.toStringFixed = function (n) {
    return '[' + this.x.toFixed(n) + ', ' + this.y.toFixed(n) + ', ' + this.z.toFixed(n) + ']';
};

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

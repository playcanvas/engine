
import { Vec4 as Vec4_AS } from "../../assembly/math/vec4";

class Vec4 extends Vec4_AS {
    constructor(x?: any, y?: any, z?: any, w?: any) {
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
    }

    toString () {
        return '[' + this.x + ', ' + this.y + ', ' + this.z + ', ' + this.w + ']';
    }

    toStringFixed(n) {
        return '[' + this.x.toFixed(n) + ', ' + this.y.toFixed(n) + ', ' + this.z.toFixed(n) + ', ' + this.w.toFixed(n) + ']';
    }
}

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

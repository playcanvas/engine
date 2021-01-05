
import { Vec2 as Vec2_AS } from "../../assembly/math/vec2";

class Vec2 extends Vec2_AS {
    constructor(x?: any, y?: any) {
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
    }

    toString() {
        return '[' + this.x + ', ' + this.y + ']';
    }
    
    toStringFixed(n) {
        return '[' + this.x.toFixed(n) + ', ' + this.y.toFixed(n) + ']';
    }
}

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

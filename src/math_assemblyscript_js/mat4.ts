import { Vec3 } from "./vec3";

import { Mat4 as Mat4_AS } from "../../assembly/Mat4";

class Mat4 extends Mat4_AS {
    constructor() {
        super();
    }

    getEulerAngles(eulers) {
        if (eulers === undefined) {
            eulers = new Vec3();
        }
        return Mat4_AS.prototype.getEulerAngles.call(this, eulers);
    }
    
    getScale(scale) {
        if (scale === undefined) {
            scale = new Vec3();
        }
        return Mat4_AS.prototype.getScale.call(this, scale);
    }
    
    getTranslation(t) {
        if (t === undefined) {
            t = new Vec3();
        }
        return Mat4_AS.prototype.getTranslation.call(this, t);
    }

    getX(x) {
        if (x === undefined) {
            x = new Vec3();
        }
        return Mat4_AS.prototype.getX.call(this, x);
    }

    getY(y) {
        if (y === undefined) {
            y = new Vec3();
        }
        return Mat4_AS.prototype.getY.call(this, y);
    }

    getZ(z) {
        if (z === undefined) {
            z = new Vec3();
        }
        return Mat4_AS.prototype.getZ.call(this, z);
    }

    transformPoint(vec, res) {
        if (res === undefined) {
            res = new Vec3();
        }
        return Mat4_AS.prototype.transformPoint.call(this, vec, res);
    }

    transformVec4(vec, res) {
        if (res === undefined) {
            res = new Vec3();
        }
        return Mat4_AS.prototype.transformVec4.call(this, vec, res);
    }

    transformVector(vec, res) {
        if (res === undefined) {
            res = new Vec3();
        }
        return Mat4_AS.prototype.transformVector.call(this, vec, res);
    };

    set(src: any) {
        this.m0 = src[0];
        this.m1 = src[1];
        this.m2 = src[2];
        this.m3 = src[3];
        this.m4 = src[4];
        this.m5 = src[5];
        this.m6 = src[6];
        this.m7 = src[7];
        this.m8 = src[8];
        this.m9 = src[9];
        this.m10 = src[10];
        this.m11 = src[11];
        this.m12 = src[12];
        this.m13 = src[13];
        this.m14 = src[14];
        this.m15 = src[15];
        return this;
    }
}

Object.defineProperty(Mat4.prototype, 'data', {
    get: function () {
        return new Proxy(this, {
            get: function(target, p) {
                if (typeof p === "symbol") {
                    return function*() {
                        yield target.m0;
                        yield target.m1;
                        yield target.m2;
                        yield target.m3;
                        yield target.m4;
                        yield target.m5;
                        yield target.m6;
                        yield target.m7;
                        yield target.m8;
                        yield target.m9;
                        yield target.m10;
                        yield target.m11;
                        yield target.m12;
                        yield target.m13;
                        yield target.m14;
                        yield target.m15;
                    }
                } else {
                    try {
                        switch (parseInt(p)) {
                            case 0: return target.m0;
                            case 1: return target.m1;
                            case 2: return target.m2;
                            case 3: return target.m3;
                            case 4: return target.m4;
                            case 5: return target.m5;
                            case 6: return target.m6;
                            case 7: return target.m7;
                            case 8: return target.m8;
                            case 9: return target.m9;
                            case 10: return target.m10;
                            case 11: return target.m11;
                            case 12: return target.m12;
                            case 13: return target.m13;
                            case 14: return target.m14;
                            case 15: return target.m15;
                        } 
                    } catch (e) {
                        console.log("e", e, "p", p)
                    }
                }   
                return 0;
            },
            set: function(target, p, value) {
                switch (parseInt(p)) {
                    case 0:
                        target.m0 = value;
                        break;
                    case 1:
                        target.m1 = value;
                        break;
                    case 2:
                        target.m2 = value;
                        break;
                    case 3:
                        target.m3 = value;
                        break;
                    case 4:
                        target.m4 = value;
                        break;
                    case 5:
                        target.m5 = value;
                        break;
                    case 6:
                        target.m6 = value;
                        break;
                    case 7:
                        target.m7 = value;
                        break;
                    case 8:
                        target.m8 = value;
                        break;
                    case 9:
                        target.m9 = value;
                        break;
                    case 10:
                        target.m10 = value;
                        break;
                    case 11:
                        target.m11 = value;
                        break;
                    case 12:
                        target.m12 = value;
                        break;
                    case 13:
                        target.m13 = value;
                        break;
                    case 14:
                        target.m14 = value;
                        break;
                    case 15:
                        target.m15 = value;
                        break;
                }
                return true;
            }
        });
    }
});

Mat4.prototype.toString = function () {
    var i, t;
    t = '[';
    for (i = 0; i < 16; i += 1) {
        t += this.data[i];
        t += (i !== 15) ? ', ' : '';
    }
    t += ']';
    return t;
};

Mat4.prototype.toStringFixed = function (n) {
    var i, t;
    t = '[';
    for (i = 0; i < 16; i += 1) {
        t += this.data[i].toFixed(n);
        t += (i !== 15) ? ', ' : '';
    }
    t += ']';
    return t;
};

Object.defineProperty(Mat4, 'IDENTITY', {
    get: (function () {
        var identity = new Mat4();
        return function () {
            return identity;
        };
    }())
});

Object.defineProperty(Mat4, 'ONE', {
    get: (function () {
        var zero = new Mat4().set([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
        return function () {
            return zero;
        };
    }())
});

Object.defineProperty(Mat4, 'ZERO', {
    get: (function () {
        var zero = new Mat4().set([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        return function () {
            return zero;
        };
    }())
});

export { Mat4 };

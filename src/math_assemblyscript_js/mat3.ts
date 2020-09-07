
import { Mat3 as Mat3_AS } from "../../assembly/Mat3";

class Mat3 extends Mat3_AS {
    constructor() {
        super();
    }

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
        return this;
    }
}

Mat3.prototype.toString = function () {
    var t = '[';
    for (var i = 0; i < 9; i++) {
        t += this.data[i];
        t += (i !== 8) ? ', ' : '';
    }
    t += ']';
    return t;
};

Mat3.prototype.toStringFixed = function (n) {
    var t = '[';
    for (var i = 0; i < 9; i++) {
        t += this.data[i].toFixed(n);
        t += (i !== 8) ? ', ' : '';
    }
    t += ']';
    return t;
};

Object.defineProperty(Mat3.prototype, 'data', {
    get: function () {
        return new Proxy(this, {
            get: function(target, p) {
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
                }
                return true;
            }
        });
    }
});

Object.defineProperty(Mat3, 'IDENTITY', {
    get: function () {
        var identity = new Mat3();
        return function () {
            return identity;
        };
    }()
});

Object.defineProperty(Mat3, 'ZERO', {
    get: function () {
        var zero = new Mat3().set([0, 0, 0, 0, 0, 0, 0, 0, 0]);
        return function () {
            return zero;
        };
    }()
});

export { Mat3 };

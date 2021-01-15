import { math } from '../../math/math.js';

import { INTERPOLATION_CUBIC, INTERPOLATION_LINEAR, INTERPOLATION_STEP } from '../constants.js';

/**
 * @private
 * @class
 * @name pc.AnimCache
 * @classdesc Internal cache data for the evaluation of a single curve timeline.
 * @description Create a new animation cache.
 */
class AnimCache {
    constructor() {
        // these members are calculated per-segment
        this._left = Infinity;      // time of left knot
        this._right = -Infinity;    // time of right knot
        this._len = 0;              // distance between current knots
        this._recip = 0;            // reciprocal len
        this._p0 = 0;               // index of the left knot
        this._p1 = 0;               // index of the right knot

        // these members are calculated per-time evaluation
        this._t = 0;                // normalized time
        this._hermite = {           // hermite weights, calculated on demand
            valid: false,
            p0: 0,
            m0: 0,
            p1: 0,
            m1: 0
        };
    }

    update(time, input) {
        if (time < this._left || time >= this._right) {
            // recalculate knots
            var len = input.length;
            if (!len) {
                // curve is empty
                this._left = -Infinity;
                this._right = Infinity;
                this._len = 0;
                this._recip = 0;
                this._p0 = this._p1 = 0;
            } else {
                if (time < input[0]) {
                    // time falls before the first key
                    this._left = -Infinity;
                    this._right = input[0];
                    this._len = 0;
                    this._recip = 0;
                    this._p0 = this._p1 = 0;
                } else if (time >= input[len - 1]) {
                    // time falls after the last key
                    this._left = input[len - 1];
                    this._right = Infinity;
                    this._len = 0;
                    this._recip = 0;
                    this._p0 = this._p1 = len - 1;
                } else {
                    // time falls within the bounds of the curve
                    var index = this._findKey(time, input);
                    this._left = input[index];
                    this._right = input[index + 1];
                    this._len = this._right - this._left;
                    var diff = 1.0 / this._len;
                    this._recip = (isFinite(diff) ? diff : 0);
                    this._p0 = index;
                    this._p1 = index + 1;
                }
            }
        }

        // calculate normalized time
        this._t = (this._recip === 0) ? 0 : ((time - this._left) * this._recip);
        this._hermite.valid = false;
    }

    _findKey(time, input) {
        // TODO: start the search around the currently selected knots
        var index = 0;
        while (time >= input[index + 1]) {
            index++;
        }
        return index;
    }

    // evaluate the output anim data at the current time
    eval(result, interpolation, output) {
        var data = output._data;
        var comp = output._components;
        var idx0 = this._p0 * comp;
        var i;

        if (interpolation === INTERPOLATION_STEP) {
            for (i = 0; i < comp; ++i) {
                result[i] = data[idx0 + i];
            }
        } else {
            var t = this._t;
            var idx1 = this._p1 * comp;

            switch (interpolation) {
                case INTERPOLATION_LINEAR:
                    for (i = 0; i < comp; ++i) {
                        result[i] = math.lerp(data[idx0 + i], data[idx1 + i], t);
                    }
                    break;

                case INTERPOLATION_CUBIC:
                    var hermite = this._hermite;

                    if (!hermite.valid) {
                        // cache hermite weights
                        var t2 = t * t;
                        var twot = t + t;
                        var omt = 1 - t;
                        var omt2 = omt * omt;

                        hermite.valid = true;
                        hermite.p0 = (1 + twot) * omt2;
                        hermite.m0 = t * omt2;
                        hermite.p1 = t2 * (3 - twot);
                        hermite.m1 = t2 * (t - 1);
                    }

                    var p0 = (this._p0 * 3 + 1) * comp;     // point at k
                    var m0 = (this._p0 * 3 + 2) * comp;     // out-tangent at k
                    var p1 = (this._p1 * 3 + 1) * comp;     // point at k + 1
                    var m1 = (this._p1 * 3 + 0) * comp;     // in-tangent at k + 1

                    for (i = 0; i < comp; ++i) {
                        result[i] = hermite.p0 * data[p0 + i] +
                                    hermite.m0 * data[m0 + i] * this._len +
                                    hermite.p1 * data[p1 + i] +
                                    hermite.m1 * data[m1 + i] * this._len;
                    }
                    break;
            }
        }
    }
}

export { AnimCache };

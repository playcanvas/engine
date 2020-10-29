import { extend } from '../core/core.js';

import { CURVE_SMOOTHSTEP } from './constants.js';
import { CurveEvaluator } from './curve-evaluator.js';

/**
 * @class
 * @name pc.Curve
 * @classdesc A curve is a collection of keys (time/value pairs). The shape of the
 * curve is defined by its type that specifies an interpolation scheme for the keys.
 * @description Creates a new curve.
 * @param {number[]} [data] - An array of keys (pairs of numbers with the time first and
 * value second).
 * @property {number} length The number of keys in the curve. [read only].
 * @property {number} type The curve interpolation scheme. Can be:
 *
 * * {@link pc.CURVE_LINEAR}
 * * {@link pc.CURVE_SMOOTHSTEP}
 * * {@link pc.CURVE_SPLINE}
 * * {@link pc.CURVE_STEP}
 *
 * Defaults to {@link pc.CURVE_SMOOTHSTEP}.
 * @property {number} tension The tension used when type is CURVE_SPLINE.
 *
 * @example
 * var curve = new pc.Curve([
 *     [0, 0],
 *     [0.33, 2],
 *     [0.66, 2.6],
 *     [1, 3]
 * ]);
 */
function Curve(data) {
    this.keys = [];
    this.type = CURVE_SMOOTHSTEP;
    this.tension = 0.5;                     // used for CURVE_SPLINE
    this._eval = new CurveEvaluator(this);

    if (data) {
        for (var i = 0; i < data.length - 1; i += 2) {
            this.keys.push([data[i], data[i + 1]]);
        }
    }

    this.sort();
}

Object.assign(Curve.prototype, {
    /**
     * @function
     * @name pc.Curve#add
     * @description Add a new key to the curve.
     * @param {number} time - Time to add new key.
     * @param {number} value - Value of new key.
     * @returns {number[]} [time, value] pair.
     */
    add: function (time, value) {
        var keys = this.keys;
        var len = keys.length;
        var i = 0;

        for (; i < len; i++) {
            if (keys[i][0] > time) {
                break;
            }
        }

        var key = [time, value];
        this.keys.splice(i, 0, key);
        return key;
    },

    /**
     * @function
     * @name pc.Curve#get
     * @description Return a specific key.
     * @param {number} index - The index of the key to return.
     * @returns {number[]} The key at the specified index.
     */
    get: function (index) {
        return this.keys[index];
    },

    /**
     * @function
     * @name pc.Curve#sort
     * @description Sort keys by time.
     */
    sort: function () {
        this.keys.sort(function (a, b) {
            return a[0] - b[0];
        });
    },

    /**
     * @function
     * @name pc.Curve#value
     * @description Returns the interpolated value of the curve at specified time.
     * @param {number} time - The time at which to calculate the value.
     * @returns {number} The interpolated value.
     */
    value: function (time) {
        // we for the evaluation because keys may have changed since the last evaluate
        // (we can't know)
        return this._eval.evaluate(time, true);
    },

    closest: function (time) {
        var keys = this.keys;
        var length = keys.length;
        var min = 2;
        var result = null;

        for (var i = 0; i < length; i++) {
            var diff = Math.abs(time - keys[i][0]);
            if (min >= diff) {
                min = diff;
                result = keys[i];
            } else {
                break;
            }
        }

        return result;
    },

    /**
     * @function
     * @name pc.Curve#clone
     * @description Returns a clone of the specified curve object.
     * @returns {pc.Curve} A clone of the specified curve.
     */
    clone: function () {
        var result = new Curve();
        result.keys = extend(result.keys, this.keys);
        result.type = this.type;
        result.tension = this.tension;
        return result;
    },

    /**
     * @private
     * @function
     * @name pc.Curve#quantize
     * @description Sample the curve at regular intervals over the range [0..1].
     * @param {number} precision - The number of samples to return.
     * @returns {Float32Array} The set of quantized values.
     */
    quantize: function (precision) {
        precision = Math.max(precision, 2);

        var values = new Float32Array(precision);
        var step = 1.0 / (precision - 1);

        // quantize graph to table of interpolated values
        values[0] = this._eval.evaluate(0, true);
        for (var i = 1; i < precision; i++) {
            values[i] = this._eval.evaluate(step * i);
        }

        return values;
    },

    /**
     * @private
     * @function
     * @name pc.Curve#quantizeClamped
     * @description Sample the curve at regular intervals over the range [0..1]
     * and clamp the resulting samples to [min..max].
     * @param {number} precision - The number of samples to return.
     * @param {number} min - The minimum output value.
     * @param {number} max - The maximum output value.
     * @returns {Float32Array} The set of quantized values.
     */
    quantizeClamped: function (precision, min, max) {
        var result = this.quantize(precision);
        for (var i = 0; i < result.length; ++i) {
            result[i] = Math.min(max, Math.max(min, result[i]));
        }
        return result;
    }
});

Object.defineProperty(Curve.prototype, 'length', {
    get: function () {
        return this.keys.length;
    }
});

export { Curve };

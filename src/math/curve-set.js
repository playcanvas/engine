import { type } from '../core/core.js';

import { CURVE_SMOOTHSTEP } from './constants.js';
import { Curve } from './curve.js';
import { CurveEvaluator } from './curve-evaluator.js';

/**
 * @class
 * @name pc.CurveSet
 * @classdesc A curve set is a collection of curves.
 * @description Creates a new curve set.
 * @param {Array<number[]>} [curveKeys] - An array of arrays of keys (pairs of numbers with
 * the time first and value second).
 */
function CurveSet() {
    var i;

    this.curves = [];
    this._type = CURVE_SMOOTHSTEP;

    if (arguments.length > 1) {
        for (i = 0; i < arguments.length; i++) {
            this.curves.push(new Curve(arguments[i]));
        }
    } else {
        if (arguments.length === 0) {
            this.curves.push(new Curve());
        } else {
            var arg = arguments[0];
            if (type(arg) === 'number') {
                for (i = 0; i < arg; i++) {
                    this.curves.push(new Curve());
                }
            } else {
                for (i = 0; i < arg.length; i++) {
                    this.curves.push(new Curve(arg[i]));
                }
            }
        }
    }
}

Object.assign(CurveSet.prototype, {
    /**
     * @function
     * @name pc.CurveSet#get
     * @description Return a specific curve in the curve set.
     * @param {number} index - The index of the curve to return.
     * @returns {pc.Curve} The curve at the specified index.
     */
    get: function (index) {
        return this.curves[index];
    },

    /**
     * @function
     * @name pc.CurveSet#value
     * @description Returns the interpolated value of all curves in the curve
     * set at the specified time.
     * @param {number} time - The time at which to calculate the value.
     * @param {number[]} [result] - The interpolated curve values at the specified time.
     * If this parameter is not supplied, the function allocates a new array internally
     * to return the result.
     * @returns {number[]} The interpolated curve values at the specified time.
     */
    value: function (time, result) {
        var length = this.curves.length;
        result = result || [];
        result.length = length;

        for (var i = 0; i < length; i++) {
            result[i] = this.curves[i].value(time);
        }

        return result;
    },

    /**
     * @function
     * @name pc.CurveSet#clone
     * @description Returns a clone of the specified curve set object.
     * @returns {pc.CurveSet} A clone of the specified curve set.
     */
    clone: function () {
        var result = new CurveSet();

        result.curves = [];
        for (var i = 0; i < this.curves.length; i++) {
            result.curves.push(this.curves[i].clone());
        }

        result._type = this._type;

        return result;
    },

    quantize: function (precision) {
        precision = Math.max(precision, 2);

        var numCurves = this.curves.length;
        var values = new Float32Array(precision * numCurves);
        var step = 1.0 / (precision - 1);

        for (var c = 0; c < numCurves; c++) {
            var ev = new CurveEvaluator(this.curves[c]);
            for (var i = 0; i < precision; i++) { // quantize graph to table of interpolated values
                values[i * numCurves + c] = ev.evaluate(step * i);
            }
        }

        return values;
    },

    /**
     * @private
     * @function
     * @name pc.CurveSet#quantizeClamped
     * @description This function will sample the curveset at regular intervals
     * over the range [0..1] and clamp the result to min and max.
     * @param {number} precision - The number of samples to return.
     * @param {number} min - The minimum output value.
     * @param {number} max - The maximum output value.
     * @returns {number[]} The set of quantized values.
     */
    quantizeClamped: function (precision, min, max) {
        var result = this.quantize(precision);
        for (var i = 0; i < result.length; ++i) {
            result[i] = Math.min(max, Math.max(min, result[i]));
        }
        return result;
    }
});

/**
 * @readonly
 * @name pc.CurveSet#length
 * @type {number}
 * @description The number of curves in the curve set.
 */
Object.defineProperty(CurveSet.prototype, 'length', {
    get: function () {
        return this.curves.length;
    }
});

/**
 * @name pc.CurveSet#type
 * @type {number}
 * @description The interpolation scheme applied to all curves in the curve set. Can be:
 *
 * * {@link pc.CURVE_LINEAR}
 * * {@link pc.CURVE_SMOOTHSTEP}
 * * {@link pc.CURVE_SPLINE}
 * * {@link pc.CURVE_STEP}
 *
 * Defaults to {@link pc.CURVE_SMOOTHSTEP}.
 */
Object.defineProperty(CurveSet.prototype, 'type', {
    get: function () {
        return this._type;
    },

    set: function (value) {
        this._type = value;
        for (var i = 0; i < this.curves.length; i++) {
            this.curves[i].type = value;
        }
    }
});

export { CurveSet };

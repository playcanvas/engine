import { CURVE_SMOOTHSTEP } from './constants.js';
import { Curve } from './curve.js';
import { CurveEvaluator } from './curve-evaluator.js';

/**
 * @class
 * @name CurveSet
 * @classdesc A curve set is a collection of curves.
 * @description Creates a new curve set.
 * @param {Array<number[]>} curveKeys - An array of arrays of keys (pairs of numbers with
 * the time first and value second).
 * @example
 * var curveSet = new pc.CurveSet([
 *     [
 *         0, 0,        // At 0 time, value of 0
 *         0.33, 2,     // At 0.33 time, value of 2
 *         0.66, 2.6,   // At 0.66 time, value of 2.6
 *         1, 3         // At 1 time, value of 3
 *     ],
 *     [
 *         0, 34,
 *         0.33, 35,
 *         0.66, 36,
 *         1, 37
 *     ]
 * ]);
 */
class CurveSet {
    constructor() {
        this.curves = [];
        this._type = CURVE_SMOOTHSTEP;

        if (arguments.length > 1) {
            for (let i = 0; i < arguments.length; i++) {
                this.curves.push(new Curve(arguments[i]));
            }
        } else {
            if (arguments.length === 0) {
                this.curves.push(new Curve());
            } else {
                const arg = arguments[0];
                if (typeof arg === 'number') {
                    for (let i = 0; i < arg; i++) {
                        this.curves.push(new Curve());
                    }
                } else {
                    for (let i = 0; i < arg.length; i++) {
                        this.curves.push(new Curve(arg[i]));
                    }
                }
            }
        }
    }

    /**
     * @function
     * @name CurveSet#get
     * @description Return a specific curve in the curve set.
     * @param {number} index - The index of the curve to return.
     * @returns {Curve} The curve at the specified index.
     */
    get(index) {
        return this.curves[index];
    }

    /**
     * @function
     * @name CurveSet#value
     * @description Returns the interpolated value of all curves in the curve
     * set at the specified time.
     * @param {number} time - The time at which to calculate the value.
     * @param {number[]} [result] - The interpolated curve values at the specified time.
     * If this parameter is not supplied, the function allocates a new array internally
     * to return the result.
     * @returns {number[]} The interpolated curve values at the specified time.
     */
    value(time, result = []) {
        const length = this.curves.length;
        result.length = length;

        for (let i = 0; i < length; i++) {
            result[i] = this.curves[i].value(time);
        }

        return result;
    }

    /**
     * @function
     * @name CurveSet#clone
     * @description Returns a clone of the specified curve set object.
     * @returns {CurveSet} A clone of the specified curve set.
     */
    clone() {
        const result = new CurveSet();

        result.curves = [];
        for (let i = 0; i < this.curves.length; i++) {
            result.curves.push(this.curves[i].clone());
        }

        result._type = this._type;

        return result;
    }

    quantize(precision) {
        precision = Math.max(precision, 2);

        const numCurves = this.curves.length;
        const values = new Float32Array(precision * numCurves);
        const step = 1.0 / (precision - 1);

        for (let c = 0; c < numCurves; c++) {
            const ev = new CurveEvaluator(this.curves[c]);
            for (let i = 0; i < precision; i++) { // quantize graph to table of interpolated values
                values[i * numCurves + c] = ev.evaluate(step * i);
            }
        }

        return values;
    }

    /**
     * @private
     * @function
     * @name CurveSet#quantizeClamped
     * @description This function will sample the curveset at regular intervals
     * over the range [0..1] and clamp the result to min and max.
     * @param {number} precision - The number of samples to return.
     * @param {number} min - The minimum output value.
     * @param {number} max - The maximum output value.
     * @returns {Float32Array} The set of quantized values.
     */
    quantizeClamped(precision, min, max) {
        const result = this.quantize(precision);
        for (let i = 0; i < result.length; ++i) {
            result[i] = Math.min(max, Math.max(min, result[i]));
        }
        return result;
    }

    /**
     * @readonly
     * @name CurveSet#length
     * @type {number}
     * @description The number of curves in the curve set.
     */
    get length() {
        return this.curves.length;
    }

    /**
     * @name CurveSet#type
     * @type {number}
     * @description The interpolation scheme applied to all curves in the curve set. Can be:
     *
     * * {@link CURVE_LINEAR}
     * * {@link CURVE_SMOOTHSTEP}
     * * {@link CURVE_SPLINE}
     * * {@link CURVE_STEP}
     *
     * Defaults to {@link CURVE_SMOOTHSTEP}.
     */
    get type() {
        return this._type;
    }

    set type(value) {
        this._type = value;
        for (let i = 0; i < this.curves.length; i++) {
            this.curves[i].type = value;
        }
    }
}

export { CurveSet };

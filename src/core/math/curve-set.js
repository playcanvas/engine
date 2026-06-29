import { CURVE_SMOOTHSTEP } from './constants.js';
import { Curve } from './curve.js';
import { CurveEvaluator } from './curve-evaluator.js';

/**
 * A curve set is a collection of curves.
 *
 * @category Math
 */
class CurveSet {
    /**
     * The array of curves in the set.
     *
     * @type {Curve[]}
     */
    curves = [];

    /**
     * @type {number}
     * @private
     */
    _type = CURVE_SMOOTHSTEP;

    /**
     * Creates a new CurveSet instance.
     *
     * @param {...*} args - Variable arguments with several possible formats:
     * - No arguments: Creates a CurveSet with a single default curve.
     * - Single number argument: Creates a CurveSet with the specified number of default curves.
     * - Single array argument: An array of arrays, where each sub-array contains keys (pairs of
     * numbers with the time first and value second).
     * - Multiple arguments: Each argument becomes a separate curve.
     * @example
     * // Create from an array of arrays of keys
     * const curveSet = new pc.CurveSet([
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
    constructor(...args) {
        if (args.length > 1) {
            // Multiple arguments: each becomes a curve
            for (let i = 0; i < args.length; i++) {
                this.curves.push(new Curve(args[i]));
            }
        } else if (args.length === 0) {
            // No arguments: create a single default curve
            this.curves.push(new Curve());
        } else {
            // Single argument
            const arg = args[0];
            if (typeof arg === 'number') {
                // Number: create specified number of default curves
                for (let i = 0; i < arg; i++) {
                    this.curves.push(new Curve());
                }
            } else {
                // Array: each element becomes a curve
                for (let i = 0; i < arg.length; i++) {
                    this.curves.push(new Curve(arg[i]));
                }
            }
        }
    }

    /**
     * Gets the number of curves in the curve set.
     *
     * @type {number}
     */
    get length() {
        return this.curves.length;
    }

    /**
     * Sets the interpolation scheme applied to all curves in the curve set. Can be:
     *
     * - {@link CURVE_LINEAR}
     * - {@link CURVE_SMOOTHSTEP}
     * - {@link CURVE_SPLINE}
     * - {@link CURVE_STEP}
     *
     * Defaults to {@link CURVE_SMOOTHSTEP}.
     *
     * @type {number}
     */
    set type(value) {
        this._type = value;
        for (let i = 0; i < this.curves.length; i++) {
            this.curves[i].type = value;
        }
    }

    /**
     * Gets the interpolation scheme applied to all curves in the curve set.
     *
     * @type {number}
     */
    get type() {
        return this._type;
    }

    /**
     * Return a specific curve in the curve set.
     *
     * @param {number} index - The index of the curve to return.
     * @returns {Curve} The curve at the specified index.
     * @example
     * const curveSet = new pc.CurveSet([[0, 0, 1, 1], [0, 0, 1, 0.5]]);
     * const curve = curveSet.get(0); // returns the first curve
     */
    get(index) {
        return this.curves[index];
    }

    /**
     * Appends a new curve to the curve set. The new curve adopts the curve set's current
     * {@link CurveSet#type} interpolation scheme, so that all curves in the set continue to share
     * the same type.
     *
     * @param {number[]} [data] - An array of keys (pairs of numbers with the time first and value
     * second) for the new curve.
     * @returns {Curve} The newly created curve.
     * @example
     * const curveSet = new pc.CurveSet([[0, 0, 1, 1]]);
     * const curve = curveSet.add([0, 0, 1, 0.5]); // append a second curve
     */
    add(data) {
        const curve = new Curve(data);
        curve.type = this._type;
        this.curves.push(curve);
        return curve;
    }

    /**
     * Removes a curve from the curve set.
     *
     * @param {number|Curve} indexOrCurve - The index of the curve to remove, or the curve instance
     * itself.
     * @returns {Curve|null} The removed curve, or null if it was not found.
     * @example
     * const curveSet = new pc.CurveSet([[0, 0, 1, 1], [0, 0, 1, 0.5]]);
     * curveSet.remove(0);             // remove by index
     * curveSet.remove(curveSet.get(0)); // or remove by reference
     */
    remove(indexOrCurve) {
        const index = typeof indexOrCurve === 'number' ?
            indexOrCurve : this.curves.indexOf(indexOrCurve);

        if (index < 0 || index >= this.curves.length) {
            return null;
        }

        return this.curves.splice(index, 1)[0];
    }

    /**
     * Removes all keys from every curve in the set, while keeping the curves themselves. The number
     * of curves is unchanged, so {@link CurveSet#value} still returns an array of the same length.
     *
     * @returns {this} The curve set instance.
     * @example
     * const curveSet = new pc.CurveSet([[0, 0, 1, 1], [0, 0, 1, 0.5]]);
     * curveSet.clearKeys(); // both curves are now empty, but the set still has 2 curves
     */
    clearKeys() {
        for (let i = 0; i < this.curves.length; i++) {
            this.curves[i].clear();
        }
        return this;
    }

    /**
     * Removes all curves from the curve set, leaving it empty.
     *
     * @returns {this} The curve set instance.
     * @example
     * const curveSet = new pc.CurveSet([[0, 0, 1, 1], [0, 0, 1, 0.5]]);
     * curveSet.clear(); // the set now has no curves
     */
    clear() {
        this.curves.length = 0;
        return this;
    }

    /**
     * Returns the interpolated value of all curves in the curve set at the specified time.
     *
     * @param {number} time - The time at which to calculate the value.
     * @param {number[]} [result] - The interpolated curve values at the specified time. If this
     * parameter is not supplied, the function allocates a new array internally to return the
     * result.
     * @returns {number[]} The interpolated curve values at the specified time.
     * @example
     * const curveSet = new pc.CurveSet([[0, 0, 1, 1], [0, 0, 1, 0.5]]);
     * const values = curveSet.value(0.5); // returns interpolated values for all curves at time 0.5
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
     * Returns a clone of the specified curve set object.
     *
     * @returns {this} A clone of the specified curve set.
     * @example
     * const curveSet = new pc.CurveSet([[0, 0, 1, 1]]);
     * const clonedCurveSet = curveSet.clone();
     */
    clone() {
        /** @type {this} */
        const result = new this.constructor();

        result.curves = [];
        for (let i = 0; i < this.curves.length; i++) {
            result.curves.push(this.curves[i].clone());
        }

        result._type = this._type;

        return result;
    }

    /**
     * Sample the curveset at regular intervals over the range [0..1].
     *
     * @param {number} precision - The number of samples to return.
     * @returns {Float32Array} The set of quantized values.
     * @ignore
     */
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
     * Sample the curveset at regular intervals over the range [0..1] and clamp the result to min
     * and max.
     *
     * @param {number} precision - The number of samples to return.
     * @param {number} min - The minimum output value.
     * @param {number} max - The maximum output value.
     * @returns {Float32Array} The set of quantized values.
     * @ignore
     */
    quantizeClamped(precision, min, max) {
        const result = this.quantize(precision);
        for (let i = 0; i < result.length; ++i) {
            result[i] = Math.min(max, Math.max(min, result[i]));
        }
        return result;
    }
}

export { CurveSet };

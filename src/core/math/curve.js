import { CURVE_SMOOTHSTEP } from './constants.js';
import { CurveEvaluator } from './curve-evaluator.js';

/**
 * A curve is a collection of keys (time/value pairs). The shape of the curve is defined by its
 * type that specifies an interpolation scheme for the keys.
 *
 * @category Math
 */
class Curve {
    /**
     * The keys that define the curve. Each key is an array of two numbers with the time first and
     * the value second.
     *
     * @type {number[][]}
     */
    keys = [];

    /**
     * The curve interpolation scheme. Can be:
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
    type = CURVE_SMOOTHSTEP;

    /**
     * Controls how {@link CURVE_SPLINE} tangents are calculated. Valid range is between 0 and 1
     * where 0 results in a non-smooth curve (equivalent to linear interpolation) and 1 results in
     * a very smooth curve. Use 0.5 for a Catmull-Rom spline.
     *
     * @type {number}
     */
    tension = 0.5;

    /**
     * @type {CurveEvaluator}
     * @private
     */
    _eval = new CurveEvaluator(this);

    /**
     * Creates a new Curve instance.
     *
     * @param {number[]} [data] - An array of keys (pairs of numbers with the time first and value
     * second).
     * @example
     * const curve = new pc.Curve([
     *     0, 0,        // At 0 time, value of 0
     *     0.33, 2,     // At 0.33 time, value of 2
     *     0.66, 2.6,   // At 0.66 time, value of 2.6
     *     1, 3         // At 1 time, value of 3
     * ]);
     */
    constructor(data) {
        if (data) {
            for (let i = 0; i < data.length - 1; i += 2) {
                this.keys.push([data[i], data[i + 1]]);
            }
        }

        this.sort();
    }

    /**
     * Gets the number of keys in the curve.
     *
     * @type {number}
     */
    get length() {
        return this.keys.length;
    }

    /**
     * Adds a new key to the curve.
     *
     * @param {number} time - Time to add new key.
     * @param {number} value - Value of new key.
     * @returns {number[]} The newly created `[time, value]` pair.
     * @example
     * const curve = new pc.Curve();
     * curve.add(0, 1);   // add key at time 0 with value 1
     * curve.add(1, 2);   // add key at time 1 with value 2
     */
    add(time, value) {
        const keys = this.keys;
        const len = keys.length;
        let i = 0;

        for (; i < len; i++) {
            if (keys[i][0] > time) {
                break;
            }
        }

        const key = [time, value];
        this.keys.splice(i, 0, key);
        return key;
    }

    /**
     * Gets the `[time, value]` pair at the specified index.
     *
     * @param {number} index - The index of key to return.
     * @returns {number[]} The `[time, value]` pair at the specified index.
     * @example
     * const curve = new pc.Curve([0, 1, 1, 2]);
     * const key = curve.get(0); // returns [0, 1]
     */
    get(index) {
        return this.keys[index];
    }

    /**
     * Sorts keys by time.
     */
    sort() {
        this.keys.sort((a, b) => a[0] - b[0]);
    }

    /**
     * Returns the interpolated value of the curve at specified time.
     *
     * @param {number} time - The time at which to calculate the value.
     * @returns {number} The interpolated value.
     * @example
     * const curve = new pc.Curve([0, 0, 1, 10]);
     * const value = curve.value(0.5); // returns interpolated value at time 0.5
     */
    value(time) {
        // we force reset the evaluation because keys may have changed since the last evaluate
        // (we can't know)
        return this._eval.evaluate(time, true);
    }

    /**
     * Returns the key closest to the specified time.
     *
     * @param {number} time - The time to find the closest key to.
     * @returns {number[]|null} The `[time, value]` pair closest to the specified time, or null if
     * no keys exist.
     * @example
     * const curve = new pc.Curve([0, 1, 0.5, 2, 1, 3]);
     * const key = curve.closest(0.6); // returns [0.5, 2]
     */
    closest(time) {
        const keys = this.keys;
        const length = keys.length;
        let min = 2;
        let result = null;

        for (let i = 0; i < length; i++) {
            const diff = Math.abs(time - keys[i][0]);
            if (min >= diff) {
                min = diff;
                result = keys[i];
            } else {
                break;
            }
        }

        return result;
    }

    /**
     * Returns a clone of the specified curve object.
     *
     * @returns {this} A clone of the specified curve.
     * @example
     * const curve = new pc.Curve([0, 0, 1, 10]);
     * const clonedCurve = curve.clone();
     */
    clone() {
        /** @type {this} */
        const result = new this.constructor();
        result.keys = this.keys.map(key => [...key]);
        result.type = this.type;
        result.tension = this.tension;
        return result;
    }

    /**
     * Sample the curve at regular intervals over the range [0..1].
     *
     * @param {number} precision - The number of samples to return.
     * @returns {Float32Array} The set of quantized values.
     * @ignore
     */
    quantize(precision) {
        precision = Math.max(precision, 2);

        const values = new Float32Array(precision);
        const step = 1.0 / (precision - 1);

        // quantize graph to table of interpolated values
        values[0] = this._eval.evaluate(0, true);
        for (let i = 1; i < precision; i++) {
            values[i] = this._eval.evaluate(step * i);
        }

        return values;
    }

    /**
     * Sample the curve at regular intervals over the range [0..1] and clamp the resulting samples
     * to [min..max].
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

export { Curve };

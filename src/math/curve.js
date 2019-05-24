Object.assign(pc, (function () {
    'use strict';

    /**
     * @enum pc.CURVE
     * @name pc.CURVE_LINEAR
     * @description A linear interpolation scheme.
     */
    var CURVE_LINEAR = 0;
    /**
     * @enum pc.CURVE
     * @name pc.CURVE_SMOOTHSTEP
     * @description A smooth step interpolation scheme.
     */
    var CURVE_SMOOTHSTEP = 1;
    /**
     * @deprecated
     * @enum pc.CURVE
     * @name pc.CURVE_CATMULL
     * @description A Catmull-Rom spline interpolation scheme. This interpolation scheme is deprecated. Use CURVE_SPLINE instead.
     */
    var CURVE_CATMULL = 2;
    /**
     * @deprecated
     * @enum pc.CURVE
     * @name pc.CURVE_CARDINAL
     * @description A cardinal spline interpolation scheme. This interpolation scheme is deprecated. Use CURVE_SPLINE instead.
     */
    var CURVE_CARDINAL = 3;
    /**
     * @enum pc.CURVE
     * @name pc.CURVE_SPLINE
     * @description Cardinal spline interpolation scheme. For Catmull-Rom, specify curve tension 0.5.
     */
    var CURVE_SPLINE = 4;
    /**
     * @enum pc.CURVE
     * @name pc.CURVE_STEP
     * @description A stepped interpolater, free from the shackles of blending.
     */
    var CURVE_STEP = 5;

    /**
     * @constructor
     * @name pc.Curve
     * @classdesc A curve is a collection of keys (time/value pairs). The shape of the
     * curve is defined by its type that specifies an interpolation scheme for the keys.
     * @description Creates a new curve.
     * @param {Number[]} [data] An array of keys (pairs of numbers with the time first and
     * value second)
     * @property {Number} length The number of keys in the curve. [read only]
     */
    var Curve = function (data) {
        this.keys = [];
        this.type = CURVE_SMOOTHSTEP;
        this.tension = 0.5; // used for CURVE_CARDINAL
        this._eval = new pc.CurveEvaluator(this);

        if (data) {
            for (var i = 0; i < data.length - 1; i += 2) {
                this.keys.push([data[i], data[i + 1]]);
            }
        }

        this.sort();
    };

    Object.assign(Curve.prototype, {
        /**
         * @function
         * @name pc.Curve#add
         * @description Add a new key to the curve.
         * @param {Number} time Time to add new key
         * @param {Number} value Value of new key
         * @returns {Number[]} [time, value] pair
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
         * @param {Number} index The index of the key to return
         * @returns {Number[]} The key at the specified index
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
         * @param {Number} time The time at which to calculate the value
         * @returns {Number} The interpolated value
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
         * @returns {pc.Curve} A clone of the specified curve
         */
        clone: function () {
            var result = new pc.Curve();
            result.keys = pc.extend(result.keys, this.keys);
            result.type = this.type;
            result.tension = this.tension;
            return result;
        },

        /**
         * @private
         * @function
         * @name pc.Curve#quantize
         * @description Sample the curve at regular intervals over the range [0..1]
         * @param {Number} precision The number of samples to return.
         * @returns {Array} The set of quantized values.
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
         * @param {Number} precision The number of samples to return.
         * @param {Number} min The minimum output value.
         * @param {Number} max The maximum output value.
         * @returns {Array} The set of quantized values.
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

    return {
        Curve: Curve,
        CURVE_LINEAR: CURVE_LINEAR,
        CURVE_SMOOTHSTEP: CURVE_SMOOTHSTEP,
        CURVE_CATMULL: CURVE_CATMULL,
        CURVE_CARDINAL: CURVE_CARDINAL,
        CURVE_SPLINE: CURVE_SPLINE,
        CURVE_STEP: CURVE_STEP
    };
}()));

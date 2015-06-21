pc.extend(pc, (function () {
    'use strict';

    /**
     * @name pc.CurveSet
     * @class A curve set is a collection of curves.
     * @constructor Creates a new curve set.
     * @param {Array} [curveKeys] An array of arrays of keys (pairs of numbers with
     * the time first and value second)
     * @property {Number} length [Read only] The number of curves in the curve set
     * @property {pc.CURVE} type The interpolation scheme applied to all curves in the
     * curve set
     */
    var CurveSet = function () {
        var i;

        this.curves = [];
        this._type = pc.CURVE_SMOOTHSTEP;

        if (arguments.length > 1) {
            for (i = 0; i < arguments.length; i++) {
                this.curves.push(new pc.Curve(arguments[i]));
            }
        } else {
            if (arguments.length === 0) {
                this.curves.push(new pc.Curve());
            } else {
                var arg = arguments[0];
                if (pc.type(arg) === 'number') {
                    for (i = 0; i < arg; i++) {
                        this.curves.push(new pc.Curve());
                    }
                } else {
                    for (i = 0; i < arg.length; i++) {
                        this.curves.push(new pc.Curve(arg[i]));
                    }
                }
            }
        }
    };

    CurveSet.prototype = {
        /**
         * @function
         * @name pc.CurveSet#get
         * @description Return a specific curve in the curve set.
         * @param {Number} index The index of the curve to return
         * @returns {pc.Curve} The curve at the specified index
         */
        get: function (index) {
            return this.curves[index];
        },

        /**
         * @function
         * @name pc.CurveSet#value
         * @description Returns the interpolated value of all curves in the curve
         * set at the specified time.
         * @param {Number} time The time at which to calculate the value
         * @param {Array} [result] The interpolated curve values at the specified time.
         * If this parameter is not supplied, the function allocates a new array internally
         * to return the result.
         * @return {Array} The interpolated curve values at the specified time
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
         * @name pc.Curve#interpolate
         * @description Use the curve to interpolate between two values
         * @param {pc.Vec3|pc.Quat|Number} start The start value
         * @param {pc.Vec3|pc.Quat|Number} end The target value
         * @param {Number} t The time on the curve to use
         * If this parameter is not supplied, the function allocates a new array internally
         * to return the result.
         * @return {Array} The interpolated curve values at the specified time
         */
        interpolate: function (start, end, t) {
            return this.value(t).map(function(r) {
                return pc.interpolate.value(start, end, r);
            });
        },
        /**
         * @function
         * @name pc.Curve#overTime
         * @description Use the curve to interpolate between two values over time with a callback and an event
         * @param {pc.Vec3|pc.Quat|Number} start The start value
         * @param {pc.Vec3|pc.Quat|Number} end The target value
         * @param {Number} time The number of seconds to complete the transition
         * @param {Function} callback An optional callback function to be passed the value when
         *     it changes
         * @param {Object} bind An object containing an enabled property, the blend only occurs
         *     when the enabled property is true
         * @returns {pc.Coroutine} The coroutine managing the interpolation
         * @remarks Using a curve to provide interpolation can make more natural looking motions with bounces and hyper extension when compared
         * to {pc.interpolate.smooth}
         */
        overTime: function (start, end, time, callback, bind) {
            var t = 0;
            time = time || 1;
            if (start === undefined || end === undefined) {
                throw new Error("start and end must be specified");
            }
            start = typeof start == 'object' ? start.clone() : start;
            end = typeof end == 'object' ? end.clone() : end;

            return new pc.Coroutine(function (dt, coroutine) {
                t = Math.min(1, t + dt / time);
                var result = this.value(t).map(function(r) { return pc.interpolate.value(start, end, r); });
                if (callback) {
                    callback(result, t);
                }
                coroutine.fire('value', result, t);
                if (t >= 1) {
                    return false;
                }
            }.bind(this), undefined, bind);
        },
        /**
         * @function
         * @name pc.CurveSet#clone
         * @description Returns a clone of the specified curve set object.
         * @returns {pc.CurveSet} A clone of the specified curve set
         */
        clone: function () {
            var result = new pc.CurveSet();

            result.curves = [ ];
            for(var i = 0; i < this.curves.length; i++) {
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
            var temp = [];

            for (var i = 0; i < precision; i++) { // quantize graph to table of interpolated values
                var value = this.value(step * i, temp);
                if (numCurves == 1) {
                    values[i] = value[0];
                } else {
                    for (var j = 0; j < numCurves; j++) {
                        values[i * numCurves + j] = value[j];
                    }
                }
            }

            return values;
        }

    };

    Object.defineProperty(CurveSet.prototype, 'length', {
        get: function() {
            return this.curves.length;
        }
    });

    Object.defineProperty(CurveSet.prototype, 'type', {
        get: function() {
            return this._type;
        },

        set: function(value) {
            this._type = value;
            for (var i = 0; i < this.curves.length; i++) {
                this.curves[i].type = value;
            }
        },
    });

    return {
        CurveSet: CurveSet
    };
}()));

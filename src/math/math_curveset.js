pc.extend(pc, (function () {

    var CurveSet = function () {
        this.curves = [];
        this._smoothstep = true;

        if (arguments.length > 1) {
            for (var i = 0; i < arguments.length; i++) {
                this.curves.push(new pc.Curve(arguments[i]));
            }
        } else {
            if (arguments.length === 1) {
                var arg = arguments[0];
                if (pc.type(arg) === 'number') {
                    for (var i = 0; i < arg; i++) {
                        this.curves.push(new pc.Curve());
                    }
                } else {
                    if (arg.length) {
                        if (pc.type(arg[0]) === 'array') {
                            for (var i = 0; i < arg.length; i++) {
                                this.curves.push(new pc.Curve(arg[i]));
                            }
                        } else {
                            this.curves.push(new pc.Curve(arg));
                        }

                    } else {
                        this.curves.push(new pc.Curve());
                    }
                }
            } else {
                this.curves.push(new pc.Curve());
            }
        }
    };

    CurveSet.prototype = {
        get: function (index) {
            return this.curves[index];
        },

        value: function (time, result) {
            var length = this.curves.length;
            var result = result || [];
            result.length = length;

            for (var i = 0; i < length; i++) {
                result[i] = this.curves[i].value(time);
            }

            return result;
        },

        clone: function () {
            var result = new pc.CurveSet();
            this.curves.forEach(function (c) {
                result.push(c.clone());
            })

            result._smoothstep = this._smoothstep;

            return result;
        },

        quantize: function(precision, blur) {
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

            if (blur > 0) {
                var values2 = new Float32Array(precision * numCurves);
                var numSamples = blur * 2 + 1;
                for (var i = 0; i < precision; i++) {
                    if (numCurves == 1) {
                        values2[i] = 0;
                        for (var sample = -blur; sample <= blur; sample++) {
                            var sampleAddr = Math.max(Math.min(i + sample, precision - 1), 0);
                            values2[i] += values[sampleAddr];
                        }
                        values2[i] /= numSamples;
                    } else {
                        for (var chan = 0; chan < numCurves; chan++) {
                            values2[i * numCurves + chan] = 0;
                        }

                        for (var sample = -blur; sample <= blur; sample++) {
                            var sampleAddr = Math.max(Math.min(i + sample, precision - 1), 0);
                            for (var chan = 0; chan < numCurves; chan++) {
                                values2[i * numCurves + chan] += values[sampleAddr * numCurves + chan];
                            }
                        }

                        for (var chan = 0; chan < numCurves; chan++) {
                            values2[i * numCurves + chan] /= numSamples;
                        }
                    }
                }
                values = values2;
            }

            return values;
        }

    };

    Object.defineProperty(CurveSet.prototype, 'length', {
        get: function() {
            return this.curves.length;
        }
    });

    Object.defineProperty(CurveSet.prototype, 'smoothstep', {
        get: function() {
            return this._smoothstep;
        },

        set: function(value) {
            this._smoothstep = value;
            for (var i = 0; i < this.curves.length; i++) {
                this.curves[i].smoothstep = value;
            }
        },
    });

    return {
        CurveSet: CurveSet
    };
}()));

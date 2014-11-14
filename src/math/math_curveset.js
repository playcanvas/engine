pc.extend(pc, (function () {

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
        get: function (index) {
            return this.curves[index];
        },

        value: function (time, result) {
            var length = this.curves.length;
            result = result || [];
            result.length = length;

            for (var i = 0; i < length; i++) {
                result[i] = this.curves[i].value(time);
            }

            return result;
        },

        clone: function () {
            var result = new pc.CurveSet();

            result.curves = [ ];
            for(var i = 0; i < this.curves.length; i++) {
                result.curves.push(this.curves.clone());
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

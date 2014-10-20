pc.extend(pc, (function () {

    var Curve = function (data) {
        this.smoothstep = true;
        this.keys = [];

        if (data) {
            for (var i = 0; i < data.length - 1; i += 2) {
                this.keys.push([data[i], data[i+1]]);
            }
        }
    };

    Curve.prototype = {
        add: function (time, value) {
            var keys = this.keys;
            var len = keys.length;
            var i = 0;

            for (; i < len; i++) {
                if (keys[i][0] > time) {
                    break;
                }
            }

            this.keys.splice(i, 0, [time, value]);
        },

        get: function (index) {
            return this.keys[index];
        },

        sort: function () {
            this.keys.sort(function (a, b) {
                return a[0] - b[0];
            })
        },

        value: function (time) {
            var leftTime = 0;
            var leftValue = 0;

            var rightTime = 1;
            var rightValue = 0;

            var keys = this.keys;

            for (var i = 0, len = keys.length; i < len; i++) {

                // early exit check
                if (keys[i][0] === time) {
                    return keys[i][1];
                }

                rightValue = keys[i][1];

                if (time < keys[i][0]) {
                    rightTime = keys[i][0];
                    break;
                }

                leftTime = keys[i][0];
                leftValue = keys[i][1];
            }

            var div = rightTime - leftTime;

            var interpolation = (div === 0 ? 0 : (time - leftTime) / div);

            if (this.smoothstep) {
                interpolation *= interpolation * (3 - 2 * interpolation);
            }

            return pc.math.lerp(leftValue, rightValue, interpolation);
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

        quantize: function(precision, blur) {
            precision = Math.max(precision, 2);

            var values = new Float32Array(precision);
            var step = 1.0 / (precision - 1);

            // quantize graph to table of interpolated values
            for (var i = 0; i < precision; i++) {
                var value = this.value(step * i);
                values[i] = value;
            }

            if (blur > 0) {
                var values2 = new Float32Array(precision);
                var numSamples = blur * 2 + 1;
                for (var i = 0; i < precision; i++) {
                    values2[i] = 0;
                    for (var sample = -blur; sample <= blur; sample++) {
                        var sampleAddr = Math.max(Math.min(i + sample, precision - 1), 0);
                        values2[i] += values[sampleAddr];
                    }
                    values2[i] /= numSamples;
                }
                values = values2;
            }

            return values;
        }
    };

    Object.defineProperty(Curve.prototype, 'length', {
        get: function() {
            return this.keys.length;
        }
    });

    return {
        Curve: Curve
    };
}()));

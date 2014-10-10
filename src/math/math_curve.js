pc.extend(pc, (function () {

    var Curve = function (numValues) {
        this.keys = [];
        this.dirty = true;
        this.numVals = numValues == undefined ? 1 : numValues;
        this.smoothstep = true;
    };

    Curve.prototype = {

        addKey: function(time, value) { // time is supposed to be normalized
            this.keys.push([time, value]);
            this.dirty = true;
        },

        prepare: function() {
            this.keys.sort(function(a, b) {
                return a[0] - b[0];
            });
            this.dirty = false;
        },

        getValue: function(time) {
            if (this.dirty) this.prepare();
            for (var i = 0; i < this.keys.length; i++) {
                var keyTime = this.keys[i][0];
                if (keyTime == time) {
                    return this.keys[i][1];
                } else if (keyTime < time) {
                    var keyTimeNext = this.keys[i + 1][0];
                    if (keyTimeNext > time) {
                        var keyValA = this.keys[i][1];
                        var keyValB = this.keys[i + 1][1];
                        var interpolation = (time - keyTime) / (keyTimeNext - keyTime);

                        if (this.smoothstep) interpolation = ((interpolation) * (interpolation) * (3 - 2 * (interpolation))); // smoothstep

                        if (keyValA instanceof Array) {
                            var interpolated = new Array(keyValA.length);
                            for (var v = 0; v < keyValA.length; v++) interpolated[v] = pc.math.lerp(keyValA[v], keyValB[v], interpolation);
                            return interpolated;
                        } else {
                            return pc.math.lerp(keyValA, keyValB, interpolation);
                        }

                    }
                }
            }
            return null;
        },

        quantize: function(precision, blur) {
            precision = Math.max(precision, 2);
            var colors = new Float32Array(precision * this.numVals);
            var step = 1.0 / (precision - 1);
            for (var i = 0; i < precision; i++) // quantize graph to table of interpolated values
            {
                var color = this.getValue(step * i);
                if (this.numVals == 1) {
                    colors[i] = color;
                } else {
                    for (var j = 0; j < this.numVals; j++) colors[i * this.numVals + j] = color[j]
                }
            }

            if (blur > 0) {
                var colors2 = new Float32Array(precision * this.numVals);
                var numSamples = blur * 2 + 1;
                for (var i = 0; i < precision; i++) {
                    if (this.numVals == 1) {
                        colors2[i] = 0;
                        for (var sample = -blur; sample <= blur; sample++) {
                            var sampleAddr = Math.max(Math.min(i + sample, precision - 1), 0);
                            colors2[i] += colors[sampleAddr];
                        }
                        colors2[i] /= numSamples;
                    } else {
                        for (var chan = 0; chan < this.numVals; chan++) colors2[i * this.numVals + chan] = 0;
                        for (var sample = -blur; sample <= blur; sample++) {
                            var sampleAddr = Math.max(Math.min(i + sample, precision - 1), 0);
                            for (var chan = 0; chan < this.numVals; chan++) colors2[i * this.numVals + chan] += colors[sampleAddr * this.numVals + chan];
                        }
                        for (var chan = 0; chan < this.numVals; chan++) colors2[i * this.numVals + chan] /= numSamples;
                    }
                }
                colors = colors2;
            }

            return colors;
        }
    };

    return {
        Curve: Curve
    };
}()));

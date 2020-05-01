Object.assign(pc, (function () {
    function hashCalc(hash, value) {
        hash = ((hash << 5) - hash) + value;
        // Convert to 32bit integer
        hash |= 0; 
        return hash;
    }

    return {
        /**
         * @private
         * @function
         * @name pc.hashCode
         * @description Calculates simple hash value of a string. Designed for performance, not perfect.
         * @param {string} str - String.
         * @returns {number} Hash value.
         */
        hashCode: function (str) {
            var hash = 0;
            for (var i = 0, len = str.length; i < len; i++) {
                hash = hashCalc(hash, str.charCodeAt(i));
            }
            return hash;
        },

        hashCurve: function (curve) {
            var hash = curve.type;
            var keys = curve.keys;
            for (var i = 0, len = keys.length; i < len; i++) {
                hash = hashCalc(hash, Math.round(keys[i][0] * 10000));
                hash = hashCalc(hash, Math.round(keys[i][1] * 10000));
            }
            return hash;    
        },

        hashCurveSet: function (curveSet) {
            var hash = curveSet._type;
            var curves = curveSet.curves;
            var keys;
            
            for (var i = 0; i < curves.length; ++i) {
                keys = curves[i].keys;
                for (var j = 0, len = keys.length; j < len; j++) {
                    hash = hashCalc(hash, Math.round(keys[j][0] * 10000));
                    hash = hashCalc(hash, Math.round(keys[j][1] * 10000));
                }
            }
            return hash; 
        },

        hash2Float32Arrays: function (floatArray1, floatArray2) {
            var hash = 0;
            var i;

            for (i = 0; i < floatArray1.length; ++i) {
                hash = hashCalc(hash, Math.round(floatArray1[i] * 10000));
            }

            for (i = 0; i < floatArray2.length; ++i) {
                hash = hashCalc(hash, Math.round(floatArray2[i] * 10000));
            }

            return hash; 
        }
    };
}()));

pc.extend(pc, (function () {
    'use strict';

    /**
    * @name pc.Mat3
    * @class A 4x4 matrix.
    * @constructor Creates a new Mat3 object
    */
    var Mat3 = function () {
        this.data = new Float32Array(9);

        if (arguments.length === 9) {
            this.data.set(arguments);
        } else {
            this.setIdentity();
        }
    };

    Mat3.prototype = {
        /**
         * @function
         * @name pc.Mat3#clone
         * @description Creates a duplicate of the specified matrix.
         * @returns {pc.Mat3} A duplicate matrix.
         * @example
         * var src = new pc.Mat3().translate(10, 20, 30);
         * var dst = new pc.Mat3();
         * dst.copy(src);
         * console.log("The two matrices are " + (src.equal(dst) ? "equal" : "different"));
         */
        clone: function () {
            return new pc.Mat3().copy(this);
        },

        /**
         * @function
         * @name pc.Mat3#copy
         * @description Copies the contents of a source 4x4 matrix to a destination 4x4 matrix.
         * @param {pc.Mat3} src A 4x4 matrix to be copied.
         * @returns {pc.Mat3} Self for chaining
         * @example
         * var src = new pc.Mat3().translate(10, 20, 30);
         * var dst = new pc.Mat3();
         * dst.copy(src);
         * console.log("The two matrices are " + (src.equal(dst) ? "equal" : "different"));
         */
        copy: function (rhs) {
            var src = rhs.data;
            var dst = this.data;

            dst[0] = src[0];
            dst[1] = src[1];
            dst[2] = src[2];
            dst[3] = src[3];
            dst[4] = src[4];
            dst[5] = src[5];
            dst[6] = src[6];
            dst[7] = src[7];
            dst[8] = src[8];

            return this;
        },

        /**
         * @function
         * @name pc.Mat3#equals
         * @param {rhs} pc.Mat3 The other matrix.
         * @description Reports whether two matrices are equal.
         * @returns {Boolean} true if the matrices are equal and false otherwise.
         * @example
         * var a = new pc.Mat3().translate(10, 20, 30);
         * var b = new pc.Mat3();
         * console.log("The two matrices are " + (a.equals(b) ? "equal" : "different"));
         */
        equals: function (rhs) {
            var l = this.data;
            var r = rhs.data;

            return ((l[0] === r[0]) &&
                    (l[1] === r[1]) &&
                    (l[2] === r[2]) &&
                    (l[3] === r[3]) &&
                    (l[4] === r[4]) &&
                    (l[5] === r[5]) &&
                    (l[6] === r[6]) &&
                    (l[7] === r[7]) &&
                    (l[8] === r[8]));
        },

        /**
         * @function
         * @name pc.Mat3#isIdentity
         * @description Reports whether the specified matrix is the identity matrix.
         * @returns {Boolean} true if the matrix is identity and false otherwise.
         * @example
         * var m = new pc.Mat3();
         * console.log("The matrix is " + (m.isIdentity() ? "identity" : "not identity"));
         */
        isIdentity: function () {
            var m = this.data;
            return ((m[0] === 1) &&
                    (m[1] === 0) &&
                    (m[2] === 0) &&
                    (m[3] === 0) &&
                    (m[4] === 1) &&
                    (m[5] === 0) &&
                    (m[6] === 0) &&
                    (m[7] === 0) &&
                    (m[8] === 1));
        },

        /**
         * @function
         * @name pc.Mat3#setIdentity
         * @description Sets the matrix to the identity matrix.
         * @returns {pc.Mat3} Self for chaining.
         * @example
         * m.setIdentity();
         * console.log("The two matrices are " + (src.equal(dst) ? "equal" : "different"));
         */
        setIdentity: function () {
            var m = this.data;
            m[0] = 1;
            m[1] = 0;
            m[2] = 0;

            m[3] = 0;
            m[4] = 1;
            m[5] = 0;

            m[6] = 0;
            m[7] = 0;
            m[8] = 1;

            return this;
        },

        /**
         * @function
         * @name pc.Mat3#toString
         * @description Converts the matrix to string form.
         * @returns {String} The matrix in string form.
         * @example
         * var m = new pc.Mat3();
         * // Should output '[1, 0, 0, 0, 1, 0, 0, 0, 1]'
         * console.log(m.toString());
         */
        toString: function () {
            var t = "[";
            for (var i = 0; i < 9; i++) {
                t += this.data[i];
                t += (i !== 9) ? ", " : "";
            }
            t += "]";
            return t;
        },

        /**
         * @function
         * @name pc.Mat3#transpose
         * @description Generates the transpose of the specified 3x3 matrix.
         * @returns {pc.Mat3} Self for chaining.
         * @example
         * var m = new pc.Mat3();
         *
         * // Transpose in place
         * m.transpose();
         */
        transpose: function () {
            var m = this.data;

            var tmp;
            tmp = m[1]; m[1] = m[3]; m[3] = tmp;
            tmp = m[2]; m[2] = m[6]; m[6] = tmp;
            tmp = m[5]; m[5] = m[7]; m[7] = tmp;

            return this;
        }
    };

    /**
     * @field
     * @static
     * @readonly
     * @type pc.Mat3
     * @name pc.Mat3.IDENTITY
     * @description A constant matrix set to the identity.
     */
    Object.defineProperty(Mat3, 'IDENTITY', {
        get: function () {
            var identity = new Mat3();
            return function() {
                return identity;
            }
        }()
    });

    /**
     * @field
     * @static
     * @readonly
     * @type pc.Mat3
     * @name pc.Mat3.ZERO
     * @description A constant matrix with all elements set to 0.
     */
    Object.defineProperty(Mat3, 'ZERO', {
        get: function () {
            var zero = new Mat3(0, 0, 0, 0, 0, 0, 0, 0, 0);
            return function() {
                return zero;
            }
        }()
    });

    return {
        Mat3: Mat3
    };
}()));

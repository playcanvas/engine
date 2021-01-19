/**
 * @class
 * @name Mat3
 * @classdesc A 3x3 matrix.
 * @description Creates a new identity Mat3 object.
 * @property {Float32Array} data Matrix elements in the form of a flat array.
 */
class Mat3 {
    constructor() {
        var data;
        // Create an identity matrix. Note that a new Float32Array has all elements set
        // to zero by default, so we only need to set the relevant elements to one.
        data = new Float32Array(9);
        data[0] = data[4] = data[8] = 1;
        this.data = data;
    }

    /**
     * @function
     * @name Mat3#clone
     * @description Creates a duplicate of the specified matrix.
     * @returns {pc.Mat3} A duplicate matrix.
     * @example
     * var src = new pc.Mat3().translate(10, 20, 30);
     * var dst = src.clone();
     * console.log("The two matrices are " + (src.equals(dst) ? "equal" : "different"));
     */
    clone() {
        return new Mat3().copy(this);
    }

    /**
     * @function
     * @name Mat3#copy
     * @description Copies the contents of a source 3x3 matrix to a destination 3x3 matrix.
     * @param {Mat3} rhs - A 3x3 matrix to be copied.
     * @returns {pc.Mat3} Self for chaining.
     * @example
     * var src = new pc.Mat3().translate(10, 20, 30);
     * var dst = new pc.Mat3();
     * dst.copy(src);
     * console.log("The two matrices are " + (src.equals(dst) ? "equal" : "different"));
     */
    copy(rhs) {
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
    }

    /**
     * @function
     * @name Mat3#set
     * @description Copies the contents of a source array[9] to a destination 3x3 matrix.
     * @param {number[]} src - An array[9] to be copied.
     * @returns {pc.Mat3} Self for chaining.
     * @example
     * var dst = new pc.Mat3();
     * dst.set([0, 1, 2, 3, 4, 5, 6, 7, 8]);
     */
    set(src) {
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
    }

    /**
     * @function
     * @name Mat3#equals
     * @param {Mat3} rhs - The other matrix.
     * @description Reports whether two matrices are equal.
     * @returns {boolean} True if the matrices are equal and false otherwise.
     * @example
     * var a = new pc.Mat3().translate(10, 20, 30);
     * var b = new pc.Mat3();
     * console.log("The two matrices are " + (a.equals(b) ? "equal" : "different"));
     */
    equals(rhs) {
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
    }

    /**
     * @function
     * @name Mat3#isIdentity
     * @description Reports whether the specified matrix is the identity matrix.
     * @returns {boolean} True if the matrix is identity and false otherwise.
     * @example
     * var m = new pc.Mat3();
     * console.log("The matrix is " + (m.isIdentity() ? "identity" : "not identity"));
     */
    isIdentity() {
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
    }

    /**
     * @function
     * @name Mat3#setIdentity
     * @description Sets the matrix to the identity matrix.
     * @returns {pc.Mat3} Self for chaining.
     * @example
     * m.setIdentity();
     * console.log("The matrix is " + (m.isIdentity() ? "identity" : "not identity"));
     */
    setIdentity() {
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
    }

    /**
     * @function
     * @name Mat3#toString
     * @description Converts the matrix to string form.
     * @returns {string} The matrix in string form.
     * @example
     * var m = new pc.Mat3();
     * // Should output '[1, 0, 0, 0, 1, 0, 0, 0, 1]'
     * console.log(m.toString());
     */
    toString() {
        var t = '[';
        for (var i = 0; i < 9; i++) {
            t += this.data[i];
            t += (i !== 8) ? ', ' : '';
        }
        t += ']';
        return t;
    }

    /**
     * @function
     * @name Mat3#transpose
     * @description Generates the transpose of the specified 3x3 matrix.
     * @returns {pc.Mat3} Self for chaining.
     * @example
     * var m = new pc.Mat3();
     *
     * // Transpose in place
     * m.transpose();
     */
    transpose() {
        var m = this.data;

        var tmp;
        tmp = m[1]; m[1] = m[3]; m[3] = tmp;
        tmp = m[2]; m[2] = m[6]; m[6] = tmp;
        tmp = m[5]; m[5] = m[7]; m[7] = tmp;

        return this;
    }

    /**
     * @function
     * @name Mat3#setFromMat4
     * @description Converts the specified 4x4 matrix to a Mat3.
     * @param {Mat4} m - The 4x4 matrix to convert.
     * @returns {pc.Mat3} Self for chaining.
     */
    setFromMat4(m) {
        var src = m.data;
        var dst = this.data;

        dst[0] = src[0];
        dst[1] = src[1];
        dst[2] = src[2];

        dst[3] = src[4];
        dst[4] = src[5];
        dst[5] = src[6];

        dst[6] = src[8];
        dst[7] = src[9];
        dst[8] = src[10];

        return this;
    }

    /**
     * @field
     * @static
     * @readonly
     * @name Mat3.IDENTITY
     * @type {pc.Mat3}
     * @description A constant matrix set to the identity.
     */
    static IDENTITY = Object.freeze(new Mat3());

    /**
     * @field
     * @static
     * @readonly
     * @name Mat3.ZERO
     * @type {pc.Mat3}
     * @description A constant matrix with all elements set to 0.
     */
    static ZERO = Object.freeze(new Mat3().set([0, 0, 0, 0, 0, 0, 0, 0, 0]));
}

export { Mat3 };

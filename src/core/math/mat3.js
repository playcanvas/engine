import { Vec3 } from './vec3.js';

/**
 * A 3x3 matrix.
 *
 * @category Math
 */
class Mat3 {
    /**
     * Matrix elements in the form of a flat array.
     *
     * @type {Float32Array}
     */
    data = new Float32Array(9);

    /**
     * Create a new Mat3 instance. It is initialized to the identity matrix.
     */
    constructor() {
        // Create an identity matrix. Note that a new Float32Array has all elements set
        // to zero by default, so we only need to set the relevant elements to one.
        this.data[0] = this.data[4] = this.data[8] = 1;
    }

    /**
     * Creates a duplicate of the specified matrix.
     *
     * @returns {this} A duplicate matrix.
     * @example
     * const src = new pc.Mat3().translate(10, 20, 30);
     * const dst = src.clone();
     * console.log("The two matrices are " + (src.equals(dst) ? "equal" : "different"));
     */
    clone() {
        /** @type {this} */
        const cstr = this.constructor;
        return new cstr().copy(this);
    }

    /**
     * Copies the contents of a source 3x3 matrix to a destination 3x3 matrix.
     *
     * @param {Mat3} rhs - A 3x3 matrix to be copied.
     * @returns {Mat3} Self for chaining.
     * @example
     * const src = new pc.Mat3().translate(10, 20, 30);
     * const dst = new pc.Mat3();
     * dst.copy(src);
     * console.log("The two matrices are " + (src.equals(dst) ? "equal" : "different"));
     */
    copy(rhs) {
        const src = rhs.data;
        const dst = this.data;

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
     * Copies the contents of a source array[9] to a destination 3x3 matrix.
     *
     * @param {number[]} src - An array[9] to be copied.
     * @returns {Mat3} Self for chaining.
     * @example
     * const dst = new pc.Mat3();
     * dst.set([0, 1, 2, 3, 4, 5, 6, 7, 8]);
     */
    set(src) {
        const dst = this.data;

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
     * Extracts the x-axis from the specified matrix.
     *
     * @param {Vec3} [x] - The vector to receive the x axis of the matrix.
     * @returns {Vec3} The x-axis of the specified matrix.
     */
    getX(x = new Vec3()) {
        return x.set(this.data[0], this.data[1], this.data[2]);
    }

    /**
     * Extracts the y-axis from the specified matrix.
     *
     * @param {Vec3} [y] - The vector to receive the y axis of the matrix.
     * @returns {Vec3} The y-axis of the specified matrix.
     */
    getY(y = new Vec3()) {
        return y.set(this.data[3], this.data[4], this.data[5]);
    }

    /**
     * Extracts the z-axis from the specified matrix.
     *
     * @param {Vec3} [z] - The vector to receive the z axis of the matrix.
     * @returns {Vec3} The z-axis of the specified matrix.
     */
    getZ(z = new Vec3()) {
        return z.set(this.data[6], this.data[7], this.data[8]);
    }

    /**
     * Reports whether two matrices are equal.
     *
     * @param {Mat3} rhs - The other matrix.
     * @returns {boolean} True if the matrices are equal and false otherwise.
     * @example
     * const a = new pc.Mat3().translate(10, 20, 30);
     * const b = new pc.Mat3();
     * console.log("The two matrices are " + (a.equals(b) ? "equal" : "different"));
     */
    equals(rhs) {
        const l = this.data;
        const r = rhs.data;

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
     * Reports whether the specified matrix is the identity matrix.
     *
     * @returns {boolean} True if the matrix is identity and false otherwise.
     * @example
     * const m = new pc.Mat3();
     * console.log("The matrix is " + (m.isIdentity() ? "identity" : "not identity"));
     */
    isIdentity() {
        const m = this.data;
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
     * Sets the matrix to the identity matrix.
     *
     * @returns {Mat3} Self for chaining.
     * @example
     * m.setIdentity();
     * console.log("The matrix is " + (m.isIdentity() ? "identity" : "not identity"));
     */
    setIdentity() {
        const m = this.data;
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
     * Converts the matrix to string form.
     *
     * @returns {string} The matrix in string form.
     * @example
     * const m = new pc.Mat3();
     * // Outputs [1, 0, 0, 0, 1, 0, 0, 0, 1]
     * console.log(m.toString());
     */
    toString() {
        return '[' + this.data.join(', ') + ']';
    }

    /**
     * Generates the transpose of the specified 3x3 matrix.
     *
     * @param {Mat3} [src] - The matrix to transpose. If not set, the matrix is transposed in-place.
     * @returns {Mat3} Self for chaining.
     * @example
     * const m = new pc.Mat3();
     *
     * // Transpose in place
     * m.transpose();
     */
    transpose(src = this) {
        const s = src.data;
        const t = this.data;

        if (s === t) {
            let tmp;
            tmp = s[1]; t[1] = s[3]; t[3] = tmp;
            tmp = s[2]; t[2] = s[6]; t[6] = tmp;
            tmp = s[5]; t[5] = s[7]; t[7] = tmp;
        } else {
            t[0] = s[0];
            t[1] = s[3];
            t[2] = s[6];
            t[3] = s[1];
            t[4] = s[4];
            t[5] = s[7];
            t[6] = s[2];
            t[7] = s[5];
            t[8] = s[8];
        }

        return this;
    }

    /**
     * Converts the specified 4x4 matrix to a Mat3.
     *
     * @param {import('./mat4.js').Mat4} m - The 4x4 matrix to convert.
     * @returns {Mat3} Self for chaining.
     */
    setFromMat4(m) {
        const src = m.data;
        const dst = this.data;

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
     * Set the matrix to the inverse of the specified 4x4 matrix.
     *
     * @param {import('./mat4.js').Mat4} src - The 4x4 matrix to invert.
     * @returns {Mat3} Self for chaining.
     *
     * @ignore
     */
    invertMat4(src) {
        const s = src.data;

        const a0 = s[0];
        const a1 = s[1];
        const a2 = s[2];

        const a4 = s[4];
        const a5 = s[5];
        const a6 = s[6];

        const a8 = s[8];
        const a9 = s[9];
        const a10 = s[10];

        const b11 =  a10 * a5 - a6 * a9;
        const b21 = -a10 * a1 + a2 * a9;
        const b31 =  a6  * a1 - a2 * a5;
        const b12 = -a10 * a4 + a6 * a8;
        const b22 =  a10 * a0 - a2 * a8;
        const b32 = -a6  * a0 + a2 * a4;
        const b13 =  a9  * a4 - a5 * a8;
        const b23 = -a9  * a0 + a1 * a8;
        const b33 =  a5  * a0 - a1 * a4;

        const det =  a0 * b11 + a1 * b12 + a2 * b13;
        if (det === 0) {
            this.setIdentity();
        } else {
            const invDet = 1 / det;
            const t = this.data;

            t[0] = b11 * invDet;
            t[1] = b21 * invDet;
            t[2] = b31 * invDet;
            t[3] = b12 * invDet;
            t[4] = b22 * invDet;
            t[5] = b32 * invDet;
            t[6] = b13 * invDet;
            t[7] = b23 * invDet;
            t[8] = b33 * invDet;
        }

        return this;
    }

    /**
     * Transforms a 3-dimensional vector by a 3x3 matrix.
     *
     * @param {Vec3} vec - The 3-dimensional vector to be transformed.
     * @param {Vec3} [res] - An optional 3-dimensional vector to receive the result of the
     * transformation.
     * @returns {Vec3} The input vector v transformed by the current instance.
     */
    transformVector(vec, res = new Vec3()) {
        const m = this.data;

        const x = vec.x;
        const y = vec.y;
        const z = vec.z;

        res.x = x * m[0] + y * m[3] + z * m[6];
        res.y = x * m[1] + y * m[4] + z * m[7];
        res.z = x * m[2] + y * m[5] + z * m[8];

        return res;
    }

    /**
     * A constant matrix set to the identity.
     *
     * @type {Mat3}
     * @readonly
     */
    static IDENTITY = Object.freeze(new Mat3());

    /**
     * A constant matrix with all elements set to 0.
     *
     * @type {Mat3}
     * @readonly
     */
    static ZERO = Object.freeze(new Mat3().set([0, 0, 0, 0, 0, 0, 0, 0, 0]));
}

export { Mat3 };

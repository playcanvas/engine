/**
 * 3-dimensional vector.
 *
 * @category Math
 */
class Vec3 {
    /**
     * The first component of the vector.
     *
     * @type {number}
     */
    x;

    /**
     * The second component of the vector.
     *
     * @type {number}
     */
    y;

    /**
     * The third component of the vector.
     *
     * @type {number}
     */
    z;

    /**
     * Creates a new Vec3 object.
     *
     * @param {number|number[]} [x] - The x value. Defaults to 0. If x is an array of length 3, the
     * array will be used to populate all components.
     * @param {number} [y] - The y value. Defaults to 0.
     * @param {number} [z] - The z value. Defaults to 0.
     * @example
     * const v = new pc.Vec3(1, 2, 3);
     */
    constructor(x = 0, y = 0, z = 0) {
        if (x.length === 3) {
            this.x = x[0];
            this.y = x[1];
            this.z = x[2];
        } else {
            this.x = x;
            this.y = y;
            this.z = z;
        }
    }

    /**
     * Adds a 3-dimensional vector to another in place.
     *
     * @param {Vec3} rhs - The vector to add to the specified vector.
     * @returns {Vec3} Self for chaining.
     * @example
     * const a = new pc.Vec3(10, 10, 10);
     * const b = new pc.Vec3(20, 20, 20);
     *
     * a.add(b);
     *
     * // Outputs [30, 30, 30]
     * console.log("The result of the addition is: " + a.toString());
     */
    add(rhs) {
        this.x += rhs.x;
        this.y += rhs.y;
        this.z += rhs.z;

        return this;
    }

    /**
     * Adds two 3-dimensional vectors together and returns the result.
     *
     * @param {Vec3} lhs - The first vector operand for the addition.
     * @param {Vec3} rhs - The second vector operand for the addition.
     * @returns {Vec3} Self for chaining.
     * @example
     * const a = new pc.Vec3(10, 10, 10);
     * const b = new pc.Vec3(20, 20, 20);
     * const r = new pc.Vec3();
     *
     * r.add2(a, b);
     * // Outputs [30, 30, 30]
     *
     * console.log("The result of the addition is: " + r.toString());
     */
    add2(lhs, rhs) {
        this.x = lhs.x + rhs.x;
        this.y = lhs.y + rhs.y;
        this.z = lhs.z + rhs.z;

        return this;
    }

    /**
     * Adds a number to each element of a vector.
     *
     * @param {number} scalar - The number to add.
     * @returns {Vec3} Self for chaining.
     * @example
     * const vec = new pc.Vec3(3, 4, 5);
     *
     * vec.addScalar(2);
     *
     * // Outputs [5, 6, 7]
     * console.log("The result of the addition is: " + vec.toString());
     */
    addScalar(scalar) {
        this.x += scalar;
        this.y += scalar;
        this.z += scalar;

        return this;
    }

    /**
     * Adds a 3-dimensional vector scaled by scalar value. Does not modify the vector being added.
     *
     * @param {Vec3} rhs - The vector to add to the specified vector.
     * @param {number} scalar - The number to multiply the added vector with.
     * @returns {Vec3} Self for chaining.
     * @example
     * const vec = new pc.Vec3(1, 2, 3);
     *
     * vec.addScaled(pc.Vec3.UP, 2);
     *
     * // Outputs [1, 4, 3]
     * console.log("The result of the addition is: " + vec.toString());
     */
    addScaled(rhs, scalar) {
        this.x += rhs.x * scalar;
        this.y += rhs.y * scalar;
        this.z += rhs.z * scalar;

        return this;
    }

    /**
     * Returns an identical copy of the specified 3-dimensional vector.
     *
     * @returns {this} A 3-dimensional vector containing the result of the cloning.
     * @example
     * const v = new pc.Vec3(10, 20, 30);
     * const vclone = v.clone();
     * console.log("The result of the cloning is: " + vclone.toString());
     */
    clone() {
        /** @type {this} */
        const cstr = this.constructor;
        return new cstr(this.x, this.y, this.z);
    }

    /**
     * Copies the contents of a source 3-dimensional vector to a destination 3-dimensional vector.
     *
     * @param {Vec3} rhs - A vector to copy to the specified vector.
     * @returns {Vec3} Self for chaining.
     * @example
     * const src = new pc.Vec3(10, 20, 30);
     * const dst = new pc.Vec3();
     *
     * dst.copy(src);
     *
     * console.log("The two vectors are " + (dst.equals(src) ? "equal" : "different"));
     */
    copy(rhs) {
        this.x = rhs.x;
        this.y = rhs.y;
        this.z = rhs.z;

        return this;
    }

    /**
     * Returns the result of a cross product operation performed on the two specified 3-dimensional
     * vectors.
     *
     * @param {Vec3} lhs - The first 3-dimensional vector operand of the cross product.
     * @param {Vec3} rhs - The second 3-dimensional vector operand of the cross product.
     * @returns {Vec3} Self for chaining.
     * @example
     * const back = new pc.Vec3().cross(pc.Vec3.RIGHT, pc.Vec3.UP);
     *
     * // Prints the Z axis (i.e. [0, 0, 1])
     * console.log("The result of the cross product is: " + back.toString());
     */
    cross(lhs, rhs) {
        // Create temporary variables in case lhs or rhs are 'this'
        const lx = lhs.x;
        const ly = lhs.y;
        const lz = lhs.z;
        const rx = rhs.x;
        const ry = rhs.y;
        const rz = rhs.z;

        this.x = ly * rz - ry * lz;
        this.y = lz * rx - rz * lx;
        this.z = lx * ry - rx * ly;

        return this;
    }

    /**
     * Returns the distance between the two specified 3-dimensional vectors.
     *
     * @param {Vec3} rhs - The second 3-dimensional vector to test.
     * @returns {number} The distance between the two vectors.
     * @example
     * const v1 = new pc.Vec3(5, 10, 20);
     * const v2 = new pc.Vec3(10, 20, 40);
     * const d = v1.distance(v2);
     * console.log("The distance between v1 and v2 is: " + d);
     */
    distance(rhs) {
        const x = this.x - rhs.x;
        const y = this.y - rhs.y;
        const z = this.z - rhs.z;
        return Math.sqrt(x * x + y * y + z * z);
    }

    /**
     * Divides a 3-dimensional vector by another in place.
     *
     * @param {Vec3} rhs - The vector to divide the specified vector by.
     * @returns {Vec3} Self for chaining.
     * @example
     * const a = new pc.Vec3(4, 9, 16);
     * const b = new pc.Vec3(2, 3, 4);
     *
     * a.div(b);
     *
     * // Outputs [2, 3, 4]
     * console.log("The result of the division is: " + a.toString());
     */
    div(rhs) {
        this.x /= rhs.x;
        this.y /= rhs.y;
        this.z /= rhs.z;

        return this;
    }

    /**
     * Divides one 3-dimensional vector by another and writes the result to the specified vector.
     *
     * @param {Vec3} lhs - The dividend vector (the vector being divided).
     * @param {Vec3} rhs - The divisor vector (the vector dividing the dividend).
     * @returns {Vec3} Self for chaining.
     * @example
     * const a = new pc.Vec3(4, 9, 16);
     * const b = new pc.Vec3(2, 3, 4);
     * const r = new pc.Vec3();
     *
     * r.div2(a, b);
     * // Outputs [2, 3, 4]
     *
     * console.log("The result of the division is: " + r.toString());
     */
    div2(lhs, rhs) {
        this.x = lhs.x / rhs.x;
        this.y = lhs.y / rhs.y;
        this.z = lhs.z / rhs.z;

        return this;
    }

    /**
     * Divides each element of a vector by a number.
     *
     * @param {number} scalar - The number to divide by.
     * @returns {Vec3} Self for chaining.
     * @example
     * const vec = new pc.Vec3(3, 6, 9);
     *
     * vec.divScalar(3);
     *
     * // Outputs [1, 2, 3]
     * console.log("The result of the division is: " + vec.toString());
     */
    divScalar(scalar) {
        this.x /= scalar;
        this.y /= scalar;
        this.z /= scalar;

        return this;
    }

    /**
     * Returns the result of a dot product operation performed on the two specified 3-dimensional
     * vectors.
     *
     * @param {Vec3} rhs - The second 3-dimensional vector operand of the dot product.
     * @returns {number} The result of the dot product operation.
     * @example
     * const v1 = new pc.Vec3(5, 10, 20);
     * const v2 = new pc.Vec3(10, 20, 40);
     * const v1dotv2 = v1.dot(v2);
     * console.log("The result of the dot product is: " + v1dotv2);
     */
    dot(rhs) {
        return this.x * rhs.x + this.y * rhs.y + this.z * rhs.z;
    }

    /**
     * Reports whether two vectors are equal.
     *
     * @param {Vec3} rhs - The vector to compare to the specified vector.
     * @returns {boolean} True if the vectors are equal and false otherwise.
     * @example
     * const a = new pc.Vec3(1, 2, 3);
     * const b = new pc.Vec3(4, 5, 6);
     * console.log("The two vectors are " + (a.equals(b) ? "equal" : "different"));
     */
    equals(rhs) {
        return this.x === rhs.x && this.y === rhs.y && this.z === rhs.z;
    }

    /**
     * Reports whether two vectors are equal using an absolute error tolerance.
     *
     * @param {Vec3} rhs - The vector to be compared against.
     * @param {number} [epsilon] - The maximum difference between each component of the two
     * vectors. Defaults to 1e-6.
     * @returns {boolean} True if the vectors are equal and false otherwise.
     * @example
     * const a = new pc.Vec3();
     * const b = new pc.Vec3();
     * console.log("The two vectors are approximately " + (a.equalsApprox(b, 1e-9) ? "equal" : "different"));
     */
    equalsApprox(rhs, epsilon = 1e-6) {
        return (Math.abs(this.x - rhs.x) < epsilon) &&
            (Math.abs(this.y - rhs.y) < epsilon) &&
            (Math.abs(this.z - rhs.z) < epsilon);
    }

    /**
     * Returns the magnitude of the specified 3-dimensional vector.
     *
     * @returns {number} The magnitude of the specified 3-dimensional vector.
     * @example
     * const vec = new pc.Vec3(3, 4, 0);
     * const len = vec.length();
     * // Outputs 5
     * console.log("The length of the vector is: " + len);
     */
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    /**
     * Returns the magnitude squared of the specified 3-dimensional vector.
     *
     * @returns {number} The magnitude of the specified 3-dimensional vector.
     * @example
     * const vec = new pc.Vec3(3, 4, 0);
     * const len = vec.lengthSq();
     * // Outputs 25
     * console.log("The length squared of the vector is: " + len);
     */
    lengthSq() {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    /**
     * Returns the result of a linear interpolation between two specified 3-dimensional vectors.
     *
     * @param {Vec3} lhs - The 3-dimensional to interpolate from.
     * @param {Vec3} rhs - The 3-dimensional to interpolate to.
     * @param {number} alpha - The value controlling the point of interpolation. Between 0 and 1,
     * the linear interpolant will occur on a straight line between lhs and rhs. Outside of this
     * range, the linear interpolant will occur on a ray extrapolated from this line.
     * @returns {Vec3} Self for chaining.
     * @example
     * const a = new pc.Vec3(0, 0, 0);
     * const b = new pc.Vec3(10, 10, 10);
     * const r = new pc.Vec3();
     *
     * r.lerp(a, b, 0);   // r is equal to a
     * r.lerp(a, b, 0.5); // r is 5, 5, 5
     * r.lerp(a, b, 1);   // r is equal to b
     */
    lerp(lhs, rhs, alpha) {
        this.x = lhs.x + alpha * (rhs.x - lhs.x);
        this.y = lhs.y + alpha * (rhs.y - lhs.y);
        this.z = lhs.z + alpha * (rhs.z - lhs.z);

        return this;
    }

    /**
     * Multiplies a 3-dimensional vector to another in place.
     *
     * @param {Vec3} rhs - The 3-dimensional vector used as the second multiplicand of the operation.
     * @returns {Vec3} Self for chaining.
     * @example
     * const a = new pc.Vec3(2, 3, 4);
     * const b = new pc.Vec3(4, 5, 6);
     *
     * a.mul(b);
     *
     * // Outputs [8, 15, 24]
     * console.log("The result of the multiplication is: " + a.toString());
     */
    mul(rhs) {
        this.x *= rhs.x;
        this.y *= rhs.y;
        this.z *= rhs.z;

        return this;
    }

    /**
     * Returns the result of multiplying the specified 3-dimensional vectors together.
     *
     * @param {Vec3} lhs - The 3-dimensional vector used as the first multiplicand of the operation.
     * @param {Vec3} rhs - The 3-dimensional vector used as the second multiplicand of the operation.
     * @returns {Vec3} Self for chaining.
     * @example
     * const a = new pc.Vec3(2, 3, 4);
     * const b = new pc.Vec3(4, 5, 6);
     * const r = new pc.Vec3();
     *
     * r.mul2(a, b);
     *
     * // Outputs [8, 15, 24]
     * console.log("The result of the multiplication is: " + r.toString());
     */
    mul2(lhs, rhs) {
        this.x = lhs.x * rhs.x;
        this.y = lhs.y * rhs.y;
        this.z = lhs.z * rhs.z;

        return this;
    }

    /**
     * Multiplies each element of a vector by a number.
     *
     * @param {number} scalar - The number to multiply by.
     * @returns {Vec3} Self for chaining.
     * @example
     * const vec = new pc.Vec3(3, 6, 9);
     *
     * vec.mulScalar(3);
     *
     * // Outputs [9, 18, 27]
     * console.log("The result of the multiplication is: " + vec.toString());
     */
    mulScalar(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        this.z *= scalar;

        return this;
    }

    /**
     * Returns this 3-dimensional vector converted to a unit vector in place. If the vector has a
     * length of zero, the vector's elements will be set to zero.
     *
     * @param {Vec3} [src] - The vector to normalize. If not set, the operation is done in place.
     * @returns {Vec3} Self for chaining.
     * @example
     * const v = new pc.Vec3(25, 0, 0);
     *
     * v.normalize();
     *
     * // Outputs [1, 0, 0]
     * console.log("The result of the vector normalization is: " + v.toString());
     */
    normalize(src = this) {
        const lengthSq = src.x * src.x + src.y * src.y + src.z * src.z;
        if (lengthSq > 0) {
            const invLength = 1 / Math.sqrt(lengthSq);
            this.x = src.x * invLength;
            this.y = src.y * invLength;
            this.z = src.z * invLength;
        }

        return this;
    }

    /**
     * Each element is set to the largest integer less than or equal to its value.
     *
     * @param {Vec3} [src] - The vector to floor. If not set, the operation is done in place.
     * @returns {Vec3} Self for chaining.
     */
    floor(src = this) {
        this.x = Math.floor(src.x);
        this.y = Math.floor(src.y);
        this.z = Math.floor(src.z);
        return this;
    }

    /**
     * Each element is rounded up to the next largest integer.
     *
     * @param {Vec3} [src] - The vector to ceil. If not set, the operation is done in place.
     * @returns {Vec3} Self for chaining.
     */
    ceil(src = this) {
        this.x = Math.ceil(src.x);
        this.y = Math.ceil(src.y);
        this.z = Math.ceil(src.z);
        return this;
    }

    /**
     * Each element is rounded up or down to the nearest integer.
     *
     * @param {Vec3} [src] - The vector to round. If not set, the operation is done in place.
     * @returns {Vec3} Self for chaining.
     */
    round(src = this) {
        this.x = Math.round(src.x);
        this.y = Math.round(src.y);
        this.z = Math.round(src.z);
        return this;
    }

    /**
     * Each element is assigned a value from rhs parameter if it is smaller.
     *
     * @param {Vec3} rhs - The 3-dimensional vector used as the source of elements to compare to.
     * @returns {Vec3} Self for chaining.
     */
    min(rhs) {
        if (rhs.x < this.x) this.x = rhs.x;
        if (rhs.y < this.y) this.y = rhs.y;
        if (rhs.z < this.z) this.z = rhs.z;
        return this;
    }

    /**
     * Each element is assigned a value from rhs parameter if it is larger.
     *
     * @param {Vec3} rhs - The 3-dimensional vector used as the source of elements to compare to.
     * @returns {Vec3} Self for chaining.
     */
    max(rhs) {
        if (rhs.x > this.x) this.x = rhs.x;
        if (rhs.y > this.y) this.y = rhs.y;
        if (rhs.z > this.z) this.z = rhs.z;
        return this;
    }

    /**
     * Projects this 3-dimensional vector onto the specified vector.
     *
     * @param {Vec3} rhs - The vector onto which the original vector will be projected on.
     * @returns {Vec3} Self for chaining.
     * @example
     * const v = new pc.Vec3(5, 5, 5);
     * const normal = new pc.Vec3(1, 0, 0);
     *
     * v.project(normal);
     *
     * // Outputs [5, 0, 0]
     * console.log("The result of the vector projection is: " + v.toString());
     */
    project(rhs) {
        const a_dot_b = this.x * rhs.x + this.y * rhs.y + this.z * rhs.z;
        const b_dot_b = rhs.x * rhs.x + rhs.y * rhs.y + rhs.z * rhs.z;
        const s = a_dot_b / b_dot_b;
        this.x = rhs.x * s;
        this.y = rhs.y * s;
        this.z = rhs.z * s;
        return this;
    }

    /**
     * Sets the specified 3-dimensional vector to the supplied numerical values.
     *
     * @param {number} x - The value to set on the first component of the vector.
     * @param {number} y - The value to set on the second component of the vector.
     * @param {number} z - The value to set on the third component of the vector.
     * @returns {Vec3} Self for chaining.
     * @example
     * const v = new pc.Vec3();
     * v.set(5, 10, 20);
     *
     * // Outputs [5, 10, 20]
     * console.log("The result of the vector set is: " + v.toString());
     */
    set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;

        return this;
    }

    /**
     * Subtracts a 3-dimensional vector from another in place.
     *
     * @param {Vec3} rhs - The vector to subtract from the specified vector.
     * @returns {Vec3} Self for chaining.
     * @example
     * const a = new pc.Vec3(10, 10, 10);
     * const b = new pc.Vec3(20, 20, 20);
     *
     * a.sub(b);
     *
     * // Outputs [-10, -10, -10]
     * console.log("The result of the subtraction is: " + a.toString());
     */
    sub(rhs) {
        this.x -= rhs.x;
        this.y -= rhs.y;
        this.z -= rhs.z;

        return this;
    }

    /**
     * Subtracts two 3-dimensional vectors from one another and returns the result.
     *
     * @param {Vec3} lhs - The first vector operand for the subtraction.
     * @param {Vec3} rhs - The second vector operand for the subtraction.
     * @returns {Vec3} Self for chaining.
     * @example
     * const a = new pc.Vec3(10, 10, 10);
     * const b = new pc.Vec3(20, 20, 20);
     * const r = new pc.Vec3();
     *
     * r.sub2(a, b);
     *
     * // Outputs [-10, -10, -10]
     * console.log("The result of the subtraction is: " + r.toString());
     */
    sub2(lhs, rhs) {
        this.x = lhs.x - rhs.x;
        this.y = lhs.y - rhs.y;
        this.z = lhs.z - rhs.z;

        return this;
    }

    /**
     * Subtracts a number from each element of a vector.
     *
     * @param {number} scalar - The number to subtract.
     * @returns {Vec3} Self for chaining.
     * @example
     * const vec = new pc.Vec3(3, 4, 5);
     *
     * vec.subScalar(2);
     *
     * // Outputs [1, 2, 3]
     * console.log("The result of the subtraction is: " + vec.toString());
     */
    subScalar(scalar) {
        this.x -= scalar;
        this.y -= scalar;
        this.z -= scalar;

        return this;
    }

    /**
     * Converts the vector to string form.
     *
     * @returns {string} The vector in string form.
     * @example
     * const v = new pc.Vec3(20, 10, 5);
     * // Outputs [20, 10, 5]
     * console.log(v.toString());
     */
    toString() {
        return `[${this.x}, ${this.y}, ${this.z}]`;
    }

    /**
     * A constant vector set to [0, 0, 0].
     *
     * @type {Vec3}
     * @readonly
     */
    static ZERO = Object.freeze(new Vec3(0, 0, 0));

    /**
     * A constant vector set to [1, 1, 1].
     *
     * @type {Vec3}
     * @readonly
     */
    static ONE = Object.freeze(new Vec3(1, 1, 1));

    /**
     * A constant vector set to [0, 1, 0].
     *
     * @type {Vec3}
     * @readonly
     */
    static UP = Object.freeze(new Vec3(0, 1, 0));

    /**
     * A constant vector set to [0, -1, 0].
     *
     * @type {Vec3}
     * @readonly
     */
    static DOWN = Object.freeze(new Vec3(0, -1, 0));

    /**
     * A constant vector set to [1, 0, 0].
     *
     * @type {Vec3}
     * @readonly
     */
    static RIGHT = Object.freeze(new Vec3(1, 0, 0));

    /**
     * A constant vector set to [-1, 0, 0].
     *
     * @type {Vec3}
     * @readonly
     */
    static LEFT = Object.freeze(new Vec3(-1, 0, 0));

    /**
     * A constant vector set to [0, 0, -1].
     *
     * @type {Vec3}
     * @readonly
     */
    static FORWARD = Object.freeze(new Vec3(0, 0, -1));

    /**
     * A constant vector set to [0, 0, 1].
     *
     * @type {Vec3}
     * @readonly
     */
    static BACK = Object.freeze(new Vec3(0, 0, 1));
}

export { Vec3 };

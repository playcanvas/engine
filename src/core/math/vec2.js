import { math } from './math.js';

/**
 * A 2-dimensional vector.
 *
 * @category Math
 */
class Vec2 {
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
     * Create a new Vec2 instance.
     *
     * @param {number|number[]} [x] - The x value. Defaults to 0. If x is an array of length 2, the
     * array will be used to populate all components.
     * @param {number} [y] - The y value. Defaults to 0.
     * @example
     * const v = new pc.Vec2(1, 2);
     */
    constructor(x = 0, y = 0) {
        if (x.length === 2) {
            this.x = x[0];
            this.y = x[1];
        } else {
            this.x = x;
            this.y = y;
        }
    }

    /**
     * Adds a 2-dimensional vector to another in place.
     *
     * @param {Vec2} rhs - The vector to add to the specified vector.
     * @returns {Vec2} Self for chaining.
     * @example
     * const a = new pc.Vec2(10, 10);
     * const b = new pc.Vec2(20, 20);
     *
     * a.add(b);
     *
     * // Outputs [30, 30]
     * console.log("The result of the addition is: " + a.toString());
     */
    add(rhs) {
        this.x += rhs.x;
        this.y += rhs.y;

        return this;
    }

    /**
     * Adds two 2-dimensional vectors together and returns the result.
     *
     * @param {Vec2} lhs - The first vector operand for the addition.
     * @param {Vec2} rhs - The second vector operand for the addition.
     * @returns {Vec2} Self for chaining.
     * @example
     * const a = new pc.Vec2(10, 10);
     * const b = new pc.Vec2(20, 20);
     * const r = new pc.Vec2();
     *
     * r.add2(a, b);
     * // Outputs [30, 30]
     *
     * console.log("The result of the addition is: " + r.toString());
     */
    add2(lhs, rhs) {
        this.x = lhs.x + rhs.x;
        this.y = lhs.y + rhs.y;

        return this;
    }

    /**
     * Adds a number to each element of a vector.
     *
     * @param {number} scalar - The number to add.
     * @returns {Vec2} Self for chaining.
     * @example
     * const vec = new pc.Vec2(3, 4);
     *
     * vec.addScalar(2);
     *
     * // Outputs [5, 6]
     * console.log("The result of the addition is: " + vec.toString());
     */
    addScalar(scalar) {
        this.x += scalar;
        this.y += scalar;

        return this;
    }

    /**
     * Adds a 2-dimensional vector scaled by scalar value. Does not modify the vector being added.
     *
     * @param {Vec2} rhs - The vector to add to the specified vector.
     * @param {number} scalar - The number to multiply the added vector with.
     * @returns {Vec2} Self for chaining.
     * @example
     * const vec = new pc.Vec2(1, 2);
     *
     * vec.addScaled(pc.Vec2.UP, 2);
     *
     * // Outputs [1, 4]
     * console.log("The result of the addition is: " + vec.toString());
     */
    addScaled(rhs, scalar) {
        this.x += rhs.x * scalar;
        this.y += rhs.y * scalar;

        return this;
    }

    /**
     * Returns an identical copy of the specified 2-dimensional vector.
     *
     * @returns {this} A 2-dimensional vector containing the result of the cloning.
     * @example
     * const v = new pc.Vec2(10, 20);
     * const vclone = v.clone();
     * console.log("The result of the cloning is: " + vclone.toString());
     */
    clone() {
        /** @type {this} */
        const cstr = this.constructor;
        return new cstr(this.x, this.y);
    }

    /**
     * Copies the contents of a source 2-dimensional vector to a destination 2-dimensional vector.
     *
     * @param {Vec2} rhs - A vector to copy to the specified vector.
     * @returns {Vec2} Self for chaining.
     * @example
     * const src = new pc.Vec2(10, 20);
     * const dst = new pc.Vec2();
     *
     * dst.copy(src);
     *
     * console.log("The two vectors are " + (dst.equals(src) ? "equal" : "different"));
     */
    copy(rhs) {
        this.x = rhs.x;
        this.y = rhs.y;

        return this;
    }

    /**
     * Returns the result of a cross product operation performed on the two specified 2-dimensional
     * vectors.
     *
     * @param {Vec2} rhs - The second 2-dimensional vector operand of the cross product.
     * @returns {number} The cross product of the two vectors.
     * @example
     * const right = new pc.Vec2(1, 0);
     * const up = new pc.Vec2(0, 1);
     * const crossProduct = right.cross(up);
     *
     * // Prints 1
     * console.log("The result of the cross product is: " + crossProduct);
     */
    cross(rhs) {
        return this.x * rhs.y - this.y * rhs.x;
    }

    /**
     * Returns the distance between the two specified 2-dimensional vectors.
     *
     * @param {Vec2} rhs - The second 2-dimensional vector to test.
     * @returns {number} The distance between the two vectors.
     * @example
     * const v1 = new pc.Vec2(5, 10);
     * const v2 = new pc.Vec2(10, 20);
     * const d = v1.distance(v2);
     * console.log("The distance between v1 and v2 is: " + d);
     */
    distance(rhs) {
        const x = this.x - rhs.x;
        const y = this.y - rhs.y;
        return Math.sqrt(x * x + y * y);
    }

    /**
     * Divides a 2-dimensional vector by another in place.
     *
     * @param {Vec2} rhs - The vector to divide the specified vector by.
     * @returns {Vec2} Self for chaining.
     * @example
     * const a = new pc.Vec2(4, 9);
     * const b = new pc.Vec2(2, 3);
     *
     * a.div(b);
     *
     * // Outputs [2, 3]
     * console.log("The result of the division is: " + a.toString());
     */
    div(rhs) {
        this.x /= rhs.x;
        this.y /= rhs.y;

        return this;
    }

    /**
     * Divides one 2-dimensional vector by another and writes the result to the specified vector.
     *
     * @param {Vec2} lhs - The dividend vector (the vector being divided).
     * @param {Vec2} rhs - The divisor vector (the vector dividing the dividend).
     * @returns {Vec2} Self for chaining.
     * @example
     * const a = new pc.Vec2(4, 9);
     * const b = new pc.Vec2(2, 3);
     * const r = new pc.Vec2();
     *
     * r.div2(a, b);
     * // Outputs [2, 3]
     *
     * console.log("The result of the division is: " + r.toString());
     */
    div2(lhs, rhs) {
        this.x = lhs.x / rhs.x;
        this.y = lhs.y / rhs.y;

        return this;
    }

    /**
     * Divides each element of a vector by a number.
     *
     * @param {number} scalar - The number to divide by.
     * @returns {Vec2} Self for chaining.
     * @example
     * const vec = new pc.Vec2(3, 6);
     *
     * vec.divScalar(3);
     *
     * // Outputs [1, 2]
     * console.log("The result of the division is: " + vec.toString());
     */
    divScalar(scalar) {
        this.x /= scalar;
        this.y /= scalar;

        return this;
    }

    /**
     * Returns the result of a dot product operation performed on the two specified 2-dimensional
     * vectors.
     *
     * @param {Vec2} rhs - The second 2-dimensional vector operand of the dot product.
     * @returns {number} The result of the dot product operation.
     * @example
     * const v1 = new pc.Vec2(5, 10);
     * const v2 = new pc.Vec2(10, 20);
     * const v1dotv2 = v1.dot(v2);
     * console.log("The result of the dot product is: " + v1dotv2);
     */
    dot(rhs) {
        return this.x * rhs.x + this.y * rhs.y;
    }

    /**
     * Reports whether two vectors are equal.
     *
     * @param {Vec2} rhs - The vector to compare to the specified vector.
     * @returns {boolean} True if the vectors are equal and false otherwise.
     * @example
     * const a = new pc.Vec2(1, 2);
     * const b = new pc.Vec2(4, 5);
     * console.log("The two vectors are " + (a.equals(b) ? "equal" : "different"));
     */
    equals(rhs) {
        return this.x === rhs.x && this.y === rhs.y;
    }

    /**
     * Reports whether two vectors are equal using an absolute error tolerance.
     *
     * @param {Vec2} rhs - The vector to be compared against.
     * @param {number} [epsilon] - The maximum difference between each component of the two
     * vectors. Defaults to 1e-6.
     * @returns {boolean} True if the vectors are equal and false otherwise.
     * @example
     * const a = new pc.Vec2();
     * const b = new pc.Vec2();
     * console.log("The two vectors are approximately " + (a.equalsApprox(b, 1e-9) ? "equal" : "different"));
     */
    equalsApprox(rhs, epsilon = 1e-6) {
        return (Math.abs(this.x - rhs.x) < epsilon) &&
            (Math.abs(this.y - rhs.y) < epsilon);
    }

    /**
     * Returns the magnitude of the specified 2-dimensional vector.
     *
     * @returns {number} The magnitude of the specified 2-dimensional vector.
     * @example
     * const vec = new pc.Vec2(3, 4);
     * const len = vec.length();
     * // Outputs 5
     * console.log("The length of the vector is: " + len);
     */
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    /**
     * Returns the magnitude squared of the specified 2-dimensional vector.
     *
     * @returns {number} The magnitude of the specified 2-dimensional vector.
     * @example
     * const vec = new pc.Vec2(3, 4);
     * const len = vec.lengthSq();
     * // Outputs 25
     * console.log("The length squared of the vector is: " + len);
     */
    lengthSq() {
        return this.x * this.x + this.y * this.y;
    }

    /**
     * Returns the result of a linear interpolation between two specified 2-dimensional vectors.
     *
     * @param {Vec2} lhs - The 2-dimensional to interpolate from.
     * @param {Vec2} rhs - The 2-dimensional to interpolate to.
     * @param {number} alpha - The value controlling the point of interpolation. Between 0 and 1,
     * the linear interpolant will occur on a straight line between lhs and rhs. Outside of this
     * range, the linear interpolant will occur on a ray extrapolated from this line.
     * @returns {Vec2} Self for chaining.
     * @example
     * const a = new pc.Vec2(0, 0);
     * const b = new pc.Vec2(10, 10);
     * const r = new pc.Vec2();
     *
     * r.lerp(a, b, 0);   // r is equal to a
     * r.lerp(a, b, 0.5); // r is 5, 5
     * r.lerp(a, b, 1);   // r is equal to b
     */
    lerp(lhs, rhs, alpha) {
        this.x = lhs.x + alpha * (rhs.x - lhs.x);
        this.y = lhs.y + alpha * (rhs.y - lhs.y);

        return this;
    }

    /**
     * Multiplies a 2-dimensional vector to another in place.
     *
     * @param {Vec2} rhs - The 2-dimensional vector used as the second multiplicand of the operation.
     * @returns {Vec2} Self for chaining.
     * @example
     * const a = new pc.Vec2(2, 3);
     * const b = new pc.Vec2(4, 5);
     *
     * a.mul(b);
     *
     * // Outputs 8, 15
     * console.log("The result of the multiplication is: " + a.toString());
     */
    mul(rhs) {
        this.x *= rhs.x;
        this.y *= rhs.y;

        return this;
    }

    /**
     * Returns the result of multiplying the specified 2-dimensional vectors together.
     *
     * @param {Vec2} lhs - The 2-dimensional vector used as the first multiplicand of the operation.
     * @param {Vec2} rhs - The 2-dimensional vector used as the second multiplicand of the operation.
     * @returns {Vec2} Self for chaining.
     * @example
     * const a = new pc.Vec2(2, 3);
     * const b = new pc.Vec2(4, 5);
     * const r = new pc.Vec2();
     *
     * r.mul2(a, b);
     *
     * // Outputs 8, 15
     * console.log("The result of the multiplication is: " + r.toString());
     */
    mul2(lhs, rhs) {
        this.x = lhs.x * rhs.x;
        this.y = lhs.y * rhs.y;

        return this;
    }

    /**
     * Multiplies each element of a vector by a number.
     *
     * @param {number} scalar - The number to multiply by.
     * @returns {Vec2} Self for chaining.
     * @example
     * const vec = new pc.Vec2(3, 6);
     *
     * vec.mulScalar(3);
     *
     * // Outputs [9, 18]
     * console.log("The result of the multiplication is: " + vec.toString());
     */
    mulScalar(scalar) {
        this.x *= scalar;
        this.y *= scalar;

        return this;
    }

    /**
     * Returns this 2-dimensional vector converted to a unit vector in place. If the vector has a
     * length of zero, the vector's elements will be set to zero.
     *
     * @param {Vec2} [src] - The vector to normalize. If not set, the operation is done in place.
     * @returns {Vec2} Self for chaining.
     * @example
     * const v = new pc.Vec2(25, 0);
     *
     * v.normalize();
     *
     * // Outputs 1, 0
     * console.log("The result of the vector normalization is: " + v.toString());
     */
    normalize(src = this) {
        const lengthSq = src.x * src.x + src.y * src.y;
        if (lengthSq > 0) {
            const invLength = 1 / Math.sqrt(lengthSq);
            this.x = src.x * invLength;
            this.y = src.y * invLength;
        }

        return this;
    }

    /**
     * Rotate a vector by an angle in degrees.
     *
     * @param {number} degrees - The number to degrees to rotate the vector by.
     * @returns {Vec2} Self for chaining.
     * @example
     * const v = new pc.Vec2(0, 10);
     *
     * v.rotate(45); // rotates by 45 degrees
     *
     * // Outputs [7.071068.., 7.071068..]
     * console.log("Vector after rotation is: " + v.toString());
     */
    rotate(degrees) {
        const angle = Math.atan2(this.x, this.y) + (degrees * math.DEG_TO_RAD);
        const len = Math.sqrt(this.x * this.x + this.y * this.y);
        this.x = Math.sin(angle) * len;
        this.y = Math.cos(angle) * len;
        return this;
    }

    /**
     * Returns the angle in degrees of the specified 2-dimensional vector.
     *
     * @returns {number} The angle in degrees of the specified 2-dimensional vector.
     * @example
     * const v = new pc.Vec2(6, 0);
     * const angle = v.angle();
     * // Outputs 90..
     * console.log("The angle of the vector is: " + angle);
     */
    angle() {
        return Math.atan2(this.x, this.y) * math.RAD_TO_DEG;
    }

    /**
     * Returns the shortest Euler angle between two 2-dimensional vectors.
     *
     * @param {Vec2} rhs - The 2-dimensional vector to calculate angle to.
     * @returns {number} The shortest angle in degrees between two 2-dimensional vectors.
     * @example
     * const a = new pc.Vec2(0, 10); // up
     * const b = new pc.Vec2(1, -1); // down-right
     * const angle = a.angleTo(b);
     * // Outputs 135..
     * console.log("The angle between vectors a and b: " + angle);
     */
    angleTo(rhs) {
        return Math.atan2(this.x * rhs.y + this.y * rhs.x, this.x * rhs.x + this.y * rhs.y) * math.RAD_TO_DEG;
    }

    /**
     * Each element is set to the largest integer less than or equal to its value.
     *
     * @param {Vec2} [src] - The vector to floor. If not set, the operation is done in place.
     * @returns {Vec2} Self for chaining.
     */
    floor(src = this) {
        this.x = Math.floor(src.x);
        this.y = Math.floor(src.y);
        return this;
    }

    /**
     * Each element is rounded up to the next largest integer.
     *
     * @param {Vec2} [src] - The vector to ceil. If not set, the operation is done in place.
     * @returns {Vec2} Self for chaining.
     */
    ceil(src = this) {
        this.x = Math.ceil(src.x);
        this.y = Math.ceil(src.y);
        return this;
    }

    /**
     * Each element is rounded up or down to the nearest integer.
     *
     * @param {Vec2} [src] - The vector to round. If not set, the operation is done in place.
     * @returns {Vec2} Self for chaining.
     */
    round(src = this) {
        this.x = Math.round(src.x);
        this.y = Math.round(src.y);
        return this;
    }

    /**
     * Each element is assigned a value from rhs parameter if it is smaller.
     *
     * @param {Vec2} rhs - The 2-dimensional vector used as the source of elements to compare to.
     * @returns {Vec2} Self for chaining.
     */
    min(rhs) {
        if (rhs.x < this.x) this.x = rhs.x;
        if (rhs.y < this.y) this.y = rhs.y;
        return this;
    }

    /**
     * Each element is assigned a value from rhs parameter if it is larger.
     *
     * @param {Vec2} rhs - The 2-dimensional vector used as the source of elements to compare to.
     * @returns {Vec2} Self for chaining.
     */
    max(rhs) {
        if (rhs.x > this.x) this.x = rhs.x;
        if (rhs.y > this.y) this.y = rhs.y;
        return this;
    }

    /**
     * Sets the specified 2-dimensional vector to the supplied numerical values.
     *
     * @param {number} x - The value to set on the first component of the vector.
     * @param {number} y - The value to set on the second component of the vector.
     * @returns {Vec2} Self for chaining.
     * @example
     * const v = new pc.Vec2();
     * v.set(5, 10);
     *
     * // Outputs 5, 10
     * console.log("The result of the vector set is: " + v.toString());
     */
    set(x, y) {
        this.x = x;
        this.y = y;

        return this;
    }

    /**
     * Subtracts a 2-dimensional vector from another in place.
     *
     * @param {Vec2} rhs - The vector to subtract from the specified vector.
     * @returns {Vec2} Self for chaining.
     * @example
     * const a = new pc.Vec2(10, 10);
     * const b = new pc.Vec2(20, 20);
     *
     * a.sub(b);
     *
     * // Outputs [-10, -10]
     * console.log("The result of the subtraction is: " + a.toString());
     */
    sub(rhs) {
        this.x -= rhs.x;
        this.y -= rhs.y;

        return this;
    }

    /**
     * Subtracts two 2-dimensional vectors from one another and returns the result.
     *
     * @param {Vec2} lhs - The first vector operand for the subtraction.
     * @param {Vec2} rhs - The second vector operand for the subtraction.
     * @returns {Vec2} Self for chaining.
     * @example
     * const a = new pc.Vec2(10, 10);
     * const b = new pc.Vec2(20, 20);
     * const r = new pc.Vec2();
     *
     * r.sub2(a, b);
     *
     * // Outputs [-10, -10]
     * console.log("The result of the subtraction is: " + r.toString());
     */
    sub2(lhs, rhs) {
        this.x = lhs.x - rhs.x;
        this.y = lhs.y - rhs.y;

        return this;
    }

    /**
     * Subtracts a number from each element of a vector.
     *
     * @param {number} scalar - The number to subtract.
     * @returns {Vec2} Self for chaining.
     * @example
     * const vec = new pc.Vec2(3, 4);
     *
     * vec.subScalar(2);
     *
     * // Outputs [1, 2]
     * console.log("The result of the subtraction is: " + vec.toString());
     */
    subScalar(scalar) {
        this.x -= scalar;
        this.y -= scalar;

        return this;
    }

    /**
     * Converts the vector to string form.
     *
     * @returns {string} The vector in string form.
     * @example
     * const v = new pc.Vec2(20, 10);
     * // Outputs [20, 10]
     * console.log(v.toString());
     */
    toString() {
        return `[${this.x}, ${this.y}]`;
    }

    /**
     * Calculates the angle between two Vec2's in radians.
     *
     * @param {Vec2} lhs - The first vector operand for the calculation.
     * @param {Vec2} rhs - The second vector operand for the calculation.
     * @returns {number} The calculated angle in radians.
     * @ignore
     */
    static angleRad(lhs, rhs) {
        return Math.atan2(lhs.x * rhs.y - lhs.y * rhs.x, lhs.x * rhs.x + lhs.y * rhs.y);
    }

    /**
     * A constant vector set to [0, 0].
     *
     * @type {Vec2}
     * @readonly
     */
    static ZERO = Object.freeze(new Vec2(0, 0));

    /**
     * A constant vector set to [1, 1].
     *
     * @type {Vec2}
     * @readonly
     */
    static ONE = Object.freeze(new Vec2(1, 1));

    /**
     * A constant vector set to [0, 1].
     *
     * @type {Vec2}
     * @readonly
     */
    static UP = Object.freeze(new Vec2(0, 1));

    /**
     * A constant vector set to [0, -1].
     *
     * @type {Vec2}
     * @readonly
     */
    static DOWN = Object.freeze(new Vec2(0, -1));

    /**
     * A constant vector set to [1, 0].
     *
     * @type {Vec2}
     * @readonly
     */
    static RIGHT = Object.freeze(new Vec2(1, 0));

    /**
     * A constant vector set to [-1, 0].
     *
     * @type {Vec2}
     * @readonly
     */
    static LEFT = Object.freeze(new Vec2(-1, 0));
}

export { Vec2 };

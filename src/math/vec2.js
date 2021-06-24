/**
 * @class
 * @name Vec2
 * @classdesc A 2-dimensional vector.
 * @description Creates a new Vec2 object.
 * @param {number|number[]} [x] - The x value. If x is an array of length 2, the array will be used to populate all components.
 * @param {number} [y] - The y value.
 * @example
 * var v = new pc.Vec2(1, 2);
 */
/**
 * @field
 * @name Vec2#x
 * @type {number}
 * @description The first element of the vector.
 * @example
 * var vec = new pc.Vec2(10, 20);
 *
 * // Get x
 * var x = vec.x;
 *
 * // Set x
 * vec.x = 0;
 */
/**
 * @field
 * @name Vec2#y
 * @type {number}
 * @description The second element of the vector.
 * @example
 * var vec = new pc.Vec2(10, 20);
 *
 * // Get y
 * var y = vec.y;
 *
 * // Set y
 * vec.y = 0;
 */
class Vec2 {
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
     * @function
     * @name Vec2#add
     * @description Adds a 2-dimensional vector to another in place.
     * @param {Vec2} rhs - The vector to add to the specified vector.
     * @returns {Vec2} Self for chaining.
     * @example
     * var a = new pc.Vec2(10, 10);
     * var b = new pc.Vec2(20, 20);
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
     * @function
     * @name Vec2#add2
     * @description Adds two 2-dimensional vectors together and returns the result.
     * @param {Vec2} lhs - The first vector operand for the addition.
     * @param {Vec2} rhs - The second vector operand for the addition.
     * @returns {Vec2} Self for chaining.
     * @example
     * var a = new pc.Vec2(10, 10);
     * var b = new pc.Vec2(20, 20);
     * var r = new pc.Vec2();
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
     * @function
     * @name Vec2#addScalar
     * @description Adds a number to each element of a vector.
     * @param {number} scalar - The number to add.
     * @returns {Vec2} Self for chaining.
     * @example
     * var vec = new pc.Vec2(3, 4);
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
     * @function
     * @name Vec2#clone
     * @description Returns an identical copy of the specified 2-dimensional vector.
     * @returns {Vec2} A 2-dimensional vector containing the result of the cloning.
     * @example
     * var v = new pc.Vec2(10, 20);
     * var vclone = v.clone();
     * console.log("The result of the cloning is: " + vclone.toString());
     */
    clone() {
        return new Vec2(this.x, this.y);
    }

    /**
     * @function
     * @name Vec2#copy
     * @description Copies the contents of a source 2-dimensional vector to a destination 2-dimensional vector.
     * @param {Vec2} rhs - A vector to copy to the specified vector.
     * @returns {Vec2} Self for chaining.
     * @example
     * var src = new pc.Vec2(10, 20);
     * var dst = new pc.Vec2();
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
     * @function
     * @name Vec2#cross
     * @description Returns the result of a cross product operation performed on the two specified 2-dimensional vectors.
     * @param {Vec2} rhs - The second 2-dimensional vector operand of the cross product.
     * @returns {number} The cross product of the two vectors.
     * @example
     * var right = new pc.Vec2(1, 0);
     * var up = new pc.Vec2(0, 1);
     * var crossProduct = right.cross(up);
     *
     * // Prints 1
     * console.log("The result of the cross product is: " + crossProduct);
     */
    cross(rhs) {
        return this.x * rhs.y - this.y * rhs.x;
    }

    /**
     * @function
     * @name Vec2#distance
     * @description Returns the distance between the two specified 2-dimensional vectors.
     * @param {Vec2} rhs - The second 2-dimensional vector to test.
     * @returns {number} The distance between the two vectors.
     * @example
     * var v1 = new pc.Vec2(5, 10);
     * var v2 = new pc.Vec2(10, 20);
     * var d = v1.distance(v2);
     * console.log("The between v1 and v2 is: " + d);
     */
    distance(rhs) {
        const x = this.x - rhs.x;
        const y = this.y - rhs.y;
        return Math.sqrt(x * x + y * y);
    }

    /**
     * @function
     * @name Vec2#div
     * @description Divides a 2-dimensional vector by another in place.
     * @param {Vec2} rhs - The vector to divide the specified vector by.
     * @returns {Vec2} Self for chaining.
     * @example
     * var a = new pc.Vec2(4, 9);
     * var b = new pc.Vec2(2, 3);
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
     * @function
     * @name Vec2#div2
     * @description Divides one 2-dimensional vector by another and writes the result to
     * the specified vector.
     * @param {Vec2} lhs - The dividend vector (the vector being divided).
     * @param {Vec2} rhs - The divisor vector (the vector dividing the dividend).
     * @returns {Vec2} Self for chaining.
     * @example
     * var a = new pc.Vec2(4, 9);
     * var b = new pc.Vec2(2, 3);
     * var r = new pc.Vec2();
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
     * @function
     * @name Vec2#divScalar
     * @description Divides each element of a vector by a number.
     * @param {number} scalar - The number to divide by.
     * @returns {Vec2} Self for chaining.
     * @example
     * var vec = new pc.Vec2(3, 6);
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
     * @function
     * @name Vec2#dot
     * @description Returns the result of a dot product operation performed on the two specified 2-dimensional vectors.
     * @param {Vec2} rhs - The second 2-dimensional vector operand of the dot product.
     * @returns {number} The result of the dot product operation.
     * @example
     * var v1 = new pc.Vec2(5, 10);
     * var v2 = new pc.Vec2(10, 20);
     * var v1dotv2 = v1.dot(v2);
     * console.log("The result of the dot product is: " + v1dotv2);
     */
    dot(rhs) {
        return this.x * rhs.x + this.y * rhs.y;
    }

    /**
     * @function
     * @name Vec2#equals
     * @description Reports whether two vectors are equal.
     * @param {Vec2} rhs - The vector to compare to the specified vector.
     * @returns {boolean} True if the vectors are equal and false otherwise.
     * @example
     * var a = new pc.Vec2(1, 2);
     * var b = new pc.Vec2(4, 5);
     * console.log("The two vectors are " + (a.equals(b) ? "equal" : "different"));
     */
    equals(rhs) {
        return this.x === rhs.x && this.y === rhs.y;
    }

    /**
     * @function
     * @name Vec2#length
     * @description Returns the magnitude of the specified 2-dimensional vector.
     * @returns {number} The magnitude of the specified 2-dimensional vector.
     * @example
     * var vec = new pc.Vec2(3, 4);
     * var len = vec.length();
     * // Outputs 5
     * console.log("The length of the vector is: " + len);
     */
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    /**
     * @function
     * @name Vec2#lengthSq
     * @description Returns the magnitude squared of the specified 2-dimensional vector.
     * @returns {number} The magnitude of the specified 2-dimensional vector.
     * @example
     * var vec = new pc.Vec2(3, 4);
     * var len = vec.lengthSq();
     * // Outputs 25
     * console.log("The length squared of the vector is: " + len);
     */
    lengthSq() {
        return this.x * this.x + this.y * this.y;
    }

    /**
     * @function
     * @name Vec2#lerp
     * @description Returns the result of a linear interpolation between two specified 2-dimensional vectors.
     * @param {Vec2} lhs - The 2-dimensional to interpolate from.
     * @param {Vec2} rhs - The 2-dimensional to interpolate to.
     * @param {number} alpha - The value controlling the point of interpolation. Between 0 and 1, the linear interpolant
     * will occur on a straight line between lhs and rhs. Outside of this range, the linear interpolant will occur on
     * a ray extrapolated from this line.
     * @returns {Vec2} Self for chaining.
     * @example
     * var a = new pc.Vec2(0, 0);
     * var b = new pc.Vec2(10, 10);
     * var r = new pc.Vec2();
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
     * @function
     * @name Vec2#mul
     * @description Multiplies a 2-dimensional vector to another in place.
     * @param {Vec2} rhs - The 2-dimensional vector used as the second multiplicand of the operation.
     * @returns {Vec2} Self for chaining.
     * @example
     * var a = new pc.Vec2(2, 3);
     * var b = new pc.Vec2(4, 5);
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
     * @function
     * @name Vec2#mul2
     * @description Returns the result of multiplying the specified 2-dimensional vectors together.
     * @param {Vec2} lhs - The 2-dimensional vector used as the first multiplicand of the operation.
     * @param {Vec2} rhs - The 2-dimensional vector used as the second multiplicand of the operation.
     * @returns {Vec2} Self for chaining.
     * @example
     * var a = new pc.Vec2(2, 3);
     * var b = new pc.Vec2(4, 5);
     * var r = new pc.Vec2();
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
     * @function
     * @name Vec2#mulScalar
     * @description Multiplies each element of a vector by a number.
     * @param {number} scalar - The number to multiply by.
     * @returns {Vec2} Self for chaining.
     * @example
     * var vec = new pc.Vec2(3, 6);
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
     * @function
     * @name Vec2#normalize
     * @description Returns this 2-dimensional vector converted to a unit vector in place.
     * If the vector has a length of zero, the vector's elements will be set to zero.
     * @returns {Vec2} Self for chaining.
     * @example
     * var v = new pc.Vec2(25, 0);
     *
     * v.normalize();
     *
     * // Outputs 1, 0
     * console.log("The result of the vector normalization is: " + v.toString());
     */
    normalize() {
        const lengthSq = this.x * this.x + this.y * this.y;
        if (lengthSq > 0) {
            const invLength = 1 / Math.sqrt(lengthSq);
            this.x *= invLength;
            this.y *= invLength;
        }

        return this;
    }

    /**
     * @function
     * @name Vec2#floor
     * @description Each element is set to the largest integer less than or equal to its value.
     * @returns {Vec2} Self for chaining.
     */
    floor() {
        this.x = Math.floor(this.x);
        this.y = Math.floor(this.y);
        return this;
    }

    /**
     * @function
     * @name Vec2#ceil
     * @description Each element is rounded up to the next largest integer.
     * @returns {Vec2} Self for chaining.
     */
    ceil() {
        this.x = Math.ceil(this.x);
        this.y = Math.ceil(this.y);
        return this;
    }

    /**
     * @function
     * @name Vec2#round
     * @description Each element is rounded up or down to the nearest integer.
     * @returns {Vec2} Self for chaining.
     */
    round() {
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        return this;
    }

    /**
     * @function
     * @name Vec2#min
     * @description Each element is assigned a value from rhs parameter if it is smaller.
     * @param {Vec2} rhs - The 2-dimensional vector used as the source of elements to compare to.
     * @returns {Vec2} Self for chaining.
     */
    min(rhs) {
        if (rhs.x < this.x) this.x = rhs.x;
        if (rhs.y < this.y) this.y = rhs.y;
        return this;
    }

    /**
     * @function
     * @name Vec2#max
     * @description Each element is assigned a value from rhs parameter if it is larger.
     * @param {Vec2} rhs - The 2-dimensional vector used as the source of elements to compare to.
     * @returns {Vec2} Self for chaining.
     */
    max(rhs) {
        if (rhs.x > this.x) this.x = rhs.x;
        if (rhs.y > this.y) this.y = rhs.y;
        return this;
    }

    /**
     * @function
     * @name Vec2#set
     * @description Sets the specified 2-dimensional vector to the supplied numerical values.
     * @param {number} x - The value to set on the first component of the vector.
     * @param {number} y - The value to set on the second component of the vector.
     * @returns {Vec2} Self for chaining.
     * @example
     * var v = new pc.Vec2();
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
     * @function
     * @name Vec2#sub
     * @description Subtracts a 2-dimensional vector from another in place.
     * @param {Vec2} rhs - The vector to add to the specified vector.
     * @returns {Vec2} Self for chaining.
     * @example
     * var a = new pc.Vec2(10, 10);
     * var b = new pc.Vec2(20, 20);
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
     * @function
     * @name Vec2#sub2
     * @description Subtracts two 2-dimensional vectors from one another and returns the result.
     * @param {Vec2} lhs - The first vector operand for the addition.
     * @param {Vec2} rhs - The second vector operand for the addition.
     * @returns {Vec2} Self for chaining.
     * @example
     * var a = new pc.Vec2(10, 10);
     * var b = new pc.Vec2(20, 20);
     * var r = new pc.Vec2();
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
     * @function
     * @name Vec2#subScalar
     * @description Subtracts a number from each element of a vector.
     * @param {number} scalar - The number to subtract.
     * @returns {Vec2} Self for chaining.
     * @example
     * var vec = new pc.Vec2(3, 4);
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
     * @function
     * @name Vec2#toString
     * @description Converts the vector to string form.
     * @returns {string} The vector in string form.
     * @example
     * var v = new pc.Vec2(20, 10);
     * // Outputs [20, 10]
     * console.log(v.toString());
     */
    toString() {
        return '[' + this.x + ', ' + this.y + ']';
    }

    /**
     * @function
     * @private
     * @name Vec2#angleRad
     * @description Calculates the angle between two Vec2's in radians.
     * @param {Vec2} lhs - The first vector operand for the calculation.
     * @param {Vec2} rhs - The second vector operand for the calculation.
     * @returns {number} The calculated angle in radians.
     */
    static angleRad(lhs, rhs) {
        return Math.atan2(lhs.x * rhs.y - lhs.y * rhs.x, lhs.x * rhs.x + lhs.y * rhs.y);
    }

    /**
     * @field
     * @static
     * @readonly
     * @name Vec2.ZERO
     * @type {Vec2}
     * @description A constant vector set to [0, 0].
     */
    static ZERO = Object.freeze(new Vec2(0, 0));

    /**
     * @field
     * @static
     * @readonly
     * @name Vec2.ONE
     * @type {Vec2}
     * @description A constant vector set to [1, 1].
     */
    static ONE = Object.freeze(new Vec2(1, 1));

    /**
     * @field
     * @static
     * @readonly
     * @name Vec2.UP
     * @type {Vec2}
     * @description A constant vector set to [0, 1].
     */
    static UP = Object.freeze(new Vec2(0, 1));

    /**
     * @field
     * @static
     * @readonly
     * @name Vec2.DOWN
     * @type {Vec2}
     * @description A constant vector set to [0, -1].
     */
    static DOWN = Object.freeze(new Vec2(0, -1));

    /**
     * @field
     * @static
     * @readonly
     * @name Vec2.RIGHT
     * @type {Vec2}
     * @description A constant vector set to [1, 0].
     */
    static RIGHT = Object.freeze(new Vec2(1, 0));

    /**
     * @field
     * @static
     * @readonly
     * @name Vec2.LEFT
     * @type {Vec2}
     * @description A constant vector set to [-1, 0].
     */
    static LEFT = Object.freeze(new Vec2(-1, 0));
}

export { Vec2 };

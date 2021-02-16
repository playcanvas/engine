/**
 * @class
 * @name Vec3
 * @classdesc A 3-dimensional vector.
 * @description Creates a new Vec3 object.
 * @param {number|number[]} [x] - The x value. If x is an array of length 3, the array will be used to populate all components.
 * @param {number} [y] - The y value.
 * @param {number} [z] - The z value.
 * @example
 * var v = new pc.Vec3(1, 2, 3);
 */
/**
 * @name Vec3#x
 * @type {number}
 * @description The first component of the vector.
 * @example
 * var vec = new pc.Vec3(10, 20, 30);
 *
 * // Get x
 * var x = vec.x;
 *
 * // Set x
 * vec.x = 0;
 */
/**
 * @name Vec3#y
 * @type {number}
 * @description The second component of the vector.
 * @example
 * var vec = new pc.Vec3(10, 20, 30);
 *
 * // Get y
 * var y = vec.y;
 *
 * // Set y
 * vec.y = 0;
 */
/**
 * @name Vec3#z
 * @type {number}
 * @description The third component of the vector.
 * @example
 * var vec = new pc.Vec3(10, 20, 30);
 *
 * // Get z
 * var z = vec.z;
 *
 * // Set z
 * vec.z = 0;
 */
class Vec3 {
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
     * @function
     * @name Vec3#add
     * @description Adds a 3-dimensional vector to another in place.
     * @param {Vec3} rhs - The vector to add to the specified vector.
     * @returns {pc.Vec3} Self for chaining.
     * @example
     * var a = new pc.Vec3(10, 10, 10);
     * var b = new pc.Vec3(20, 20, 20);
     *
     * a.add(b);
     *
     * // Should output [30, 30, 30]
     * console.log("The result of the addition is: " + a.toString());
     */
    add(rhs) {
        this.x += rhs.x;
        this.y += rhs.y;
        this.z += rhs.z;

        return this;
    }

    /**
     * @function
     * @name Vec3#add2
     * @description Adds two 3-dimensional vectors together and returns the result.
     * @param {Vec3} lhs - The first vector operand for the addition.
     * @param {Vec3} rhs - The second vector operand for the addition.
     * @returns {pc.Vec3} Self for chaining.
     * @example
     * var a = new pc.Vec3(10, 10, 10);
     * var b = new pc.Vec3(20, 20, 20);
     * var r = new pc.Vec3();
     *
     * r.add2(a, b);
     * // Should output [30, 30, 30]
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
     * @function
     * @name Vec3#clone
     * @description Returns an identical copy of the specified 3-dimensional vector.
     * @returns {pc.Vec3} A 3-dimensional vector containing the result of the cloning.
     * @example
     * var v = new pc.Vec3(10, 20, 30);
     * var vclone = v.clone();
     * console.log("The result of the cloning is: " + vclone.toString());
     */
    clone() {
        return new Vec3(this.x, this.y, this.z);
    }

    /**
     * @function
     * @name Vec3#copy
     * @description Copied the contents of a source 3-dimensional vector to a destination 3-dimensional vector.
     * @param {Vec3} rhs - A vector to copy to the specified vector.
     * @returns {pc.Vec3} Self for chaining.
     * @example
     * var src = new pc.Vec3(10, 20, 30);
     * var dst = new pc.Vec3();
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
     * @function
     * @name Vec3#cross
     * @description Returns the result of a cross product operation performed on the two specified 3-dimensional vectors.
     * @param {Vec3} lhs - The first 3-dimensional vector operand of the cross product.
     * @param {Vec3} rhs - The second 3-dimensional vector operand of the cross product.
     * @returns {pc.Vec3} Self for chaining.
     * @example
     * var back = new pc.Vec3().cross(pc.Vec3.RIGHT, pc.Vec3.UP);
     *
     * // Should print the Z axis (i.e. [0, 0, 1])
     * console.log("The result of the cross product is: " + back.toString());
     */
    cross(lhs, rhs) {
        // Create temporary variables in case lhs or rhs are 'this'
        var lx = lhs.x;
        var ly = lhs.y;
        var lz = lhs.z;
        var rx = rhs.x;
        var ry = rhs.y;
        var rz = rhs.z;

        this.x = ly * rz - ry * lz;
        this.y = lz * rx - rz * lx;
        this.z = lx * ry - rx * ly;

        return this;
    }

    /**
     * @function
     * @name Vec3#distance
     * @description Returns the distance between the two specified 3-dimensional vectors.
     * @param {Vec3} rhs - The second 3-dimensional vector to test.
     * @returns {number} The distance between the two vectors.
     * @example
     * var v1 = new pc.Vec3(5, 10, 20);
     * var v2 = new pc.Vec3(10, 20, 40);
     * var d = v1.distance(v2);
     * console.log("The between v1 and v2 is: " + d);
     */
    distance(rhs) {
        var x = this.x - rhs.x;
        var y = this.y - rhs.y;
        var z = this.z - rhs.z;
        return Math.sqrt(x * x + y * y + z * z);
    }

    /**
     * @function
     * @name Vec3#dot
     * @description Returns the result of a dot product operation performed on the two specified 3-dimensional vectors.
     * @param {Vec3} rhs - The second 3-dimensional vector operand of the dot product.
     * @returns {number} The result of the dot product operation.
     * @example
     * var v1 = new pc.Vec3(5, 10, 20);
     * var v2 = new pc.Vec3(10, 20, 40);
     * var v1dotv2 = v1.dot(v2);
     * console.log("The result of the dot product is: " + v1dotv2);
     */
    dot(rhs) {
        return this.x * rhs.x + this.y * rhs.y + this.z * rhs.z;
    }

    /**
     * @function
     * @name Vec3#equals
     * @description Reports whether two vectors are equal.
     * @param {Vec3} rhs - The vector to compare to the specified vector.
     * @returns {boolean} True if the vectors are equal and false otherwise.
     * @example
     * var a = new pc.Vec3(1, 2, 3);
     * var b = new pc.Vec3(4, 5, 6);
     * console.log("The two vectors are " + (a.equals(b) ? "equal" : "different"));
     */
    equals(rhs) {
        return this.x === rhs.x && this.y === rhs.y && this.z === rhs.z;
    }

    /**
     * @function
     * @name Vec3#length
     * @description Returns the magnitude of the specified 3-dimensional vector.
     * @returns {number} The magnitude of the specified 3-dimensional vector.
     * @example
     * var vec = new pc.Vec3(3, 4, 0);
     * var len = vec.length();
     * // Should output 5
     * console.log("The length of the vector is: " + len);
     */
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    /**
     * @function
     * @name Vec3#lengthSq
     * @description Returns the magnitude squared of the specified 3-dimensional vector.
     * @returns {number} The magnitude of the specified 3-dimensional vector.
     * @example
     * var vec = new pc.Vec3(3, 4, 0);
     * var len = vec.lengthSq();
     * // Should output 25
     * console.log("The length squared of the vector is: " + len);
     */
    lengthSq() {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    /**
     * @function
     * @name Vec3#lerp
     * @description Returns the result of a linear interpolation between two specified 3-dimensional vectors.
     * @param {Vec3} lhs - The 3-dimensional to interpolate from.
     * @param {Vec3} rhs - The 3-dimensional to interpolate to.
     * @param {number} alpha - The value controlling the point of interpolation. Between 0 and 1, the linear interpolant
     * will occur on a straight line between lhs and rhs. Outside of this range, the linear interpolant will occur on
     * a ray extrapolated from this line.
     * @returns {pc.Vec3} Self for chaining.
     * @example
     * var a = new pc.Vec3(0, 0, 0);
     * var b = new pc.Vec3(10, 10, 10);
     * var r = new pc.Vec3();
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
     * @function
     * @name Vec3#mul
     * @description Multiplies a 3-dimensional vector to another in place.
     * @param {Vec3} rhs - The 3-dimensional vector used as the second multiplicand of the operation.
     * @returns {pc.Vec3} Self for chaining.
     * @example
     * var a = new pc.Vec3(2, 3, 4);
     * var b = new pc.Vec3(4, 5, 6);
     *
     * a.mul(b);
     *
     * // Should output 8, 15, 24
     * console.log("The result of the multiplication is: " + a.toString());
     */
    mul(rhs) {
        this.x *= rhs.x;
        this.y *= rhs.y;
        this.z *= rhs.z;

        return this;
    }

    /**
     * @function
     * @name Vec3#mul2
     * @description Returns the result of multiplying the specified 3-dimensional vectors together.
     * @param {Vec3} lhs - The 3-dimensional vector used as the first multiplicand of the operation.
     * @param {Vec3} rhs - The 3-dimensional vector used as the second multiplicand of the operation.
     * @returns {pc.Vec3} Self for chaining.
     * @example
     * var a = new pc.Vec3(2, 3, 4);
     * var b = new pc.Vec3(4, 5, 6);
     * var r = new pc.Vec3();
     *
     * r.mul2(a, b);
     *
     * // Should output 8, 15, 24
     * console.log("The result of the multiplication is: " + r.toString());
     */
    mul2(lhs, rhs) {
        this.x = lhs.x * rhs.x;
        this.y = lhs.y * rhs.y;
        this.z = lhs.z * rhs.z;

        return this;
    }

    /**
     * @function
     * @name Vec3#normalize
     * @description Returns this 3-dimensional vector converted to a unit vector in place.
     * If the vector has a length of zero, the vector's elements will be set to zero.
     * @returns {pc.Vec3} Self for chaining.
     * @example
     * var v = new pc.Vec3(25, 0, 0);
     *
     * v.normalize();
     *
     * // Should output 1, 0, 0
     * console.log("The result of the vector normalization is: " + v.toString());
     */
    normalize() {
        var lengthSq = this.x * this.x + this.y * this.y + this.z * this.z;
        if (lengthSq > 0) {
            var invLength = 1 / Math.sqrt(lengthSq);
            this.x *= invLength;
            this.y *= invLength;
            this.z *= invLength;
        }

        return this;
    }

    /**
     * @function
     * @name  pc.Vec3#project
     * @description Projects this 3-dimensional vector onto the specified vector.
     * @param {Vec3} rhs - The vector onto which the original vector will be projected on.
     * @returns {pc.Vec3} Self for chaining.
     * @example
     * var v = new pc.Vec3(5, 5, 5);
     * var normal = new pc.Vec3(1, 0, 0);
     *
     * v.project(normal);
     *
     * // Should output 5, 0, 0
     * console.log("The result of the vector projection is: " + v.toString());
     */
    project(rhs) {
        var a_dot_b = this.x * rhs.x + this.y * rhs.y + this.z * rhs.z;
        var b_dot_b = rhs.x * rhs.x + rhs.y * rhs.y + rhs.z * rhs.z;
        var s = a_dot_b / b_dot_b;
        this.x = rhs.x * s;
        this.y = rhs.y * s;
        this.z = rhs.z * s;
        return this;
    }

    /**
     * @function
     * @name Vec3#scale
     * @description Scales each dimension of the specified 3-dimensional vector by the supplied
     * scalar value.
     * @param {number} scalar - The value by which each vector component is multiplied.
     * @returns {pc.Vec3} Self for chaining.
     * @example
     * var v = new pc.Vec3(2, 4, 8);
     *
     * // Multiply by 2
     * v.scale(2);
     *
     * // Negate
     * v.scale(-1);
     *
     * // Divide by 2
     * v.scale(0.5);
     */
    scale(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        this.z *= scalar;

        return this;
    }

    /**
     * @function
     * @name Vec3#set
     * @description Sets the specified 3-dimensional vector to the supplied numerical values.
     * @param {number} x - The value to set on the first component of the vector.
     * @param {number} y - The value to set on the second component of the vector.
     * @param {number} z - The value to set on the third component of the vector.
     * @returns {pc.Vec3} Self for chaining.
     * @example
     * var v = new pc.Vec3();
     * v.set(5, 10, 20);
     *
     * // Should output 5, 10, 20
     * console.log("The result of the vector set is: " + v.toString());
     */
    set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;

        return this;
    }

    /**
     * @function
     * @name Vec3#sub
     * @description Subtracts a 3-dimensional vector from another in place.
     * @param {Vec3} rhs - The vector to add to the specified vector.
     * @returns {pc.Vec3} Self for chaining.
     * @example
     * var a = new pc.Vec3(10, 10, 10);
     * var b = new pc.Vec3(20, 20, 20);
     *
     * a.sub(b);
     *
     * // Should output [-10, -10, -10]
     * console.log("The result of the subtraction is: " + a.toString());
     */
    sub(rhs) {
        this.x -= rhs.x;
        this.y -= rhs.y;
        this.z -= rhs.z;

        return this;
    }

    /**
     * @function
     * @name Vec3#sub2
     * @description Subtracts two 3-dimensional vectors from one another and returns the result.
     * @param {Vec3} lhs - The first vector operand for the addition.
     * @param {Vec3} rhs - The second vector operand for the addition.
     * @returns {pc.Vec3} Self for chaining.
     * @example
     * var a = new pc.Vec3(10, 10, 10);
     * var b = new pc.Vec3(20, 20, 20);
     * var r = new pc.Vec3();
     *
     * r.sub2(a, b);
     *
     * // Should output [-10, -10, -10]
     * console.log("The result of the subtraction is: " + r.toString());
     */
    sub2(lhs, rhs) {
        this.x = lhs.x - rhs.x;
        this.y = lhs.y - rhs.y;
        this.z = lhs.z - rhs.z;

        return this;
    }

    /**
     * @function
     * @name Vec3#toString
     * @description Converts the vector to string form.
     * @returns {string} The vector in string form.
     * @example
     * var v = new pc.Vec3(20, 10, 5);
     * // Should output '[20, 10, 5]'
     * console.log(v.toString());
     */
    toString() {
        return '[' + this.x + ', ' + this.y + ', ' + this.z + ']';
    }

    /**
     * @field
     * @static
     * @readonly
     * @name Vec3.ZERO
     * @type {pc.Vec3}
     * @description A constant vector set to [0, 0, 0].
     */
    static ZERO = Object.freeze(new Vec3(0, 0, 0));

    /**
     * @field
     * @static
     * @readonly
     * @name Vec3.ONE
     * @type {pc.Vec3}
     * @description A constant vector set to [1, 1, 1].
     */
    static ONE = Object.freeze(new Vec3(1, 1, 1));

    /**
     * @field
     * @static
     * @readonly
     * @name Vec3.UP
     * @type {pc.Vec3}
     * @description A constant vector set to [0, 1, 0].
     */
    static UP = Object.freeze(new Vec3(0, 1, 0));

    /**
     * @field
     * @static
     * @readonly
     * @name Vec3.DOWN
     * @type {pc.Vec3}
     * @description A constant vector set to [0, -1, 0].
     */
    static DOWN = Object.freeze(new Vec3(0, -1, 0));

    /**
     * @field
     * @static
     * @readonly
     * @name Vec3.RIGHT
     * @type {pc.Vec3}
     * @description A constant vector set to [1, 0, 0].
     */
    static RIGHT = Object.freeze(new Vec3(1, 0, 0));

    /**
     * @field
     * @static
     * @readonly
     * @name Vec3.LEFT
     * @type {pc.Vec3}
     * @description A constant vector set to [-1, 0, 0].
     */
    static LEFT = Object.freeze(new Vec3(-1, 0, 0));

    /**
     * @field
     * @static
     * @readonly
     * @name Vec3.FORWARD
     * @type {pc.Vec3}
     * @description A constant vector set to [0, 0, -1].
     */
    static FORWARD = Object.freeze(new Vec3(0, 0, -1));

    /**
     * @field
     * @static
     * @readonly
     * @name Vec3.BACK
     * @type {pc.Vec3}
     * @description A constant vector set to [0, 0, 1].
     */
    static BACK = Object.freeze(new Vec3(0, 0, 1));
}

export { Vec3 };

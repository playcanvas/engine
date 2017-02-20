pc.extend(pc, (function () {
    'use strict';

    /**
    * @name pc.Vec2
    * @class A 2-dimensional vector.
    * @description Creates a new Vec2 object
    * @param {Number} [x] The x value. If x is an array of length 2, the array will be used to populate all components.
    * @param {Number} [y] The y value
    */
    var Vec2 = function (x, y) {
        if (x && x.length === 2) {
            this.data = new Float32Array(x);
            return;
        }

        this.data = new Float32Array(2);

        this.data[0] = x || 0;
        this.data[1] = y || 0;
    };

    Vec2.prototype = {
        /**
         * @function
         * @name pc.Vec2#add
         * @description Adds a 2-dimensional vector to another in place.
         * @param {pc.Vec2} rhs The vector to add to the specified vector.
         * @returns {pc.Vec2} Self for chaining.
         * @example
         * var a = new pc.Vec2(10, 10);
         * var b = new pc.Vec2(20, 20);
         *
         * a.add(b);
         *
         * // Should output [30, 30]
         * console.log("The result of the addition is: " + a.toString());
         */
        add: function (rhs) {
            var a = this.data,
                b = rhs.data;

            a[0] += b[0];
            a[1] += b[1];

            return this;
        },

        /**
         * @function
         * @name pc.Vec2#add2
         * @description Adds two 2-dimensional vectors together and returns the result.
         * @param {pc.Vec2} lhs The first vector operand for the addition.
         * @param {pc.Vec2} rhs The second vector operand for the addition.
         * @returns {pc.Vec2} Self for chaining.
         * @example
         * var a = new pc.Vec2(10, 10);
         * var b = new pc.Vec2(20, 20);
         * var r = new pc.Vec2();
         *
         * r.add2(a, b);
         * // Should output [30, 30]
         *
         * console.log("The result of the addition is: " + r.toString());
         */
        add2: function (lhs, rhs) {
            var a = lhs.data,
                b = rhs.data,
                r = this.data;

            r[0] = a[0] + b[0];
            r[1] = a[1] + b[1];

            return this;
        },

        /**
         * @function
         * @name pc.Vec2#clone
         * @description Returns an identical copy of the specified 2-dimensional vector.
         * @returns {pc.Vec2} A 2-dimensional vector containing the result of the cloning.
         * @example
         * var v = new pc.Vec2(10, 20);
         * var vclone = v.clone();
         * console.log("The result of the cloning is: " + vclone.toString());
         */
        clone: function () {
            return new Vec2().copy(this);
        },

        /**
         * @function
         * @name pc.Vec2#copy
         * @description Copied the contents of a source 2-dimensional vector to a destination 2-dimensional vector.
         * @param {pc.Vec2} rhs A vector to copy to the specified vector.
         * @returns {pc.Vec2} Self for chaining.
         * @example
         * var src = new pc.Vec2(10, 20);
         * var dst = new pc.Vec2();
         *
         * dst.copy(src);
         *
         * console.log("The two vectors are " + (dst.equals(src) ? "equal" : "different"));
         */
        copy: function (rhs) {
            var a = this.data,
                b = rhs.data;

            a[0] = b[0];
            a[1] = b[1];

            return this;
        },

        /**
         * @function
         * @name pc.Vec2#dot
         * @description Returns the result of a dot product operation performed on the two specified 2-dimensional vectors.
         * @param {pc.Vec2} rhs The second 2-dimensional vector operand of the dot product.
         * @returns {Number} The result of the dot product operation.
         * @example
         * var v1 = new pc.Vec2(5, 10);
         * var v2 = new pc.Vec2(10, 20);
         * var v1dotv2 = v1.dot(v2);
         * console.log("The result of the dot product is: " + v1dotv2);
         */
        dot: function (rhs) {
            var a = this.data,
                b = rhs.data;

            return a[0] * b[0] + a[1] * b[1];
        },

        /**
         * @function
         * @name pc.Vec2#equals
         * @description Reports whether two vectors are equal.
         * @param {pc.Vec2} rhs The vector to compare to the specified vector.
         * @returns {Boolean} true if the vectors are equal and false otherwise.
         * @example
         * var a = new pc.Vec2(1, 2);
         * var b = new pc.Vec2(4, 5);
         * console.log("The two vectors are " + (a.equals(b) ? "equal" : "different"));
         */
        equals: function (rhs) {
            var a = this.data,
                b = rhs.data;

            return a[0] === b[0] && a[1] === b[1];
        },

        /**
         * @function
         * @name pc.Vec2#length
         * @description Returns the magnitude of the specified 2-dimensional vector.
         * @returns {Number} The magnitude of the specified 2-dimensional vector.
         * @example
         * var vec = new pc.Vec2(3, 4);
         * var len = vec.length();
         * // Should output 5
         * console.log("The length of the vector is: " + len);
         */
        length: function () {
            var v = this.data;

            return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
        },

        /**
         * @function
         * @name pc.Vec2#lengthSq
         * @description Returns the magnitude squared of the specified 2-dimensional vector.
         * @returns {Number} The magnitude of the specified 2-dimensional vector.
         * @example
         * var vec = new pc.Vec2(3, 4);
         * var len = vec.lengthSq();
         * // Should output 25
         * console.log("The length squared of the vector is: " + len);
         */
        lengthSq: function () {
            var v = this.data;

            return v[0] * v[0] + v[1] * v[1];
        },

        /**
         * @function
         * @name pc.Vec2#lerp
         * @description Returns the result of a linear interpolation between two specified 2-dimensional vectors.
         * @param {pc.Vec2} lhs The 2-dimensional to interpolate from.
         * @param {pc.Vec2} rhs The 2-dimensional to interpolate to.
         * @param {Number} alpha The value controlling the point of interpolation. Between 0 and 1, the linear interpolant
         * will occur on a straight line between lhs and rhs. Outside of this range, the linear interpolant will occur on
         * a ray extrapolated from this line.
         * @returns {pc.Vec2} Self for chaining.
         * @example
         * var a = new pc.Vec2(0, 0);
         * var b = new pc.Vec2(10, 10);
         * var r = new pc.Vec2();
         *
         * r.lerp(a, b, 0);   // r is equal to a
         * r.lerp(a, b, 0.5); // r is 5, 5
         * r.lerp(a, b, 1);   // r is equal to b
         */
        lerp: function (lhs, rhs, alpha) {
            var a = lhs.data,
                b = rhs.data,
                r = this.data;

            r[0] = a[0] + alpha * (b[0] - a[0]);
            r[1] = a[1] + alpha * (b[1] - a[1]);

            return this;
        },

        /**
         * @function
         * @name pc.Vec2#mul
         * @description Returns the result of multiplying the specified 2-dimensional vectors together.
         * @param {pc.Vec2} rhs The 2-dimensional vector used as the second multiplicand of the operation.
         * @returns {pc.Vec2} Self for chaining.
         * @example
         * var a = new pc.Vec2(2, 3);
         * var b = new pc.Vec2(4, 5);
         *
         * a.mul(b);
         *
         * // Should output 8, 15
         * console.log("The result of the multiplication is: " + a.toString());
         */
        mul: function (rhs) {
            var a = this.data,
                b = rhs.data;

            a[0] *= b[0];
            a[1] *= b[1];

            return this;
        },

        /**
         * @function
         * @name pc.Vec2#mul2
         * @description Returns the result of multiplying the specified 2-dimensional vectors together.
         * @param {pc.Vec2} lhs The 2-dimensional vector used as the first multiplicand of the operation.
         * @param {pc.Vec2} rhs The 2-dimensional vector used as the second multiplicand of the operation.
         * @returns {pc.Vec2} Self for chaining.
         * @example
         * var a = new pc.Vec2(2, 3);
         * var b = new pc.Vec2(4, 5);
         * var r = new pc.Vec2();
         *
         * r.mul2(a, b);
         *
         * // Should output 8, 15
         * console.log("The result of the multiplication is: " + r.toString());
         */
        mul2: function (lhs, rhs) {
            var a = lhs.data,
                b = rhs.data,
                r = this.data;

            r[0] = a[0] * b[0];
            r[1] = a[1] * b[1];

            return this;
        },

        /**
         * @function
         * @name pc.Vec2#normalize
         * @description Returns the specified 2-dimensional vector copied and converted to a unit vector.
         * If the vector has a length of zero, the vector's elements will be set to zero.
         * @returns {pc.Vec2} Self for chaining.
         * @example
         * var v = new pc.Vec2(25, 0);
         *
         * v.normalize();
         *
         * // Should output 1, 0
         * console.log("The result of the vector normalization is: " + v.toString());
         */
        normalize: function () {
            var v = this.data;

            var lengthSq = v[0] * v[0] + v[1] * v[1];
            if (lengthSq > 0) {
                var invLength = 1 / Math.sqrt(lengthSq);
                v[0] *= invLength;
                v[1] *= invLength;
            }

            return this;
        },

        /**
         * @function
         * @name pc.Vec2#scale
         * @description Scales each component of the specified 2-dimensional vector by the supplied
         * scalar value.
         * @param {Number} scalar The value by which each vector component is multiplied.
         * @returns {pc.Vec2} Self for chaining.
         * @example
         * var v = new pc.Vec2(2, 4);
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
        scale: function (scalar) {
            var v = this.data;

            v[0] *= scalar;
            v[1] *= scalar;

            return this;
        },

        /**
         * @function
         * @name pc.Vec2#set
         * @description Sets the specified 2-dimensional vector to the supplied numerical values.
         * @param {Number} x The value to set on the first component of the vector.
         * @param {Number} y The value to set on the second component of the vector.
         * @example
         * var v = new pc.Vec2();
         * v.set(5, 10);
         *
         * // Should output 5, 10
         * console.log("The result of the vector set is: " + v.toString());
         */
        set: function (x, y) {
            var v = this.data;

            v[0] = x;
            v[1] = y;

            return this;
        },

        /**
         * @function
         * @name pc.Vec2#sub
         * @description Subtracts a 2-dimensional vector from another in place.
         * @param {pc.Vec2} rhs The vector to add to the specified vector.
         * @returns {pc.Vec2} Self for chaining.
         * @example
         * var a = new pc.Vec2(10, 10);
         * var b = new pc.Vec2(20, 20);
         *
         * a.sub(b);
         *
         * // Should output [-10, -10]
         * console.log("The result of the addition is: " + a.toString());
         */
        sub: function (rhs) {
            var a = this.data,
                b = rhs.data;

            a[0] -= b[0];
            a[1] -= b[1];

            return this;
        },

        /**
         * @function
         * @name pc.Vec2#sub2
         * @description Subtracts two 2-dimensional vectors from one another and returns the result.
         * @param {pc.Vec2} lhs The first vector operand for the addition.
         * @param {pc.Vec2} rhs The second vector operand for the addition.
         * @returns {pc.Vec2} Self for chaining.
         * @example
         * var a = new pc.Vec2(10, 10);
         * var b = new pc.Vec2(20, 20);
         * var r = new pc.Vec2();
         *
         * r.sub2(a, b);
         *
         * // Should output [-10, -10]
         * console.log("The result of the addition is: " + r.toString());
         */
        sub2: function (lhs, rhs) {
            var a = lhs.data,
                b = rhs.data,
                r = this.data;

            r[0] = a[0] - b[0];
            r[1] = a[1] - b[1];

            return this;
        },

        /**
         * @function
         * @name pc.Vec2#toString
         * @description Converts the vector to string form.
         * @returns {String} The vector in string form.
         * @example
         * var v = new pc.Vec2(20, 10);
         * // Should output '[20, 10]'
         * console.log(v.toString());
         */
        toString: function () {
            return "[" + this.data[0] + ", " + this.data[1] + "]";
        }
    };

    /**
     * @field
     * @type Number
     * @name pc.Vec2#x
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
    Object.defineProperty(Vec2.prototype, 'x', {
        get: function () {
            return this.data[0];
        },
        set: function (value) {
            this.data[0] = value;
        }
    });

    /**
     * @field
     * @type Number
     * @name pc.Vec2#y
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
    Object.defineProperty(Vec2.prototype, 'y', {
        get: function () {
            return this.data[1];
        },
        set: function (value) {
            this.data[1] = value;
        }
    });

    /**
     * @field
     * @static
     * @readonly
     * @type pc.Vec2
     * @name pc.Vec2.ONE
     * @description A constant vector set to [1, 1].
     */
    Object.defineProperty(Vec2, 'ONE', {
        get: (function () {
            var one = new Vec2(1, 1);
            return function () {
                return one;
            };
        }())
    });

    /**
     * @field
     * @static
     * @readonly
     * @type pc.Vec2
     * @name pc.Vec2.RIGHT
     * @description A constant vector set to [1, 0].
     */
    Object.defineProperty(Vec2, 'RIGHT', {
        get: (function () {
            var right = new Vec2(1, 0);
            return function () {
                return right;
            };
        }())
    });

    /**
     * @field
     * @static
     * @readonly
     * @type pc.Vec2
     * @name pc.Vec2.UP
     * @description A constant vector set to [0, 1].
     */
    Object.defineProperty(Vec2, 'UP', {
        get: (function () {
            var down = new Vec2(0, 1);
            return function () {
                return down;
            };
        }())
    });

    /**
     * @field
     * @static
     * @readonly
     * @type pc.Vec2
     * @name pc.Vec2.ZERO
     * @description A constant vector set to [0, 0].
     */
    Object.defineProperty(Vec2, 'ZERO', {
        get: (function () {
            var zero = new Vec2(0, 0);
            return function () {
                return zero;
            };
        }())
    });

    return {
        Vec2: Vec2
    };
}()));

pc.extend(pc, function () {
    /**
    * @name pc.Vector3
    * @class A 3-dimensional vector.
    * @constructor Creates a new Vector3 object
    * @property {pc.Vector3} identity [Read only] The identity matrix.
    * @property {pc.Vector3} zero [Read only] A matrix with all elements set to zero.
    * @property {Number} x The first element of the vector.
    * @property {Number} y The second element of the vector.
    * @property {Number} z The third element of the vector.
    * @property {Number} r The first element of the vector.
    * @property {Number} g The second element of the vector.
    * @property {Number} b The third element of the vector.
    * @property {Number} u The first element of the vector.
    * @property {Number} v The second element of the vector.
    * @property {Number} w The third element of the vector.
    */
    var Vector3 = function () {
        this.data = new Float32Array(3);

        if (arguments.length === 3) {
            this.data.set(arguments);
        } else {
            this.data[0] = 0;
            this.data[1] = 0;
            this.data[2] = 0;
        }
    };

    Object.defineProperty(Vector3, 'back', {
        get: function () {
            var back = new Vector3(0, 0, 1);
            return function() {
                return back;
            }
        }()
    });

    Object.defineProperty(Vector3, 'down', {
        get: function () {
            var down = new Vector3(0, -1, 0);
            return function() {
                return down;
            }
        }()
    });

    Object.defineProperty(Vector3, 'forward', {
        get: function () {
            var forward = new Vector3(0, 0, -1);
            return function() {
                return forward;
            }
        }()
    });

    Object.defineProperty(Vector3, 'left', {
        get: function () {
            var left = new Vector3(-1, 0, 0);
            return function() {
                return left;
            }
        }()
    });

    Object.defineProperty(Vector3, 'one', {
        get: function () {
            var one = new Vector3(1, 1, 1);
            return function() {
                return one;
            }
        }()
    });

    Object.defineProperty(Vector3, 'right', {
        get: function () {
            var right = new Vector3(1, 0, 0);
            return function() {
                return right;
            }
        }()
    });

    Object.defineProperty(Vector3, 'up', {
        get: function () {
            var down = new Vector3(0, 1, 0);
            return function() {
                return down;
            }
        }()
    });

    Object.defineProperty(Vector3, 'zero', {
        get: function () {
            var zero = new Vector3(0, 0, 0);
            return function() {
                return zero;
            }
        }()
    });

    function defineAccessors(accessors) {
        for (var i = 0; i < accessors.length; i++) {
            var names = accessors[i];
            for (var j = 0; j < names.length; j++) {
                Object.defineProperty(Vector3.prototype, names[j], {
                    get: function () {
                        return this.data[i];
                    },
                    set: function (value) {
                        this.data[i] = value;
                    }
                });
            }
        }
    }(['x', 'u', 'r'], ['y', 'v', 'g'], ['z', 'w', 'b']);

    /**
     * @function
     * @name pc.Vector3#add
     * @description Adds two 3-dimensional vectors together and returns the result.
     * @param {pc.Vector3} lhs The first vector operand for the addition.
     * @param {pc.Vector3} rhs The second vector operand for the addition.
     * @returns {pc.Vector3} Self for chaining.
     * @example
     * var a = new pc.Vector3(10, 10, 10);
     * var b = new pc.Vector3(20, 20, 20);
     * var r = new pc.Vector3();
     *
     * r.add(a, b);
     * // Should output [30, 30, 30]
     *
     * console.log("The result of the addition is: " + r.toString());
     * @author Will Eastcott
     */
    Vector3.prototype.add = function (lhs, rhs) {
        var a = lhs.data;
        var b = rhs.data;
        var r = this.data;

        r[0] = a[0] + b[0];
        r[1] = a[1] + b[1];
        r[2] = a[2] + b[2];

        return this;
    };

    /**
     * @function
     * @name pc.Vector3#addSelf
     * @description Adds a 3-dimensional vector to another in place.
     * @param {pc.Vector3} rhs The vector to add to the specified vector.
     * @returns {pc.Vector3} Self for chaining.
     * @example
     * var a = new pc.Vector3(10, 10, 10);
     * var b = new pc.Vector3(20, 20, 20);
     *
     * a.add(b);
     *
     * // Should output [30, 30, 30]
     * console.log("The result of the addition is: " + a.toString());
     * @author Will Eastcott
     */
    Vector3.prototype.addSelf = function (rhs) {
        var a = this.data;
        var b = rhs.data;

        a[0] += b[0];
        a[1] += b[1];
        a[2] += b[2];

        return this;
    };

    /**
     * @function
     * @name pc.Vector3#clone
     * @description Returns an identical copy of the specified 3-dimensional vector.
     * @returns {pc.Vector3} A 3-dimensional vector containing the result of the cloning.
     * @example
     * var v = new pc.Vector3(10, 20, 30);
     * var vclone = v.clone();
     * console.log("The result of the cloning is: " + vclone.toString());
     * @author Will Eastcott
     */
    Vector3.prototype.clone = function () {
        return new Vector3().copy(this);
    };

    /**
     * @function
     * @name pc.Vector#copy
     * @description Copied the contents of a source 3-dimensional vector to a destination 3-dimensional vector.
     * @param {Array} src A 3-dimensional vector to be copied.
     * @param {Array} dst A 3-dimensional vector that will recieve a copy of the source vector.
     * @example
     * var src = new pc.Vector3(10, 20, 30);
     * var dst = new pc.Vector3();
     *
     * dst.copy(src);
     *
     * console.log("The two vectors are " + (dst.equals(src) ? "equal" : "different"));
     * @author Will Eastcott
     */
    Vector3.prototype.copy = function (rhs) {
        var a = this.data;
        var b = rhs.data;

        a[0] = b[0];
        a[1] = b[1];
        a[2] = b[2];

        return this;
    };

    /**
     * @function
     * @name pc.Vector3#cross
     * @description Returns the result of a cross product operation performed on the two specified 3-dimensional vectors.
     * @param {pc.Vector3} lhs The first 3-dimensional vector operand of the cross product.
     * @param {pc.Vector3} rhs The second 3-dimensional vector operand of the cross product.
     * @returns {pc.Vector3} Self for chaining.
     * @example
     * var result = pc.Vector3.cross(pc.Vector3.xAxis, pc.Vector3.yAxis);
     * // Should print the Z axis (i.e. [0, 0, 1])
     * console.log("The result of the cross product is: " + result.toString());
     * @author Will Eastcott
     */
    Vector3.prototype.cross = function (lhs, rhs) {
        var a = lhs.data;
        var b = rhs.data;
        var r = this.data;

        r[0] = a[1] * b[2] - b[1] * a[2];
        r[1] = a[2] * b[0] - b[2] * a[0];
        r[2] = a[0] * b[1] - b[0] * a[1];

        return this;
    };

    /**
     * @function
     * @name pc.Vector3#dot
     * @description Returns the result of a dot product operation performed on the two specified 3-dimensional vectors.
     * @param {pc.Vector3} rhs The second 3-dimensional vector operand of the dot product.
     * @returns {Number} The result of the dot product operation.
     * @example
     * var v1 = new pc.Vector3(5, 10, 20);
     * var v2 = new pc.Vector3(10, 20, 40);
     * var v1dotv2 = v1.dot(v2);
     * console.log("The result of the dot product is: " + v1dotv2);
     * @author Will Eastcott
     */
    Vector3.prototype.dot = function (rhs) {
        var a = this.data;
        var b = rhs.data;

        return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
    };

    /**
     * @function
     * @name pc.Vector3#length
     * @description Returns the magnitude of the specified 3-dimensional vector.
     * @returns {Number} The magnitude of the specified 3-dimensional vector.
     * @example
     * var vec = new pc.Vector3(3, 4, 0);
     * var len = vec.length();
     * // Should output 5
     * console.log("The length of the vector is: " + len);
     * @author Will Eastcott
     */
    Vector3.prototype.length = function () {
        var v = this.data;

        return Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    };

    /**
     * @function
     * @name pc.Vector3#length
     * @description Returns the magnitude squared of the specified 3-dimensional vector.
     * @returns {Number} The magnitude of the specified 3-dimensional vector.
     * @example
     * var vec = new pc.Vector3(3, 4, 0);
     * var len = vec.lengthSqr();
     * // Should output 25
     * console.log("The length squared of the vector is: " + len);
     * @author Will Eastcott
     */
    Vector3.prototype.lengthSqr = function () {
        var v = this.data;

        return v[0]*v[0] + v[1]*v[1] + v[2]*v[2];
    };

    /**
     * @function
     * @name pc.Vector3.lerp
     * @description Returns the result of a linear interpolation between two specified 3-dimensional vectors.
     * @param {pc.Vector3} lhs The 3-dimensional to interpolate from.
     * @param {pc.Vector3} rhs The 3-dimensional to interpolate to.
     * @param {Number} alpha The value controlling the point of interpolation. Between 0 and 1, the linear interpolant
     * will occur on a straight line between lhs and rhs. Outside of this range, the linear interpolant will occur on
     * a ray extrapolated from this line.
     * @returns {pc.Vector3} Self for chaining.
     * @example
     * var a = new pc.Vector3(0, 0, 0);
     * var b = new pc.Vector3(10, 10, 10);
     * var r = new pc.Vector3();
     *
     * r.lerp(a, b, 0);   // r is equal to a
     * r.lerp(a, b, 0.5); // r is 5, 5, 5
     * r.lerp(a, b, 1);   // r is equal to b
     * @author Will Eastcott
     */
    Vector3.prototype.lerp = function(lhs, rhs, alpha) {
        var a = lhs.data;
        var b = rhs.data;
        var r = this.data;

        r[0] = a[0] + alpha * (b[0] - a[0]);
        r[1] = a[1] + alpha * (b[1] - a[1]);
        r[2] = a[2] + alpha * (b[2] - a[2]);

        return this;
    };

    /**
     * @function
     * @name pc.Vector3#mul
     * @description Returns the result of multiplying the specified 3-dimensional vectors together.
     * @param {pc.Vector3} lhs The 3-dimensional vector used as the first multiplicand of the operation.
     * @param {pc.Vector3} rhs The 3-dimensional vector used as the second multiplicand of the operation.
     * @returns {pc.Vector3} Self for chaining.
     * @example
     * var a = new pc.Vector3(2, 3, 4);
     * var b = new pc.Vector3(4, 5, 6);
     * var r = new pc.Vector3();
     *
     * r.mul(a, b);
     *
     * // Should output 8, 15, 24
     * console.log("The result of the multiplication is: " + r.toString());
     * @author Will Eastcott
     */
    Vector3.prototype.mul = function (lhs, rhs) {
        var a = lhs.data;
        var b = rhs.data;
        var r = this.data;

        r[0] = a[0] * b[0];
        r[1] = a[1] * b[1];
        r[2] = a[2] * b[2];

        return this;
    };

    /**
     * @function
     * @name pc.Vector3#mulSelf
     * @description Returns the result of multiplying the specified 3-dimensional vectors together.
     * @param {pc.Vector3} rhs The 3-dimensional vector used as the second multiplicand of the operation.
     * @returns {pc.Vector3} Self for chaining.
     * @example
     * var a = new pc.Vector3(2, 3, 4);
     * var b = new pc.Vector3(4, 5, 6);
     *
     * a.mulSelf(b);
     *
     * // Should output 8, 15, 24
     * console.log("The result of the multiplication is: " + a.toString());
     * @author Will Eastcott
     */
    Vector3.prototype.mulSelf = function (rhs) {
        var a = this.data;
        var b = rhs.data;

        a[0] += b[0];
        a[1] += b[1];
        a[2] += b[2];

        return this;
    };

    /**
     * @function
     * @name pc.Vector3#normalize
     * @description Returns the specified 3-dimensional vector copied and converted to a unit vector.
     * @returns {pc.Vector3} The result of the normalization.
     * @example
     * var a = new pc.Vector3(25, 0, 0);
     * var r = new pc.Vector3();
     *
     * pc.math.vec2.normalize(a, r);
     * // Should output 1, 0, 0
     * console.log("The result of the vector normalization is: " + r[0] + ", " + r[1] + ", " + r[2]);
     * @author Will Eastcott
     */
    Vector3.prototype.normalize = function () {
        return this.scale(1 / this.length());
    };
    
    /**
     * @function
     * @name pc.Vector3.project
     * @description Calculates the vector projection (also known as the vector resolute, or vector component)
     * of vector v0 in the direction of a vector v1.
     * @param {pc.Vector3} v0 The 3-dimensional vector to be projected.
     * @param {pc.Vector3} v1 The 3-dimensional direction vector onto which v0 is projected.
     * @param {pc.Vector3} r The point of projection of v0 onto v1.
     * @returns {pc.Vector3} The result of the projection (effectively a reference to the r parameter).
     * @example
     */
    Vector3.project = function (v0, v1, r) {
        var sqr = v1.lengthSqr();
        var dot = v0.dot(v1);

        return v1.scale(dot / sqr);
    };

    /**
     * @function
     * @name pc.Vector3#scale
     * @description Scales each dimension of the specified 3-dimensional vector by the supplied
     * scalar value.
     * @param {Number} scalar The value by which each vector dimension is multiplied.
     * @returns {Array} The result of the vector scale operation.
     * @example
     * var v = new pc.Vector3(2, 4, 8);
     * var r = new pc.Vector3();
     * 
     * // Multiply by 2
     * pc.math.vec3.scale(v, 2, r);
     * 
     * // Negate
     * pc.math.vec3.scale(v, -1, r);
     * 
     * // Divide by 2
     * pc.math.vec3.scale(v, 0.5, r);
     * @author Will Eastcott
     */
    Vector3.prototype.scale = function (scalar) {
        var a = this.data;

        a[0] *= scalar;
        a[1] *= scalar;
        a[2] *= scalar;

        return this;
    };

    /**
     * @function
     * @name pc.math.vec3.set
     * @description Sets the specified 3-dimensional vector to the supplied numerical values.
     * @param {Number} x The value to set on the first dimension of the vector.
     * @param {Number} y The value to set on the second dimension of the vector.
     * @param {Number} z The value to set on the third dimension of the vector.
     * @example
     * var v = new pc.Vector3();
     * v.set(5, 10, 20);
     *
     * // Should output 5, 10, 20
     * console.log("The result of the vector set is: " + v.toString());
     * @author Will Eastcott
     */
    Vector3.prototype.set = function (x, y, z) {
        var v = this.data;

        v[0] = x;
        v[1] = y;
        v[2] = z;

        return this;
    };

    /**
     * @function
     * @name pc.Vector3#sub
     * @description Subtracts two 3-dimensional vectors from one another and returns the result.
     * @param {pc.Vector3} lhs The first vector operand for the addition.
     * @param {pc.Vector3} rhs The second vector operand for the addition.
     * @returns {pc.Vector3} Self for chaining.
     * @example
     * var a = new pc.Vector3(10, 10, 10);
     * var b = new pc.Vector3(20, 20, 20);
     * var r = new pc.Vector3();
     *
     * r.sub(a, b);
     * // Should output [30, 30, 30]
     *
     * console.log("The result of the addition is: " + r.toString());
     * @author Will Eastcott
     */
    Vector3.prototype.sub = function (lhs, rhs) {
        var a = lhs.data;
        var b = rhs.data;
        var r = this.data;

        r[0] = a[0] - b[0];
        r[1] = a[1] - b[1];
        r[2] = a[2] - b[2];

        return this;
    };

    /**
     * @function
     * @name pc.Vector3#subSelf
     * @description Subtracts a 3-dimensional vector from another in place.
     * @param {pc.Vector3} rhs The vector to add to the specified vector.
     * @returns {pc.Vector3} Self for chaining.
     * @example
     * var a = new pc.Vector3(10, 10, 10);
     * var b = new pc.Vector3(20, 20, 20);
     *
     * a.subSelf(b);
     *
     * // Should output [30, 30, 30]
     * console.log("The result of the addition is: " + a.toString());
     * @author Will Eastcott
     */
    Vector3.prototype.subSelf = function (rhs) {
        var a = this.data;
        var b = rhs.data;

        a[0] -= b[0];
        a[1] -= b[1];
        a[2] -= b[2];

        return this;
    };

    /**
     * @function
     * @name pc.Vector3.toString
     * @description Converts the vector to string form.
     * @returns {String} The vector in string form.
     * @example
     * var v = new pc.Vector3(20, 10, 5);
     * // Should output '[20, 10, 5]'
     * console.log(v.toString());
     * @author Will Eastcott
     */
    Vector3.prototype.toString = function () {
        return "[" + this.data[0] + ", " + this.data[1] + ", " + this.data[2] + "]";
    };

    return {
        Vector3: Vector3
    };
}());
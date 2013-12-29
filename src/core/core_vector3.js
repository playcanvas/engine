pc.extend(pc, (function () {
    /**
    * @name pc.Vector3
    * @class A 3-dimensional vector.
    * @constructor Creates a new Vector3 object
    * @property {pc.Vector3} identity [Read only] The identity matrix.
    * @property {pc.Vector3} zero [Read only] A matrix with all elements set to zero.
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
        }();
    });

    Object.defineProperty(Vector3, 'down', {
        get: function () {
            var down = new Vector3(0, -1, 0);
            return function() {
                return down;
            }
        }();
    });

    Object.defineProperty(Vector3, 'forward', {
        get: function () {
            var forward = new Vector3(0, 0, -1);
            return function() {
                return forward;
            }
        }();
    });

    Object.defineProperty(Vector3, 'left', {
        get: function () {
            var left = new Vector3(-1, 0, 0);
            return function() {
                return left;
            }
        }();
    });

    Object.defineProperty(Vector3, 'one', {
        get: function () {
            var one = new Vector3(1, 1, 1);
            return function() {
                return one;
            }
        }();
    });

    Object.defineProperty(Vector3, 'right', {
        get: function () {
            var right = new Vector3(1, 0, 0);
            return function() {
                return right;
            }
        }();
    });

    Object.defineProperty(Vector3, 'up', {
        get: function () {
            var down = new Vector3(0, 1, 0);
            return function() {
                return down;
            }
        }();
    });

    Object.defineProperty(Vector3, 'zero', {
        get: function () {
            var zero = new Vector3(0, 0, 0);
            return function() {
                return zero;
            }
        }();
    });

    /**
     * @function
     * @name pc.Vector3.add
     * @description Adds two 3-dimensional vectors together and returns the result.
     * @param {pc.Vector3} lhs The first vector operand for the addition.
     * @param {pc.Vector3} rhs The second vector operand for the addition.
     * @param {pc.Vector3} [res] A vector to which the result of the addition is written.
     * @returns {pc.Vector3} A 3-dimensional vector containing the result of the addition.
     * @example
     * var v0 = new pc.Vector3(10, 10, 10);
     * var v1 = new pc.Vector3(20, 20, 20);
     * var r = Vector3.add(v0, v1);
     * // Should output [30, 30, 30]
     * console.log("The result of the addition is: " + r.toString());
     * @author Will Eastcott
     */
    Vector3.add = function (lhs, rhs, res) {
        if (typeof res === 'undefined') {
            res = new Vector3();
        }

        var a = lhs.data;
        var b = rhs.data;
        var r = res.data;

        r[0] = a[0] + b[0];
        r[1] = a[1] + b[1];
        r[2] = a[2] + b[2];

        return res;
    };

    /**
     * @function
     * @name pc.Vector3#add
     * @description Adds a 3-dimensional vector to another in place.
     * @param {pc.Vector3} rhs The vector to add to the specified vector.
     * @returns {pc.Vector3} A 3-dimensional vector containing the result of the addition
     * (useful for chaining).
     * @example
     * var v0 = new pc.Vector3(10, 10, 10);
     * var v1 = new pc.Vector3(20, 20, 20);
     * v0.add(v1);
     * // Should output [30, 30, 30]
     * console.log("The result of the addition is: " + v0.toString());
     * @author Will Eastcott
     */
    Vector3.prototype.add = function (rhs) {
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
     * var src = pc.math.vec3.create(10, 20, 30);
     * var dst = pc.math.vec3.create();
     * pc.math.vec2.copy(src, dst);
     * var same = ((src[0] === dst[0]) && (src[1] === dst[1]) && (src[2] === dst[2]));
     * console.log("The two vectors are " + (same ? "equal" : "different"));
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
     * @name pc.Vector3.cross
     * @description Returns the result of a cross product operation performed on the two specified 3-dimensional vectors.
     * @param {pc.Vector3} lhs The first 3-dimensional vector operand of the cross product.
     * @param {pc.Vector3} rhs The second 3-dimensional vector operand of the cross product.
     * @param {pc.Vector3} [res] The 3-dimensional vector orthogonal to both v0 and v1.
     * @returns {pc.Vector3} The 3-dimensional vector orthogonal to both v0 and v1.
     * @example
     * var result = pc.Vector3.cross(pc.Vector3.xAxis, pc.Vector3.yAxis);
     * // Should print the Z axis (i.e. [0, 0, 1])
     * console.log("The result of the cross product is: " + result.toString());
     * @author Will Eastcott
     */
    Vector3.cross = function (lhs, rhs, res) {
        if (typeof res === 'undefined') {
            res = new Vector3();
        }

        var a = lhs.data;
        var b = rhs.data;
        var r = res.data;

        r[0] = a[1] * b[2] - b[1] * a[2];
        r[1] = a[2] * b[0] - b[2] * a[0];
        r[2] = a[0] * b[1] - b[0] * a[1];

        return res;
    };

    /**
     * @function
     * @name pc.Vector3#cross
     * @description Returns the result of a cross product operation performed on the two specified 3-dimensional vectors.
     * @param {pc.Vector3} lhs The first 3-dimensional vector operand of the cross product.
     * @param {pc.Vector3} rhs The second 3-dimensional vector operand of the cross product.
     * @param {pc.Vector3} [res] The 3-dimensional vector orthogonal to both v0 and v1.
     * @returns {pc.Vector3} The 3-dimensional vector orthogonal to both v0 and v1.
     * @example
     * var result = pc.Vector3.cross(pc.Vector3.xAxis, pc.Vector3.yAxis);
     * // Should print the Z axis (i.e. [0, 0, 1])
     * console.log("The result of the cross product is: " + result.toString());
     * @author Will Eastcott
     */
    Vector3.prototype.cross = function (lhs, rhs) {
        return Vector3.cross(lhs, rhs, this);
    };

    /**
     * @function
     * @name pc.Vector3#dot
     * @description Returns the result of a dot product operation performed on the two specified 3-dimensional vectors.
     * @param {Array} v0 The first 3-dimensional vector operand of the dot product.
     * @param {Array} v1 The second 3-dimensional vector operand of the dot product.
     * @returns {number} The result of the dot product operation.
     * @example
     * var v1 = pc.math.vec3.create(5, 10, 20);
     * var v2 = pc.math.vec3.create(10, 20, 40);
     * var v1dotv2 = pc.math.vec3.dot(v1, v2);
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
        return Math.sqrt(this.dot(this));
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
        return this.dot(this);
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
     * @param {pc.Vector3} [res] The result of the linear interpolation.
     * @returns {pc.Vector3} The result of the linear interpolation (effectively a reference to the r parameter).
     * @example
     * var a = new pc.Vector3(0, 0, 0);
     * var b = new pc.Vector3(10, 10, 10);
     * var r;
     *
     * r = pc.Vector3.lerp(a, b, 0);   // r is equal to a
     * r = pc.Vector3.lerp(a, b, 0.5); // r is 5, 5, 5
     * r = pc.Vector3.lerp(a, b, 1);   // r is equal to b
     * @author Will Eastcott
     */
    Vector3.lerp = function(lhs, rhs, alpha, res) {
        if (typeof res === 'undefined') {
            res = new Vector3();
        }

        var a = lhs.data;
        var b = rhs.data;
        var r = res.data;

        r[0] = a[0] + alpha * (b[0] - a[0]);
        r[1] = a[1] + alpha * (b[1] - a[1]);
        r[2] = a[2] + alpha * (b[2] - a[2]);

        return res;
    };

    /**
     * @function
     * @name pc.Vector3#lerp
     * @description Returns the result of a linear interpolation between two specified 3-dimensional vectors.
     * @param {pc.Vector3} lhs The 3-dimensional to interpolate from.
     * @param {pc.Vector3} rhs The 3-dimensional to interpolate to.
     * @param {Number} alpha The value controlling the point of interpolation. Between 0 and 1, the linear interpolant
     * will occur on a straight line between lhs and rhs. Outside of this range, the linear interpolant will occur on
     * a ray extrapolated from this line.
     * @returns {pc.Vector3} The result of the linear interpolation (effectively a reference to the r parameter).
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
    Vector3.prototype.lerp = function (lhs, rhs, alpha) {
        return Vector3.lerp(lhs, rhs, alpha, this);
    };

    /**
     * @function
     * @name pc.math.vec3.multiply
     * @description Returns the result of multiplying the specified 3-dimensional vector together.
     * @param {Array} v0 The 3-dimensional vector used as the first multiplicand of the operation.
     * @param {Array} v1 The 3-dimensional vector used as the second multiplicand of the operation.
     * @param {Array} r The result of the multiplication.
     * @returns {Array} The result of the multiplication (effectively a reference to the r parameter).
     * @example
     * var a = pc.math.vec2.create(2, 3, 4);
     * var b = pc.math.vec2.create(4, 5, 6);
     * var r = pc.math.vec2.create();
     *
     * pc.math.vec2.multiply(a, b, r);
     * // Should output 8, 15, 24
     * console.log("The result of the multiplication is: " + r[0] + ", " + r[1] + ", " + r[2]);
     * @author Will Eastcott
     */
    Vector3.mul = function (lhs, rhs, res) {
        if (typeof res === 'undefined') {
            res = new Vector3();
        }

        var a = lhs.data;
        var b = rhs.data;
        var r = res.data;

        r[0] = a[0] * b[0];
        r[1] = a[1] * b[1];
        r[2] = a[2] * b[2];

        return res;
    };

    Vector3.prototype.mul = function (rhs) {
        return Vector3.mul(this, rhs, this);
    };

    /**
     * @function
     * @name pc.Vector3#normalize
     * @description Returns the specified 3-dimensional vector copied and converted to a unit vector.
     * @returns {pc.Vector3} The result of the normalization.
     * @example
     * var a = pc.math.vec3.create(25, 0, 0);
     * var r = pc.math.vec3.create();
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
     * @name pc.math.vec3.project
     * @description Calculates the vector projection (also known as the vector resolute, or vector component)
     * of vector v0 in the direction of a vector v1.
     * @param {Array} v0 The 3-dimensional vector to be projected.
     * @param {Array} v1 The 3-dimensional direction vector onto which v0 is projected.
     * @param {Array} r The point of projection of v0 onto v1.
     * @returns {Array} The result of the projection (effectively a reference to the r parameter).
     * @example
     */
    project: function (v0, v1, r) {
        var sqr = pc.math.vec3.dot(v1, v1);
        var dot = pc.math.vec3.dot(v0, v1);
        
        return pc.math.vec3.scale(v1, dot / sqr, r);
    };

    /**
     * @function
     * @name pc.Vector3#scale
     * @description Scales each dimension of the specified 3-dimensional vector by the supplied
     * scalar value.
     * @param {Number} scalar The value by which each vector dimension is multiplied.
     * @returns {Array} The result of the vector scale operation.
     * @example
     * var v = pc.math.vec3.create(2, 4, 8);
     * var r = pc.math.vec3.create();
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
     * @param {Array} v0 The 3-dimensional vector to be set.
     * @param {number} x The value to set on the first dimension of the vector.
     * @param {number} y The value to set on the second dimension of the vector.
     * @param {number} z The value to set on the third dimension of the vector.
     * @example
     * var v = pc.math.vec3.create();
     * pc.math.vec3.set(v, 5, 10, 20);
     *
     * // Should output 5, 10, 20
     * console.log("The result of the vector set is: " + v[0] + ", " + v[1] + ", " + v[2]);
     * @author Will Eastcott
     */
    Vector3.prototype.set = function (x, y, z) {
        var a = this.data;

        a[0] = x;
        a[1] = y;
        a[2] = z;

        return this;
    };

    /**
     * @function
     * @name pc.Vector3.sub
     * @description Subtracts one 3-dimensional vector from another and returns the result.
     * @param {pc.Vector3} lhs The minuend of the subtraction.
     * @param {pc.Vector3} rhs The subtrahend of the subtraction.
     * @param {pc.Vector3} res A vector to which the result of the subtraction is written.
     * @returns {pc.Vector3} The result of the subtraction (useful for chaining).
     * @example
     * var v0 = new pc.Vector3(20, 10, 5);
     * var v1 = new pc.Vector3(10, 5, 2);
     * var r = pc.Vector3.sub(v0, v1);
     * // Should output 10, 5, 3
     * console.log("The result of the subtraction is: " + r.toString());
     * @author Will Eastcott
     */
    Vector3.sub = function (lhs, rhs, res) {
        if (typeof res === 'undefined') {
            res = new Vector3();
        }

        var a = lhs.data;
        var b = rhs.data;
        var r = res.data;

        r[0] = a[0] - b[0];
        r[1] = a[1] - b[1];
        r[2] = a[2] - b[2];

        return res;
    };

    Vector3.prototype.sub = function (rhs) {
        return Vector3.sub(this, rhs, this);
    };

    Vector3.prototype.toString = function () {
        return "[" + this.data[0] + ", " + this.data[1] + ", " + this.data[2] + "]";
    };

    return {
        Vector3: Vector3
    };
}();
/**
 * @namespace
 * @name pc.math.vec2
 */
pc.math.vec2 = function () {

    // Public functions
    return {
        /**
         * @function
         * @name pc.math.vec2.add
         * @description Adds two 2-dimensional vectors together and returns the result.
         * @param {Array} v0 The first vector operand for the addition.
         * @param {Array} v1 The second vector operand for the addition.
         * @param {Array} r A vector to which the result of the addition is written.
         * @returns {Array} A 2-dimensional vector containing the result of the addition.
         * @example
         * var v0 = pc.math.vec2.create(10, 10);
         * var v1 = pc.math.vec2.create(20, 20);
         * var result = pc.math.vec2.create();
         * pc.math.vec2.add(v0, v1, result);
         * // Should output 30, 30
         * console.log("The result of the addition is: " + result[0] + ", " + result[1]);
         * @author Will Eastcott
         */
        add: function (v0, v1, r) {
            r[0] = v0[0] + v1[0];
            r[1] = v0[1] + v1[1];
            return r;
        },
        
        /**
         * @function
         * @name pc.math.vec2.clone
         * @description Returns an identical copy of the specified 2-dimensional vector.
         * @param {Array} v0 A 2-dimensional vector that will to be cloned and returned.
         * @returns {Array} A 2-dimensional vector containing the result of the cloning.
         * @example
         * var v = pc.math.vec2.create(10, 20);
         * var vclone = pc.math.vec2.clone(v);
         * console.log("The result of the cloning is: " + vclone[0] + ", " + vclone[1]);
         * @author Will Eastcott
         */
        clone: function (v0) {
            return new Float32Array(v0);
        },

        /**
         * @function
         * @name pc.math.vec2.copy
         * @description Copies the contents of a source 2-dimensional vector to a destination 2-dimensional vector.
         * @param {Array} src A 2-dimensional vector to be copied.
         * @param {Array} dst A 2-dimensional vector that will recieve a copy of the source vector.
         * @example
         * var src = pc.math.vec2.create(10, 20);
         * var dst = pc.math.vec2.create();
         * pc.math.vec2.copy(src, dst);
         * var same = ((src[0] === dst[0]) && (src[1] === dst[1]));
         * console.log("The two vectors are " + (same ? "equal" : "different"));
         * @author Will Eastcott
         */
        copy: function (v0, r) {
            r[0] = v0[0];
            r[1] = v0[1];
        },

        /**
         * @function
         * @name pc.math.vec2.create
         * @description Creates a new 2-dimensional vector set to the specified values.
         * @param {number} x The value of the x component of the 2D vector.
         * @param {number} y The value of the y component of the 2D vector.
         * @returns {Array} A new 2-dimensional vector.
         * @example
         * // Create a 2-dimensional vector with both components set to undefined
         * var v1 = pc.math.vec2.create();
         * // Create a 2-dimensional vector set valid values
         * var v2 = pc.math.vec2.create(10, 20);
         * @author Will Eastcott
         */
        create: function (x, y) {
            var v = new Float32Array(2);
            v[0] = x;
            v[1] = y;
            return v;
        },

        /**
         * @function
         * @name pc.math.vec2.dot
         * @description Returns the result of a dot product operation performed on the two specified 2-dimensional vectors.
         * @param {Array} v0 The first 2-dimensional vector operand of the dot product.
         * @param {Array} v1 The second 2-dimensional vector operand of the dot product.
         * @returns {number} The result of the dot product operation.
         * @example
         * var v1 = pc.math.vec2.create(5, 10);
         * var v2 = pc.math.vec2.create(10, 20);
         * var v1dotv2 = pc.math.vec2.dot(v1, v2);
         * console.log("The result of the dot product is: " + v1dotv2);
         * @author Will Eastcott
         */
        dot: function (v0, v1) {
            return v0[0]*v1[0] + v0[1]*v1[1];
        },

        /**
         * @function
         * @name pc.math.vec2.length
         * @description Returns the magnitude of the specified 2-dimensional vector.
         * @param {Array} v0 The 2-dimensional vector whose length is to be calculated.
         * @returns {number} The magnitude of the specified 2-dimensional vector.
         * @example
         * var vec = pc.math.vec2.create(3, 4);
         * var len = pc.math.vec2.length(vec);
         * // Should output 5
         * console.log("The length of the vector is: " + len);
         * @author Will Eastcott
         */
        length: function (v0) {
            return Math.sqrt(pc.math.vec2.dot(v0, v0));
        },

        /**
         * @function
         * @name pc.math.vec2.lerp
         * @description Returns the result of a linear interpolation between two specified 2-dimensional vectors.
         * @param {Array} v0 The 2-dimensional to interpolate from.
         * @param {Array} v1 The 2-dimensional to interpolate to.
         * @param {number} alpha The value controlling the point of interpolation. Between 0 and 1, the linear interpolant
         * will occur on a straight line between v0 and v1. Outside of this range, the linear interpolant will occur on
         * a ray extrapolated from this line.
         * @param {Array} The result of the linear interpolation.
         * @returns {Array} The result of the linear interpolation (effectively a reference to the r parameter).
         * @example
         * var a = pc.math.vec2.create(0, 0);
         * var b = pc.math.vec2.create(10, 10);
         * var r = pc.math.vec2.create();
         * 
         * pc.math.vec2.lerp(a, b, 0.0, r); // r is equal to a
         * pc.math.vec2.lerp(a, b, 0.5, r); // r is 5, 5
         * pc.math.vec2.lerp(a, b, 1.0, r); // r is equal to b
         * @author Will Eastcott
         */
        lerp: function(v0, v1, alpha, r) {
            r[0] = v0[0] + alpha * (v1[0] - v0[0]);
            r[1] = v0[1] + alpha * (v1[1] - v0[1]);
            return r;
        },

        /**
         * @function
         * @name pc.math.vec2.multiply
         * @description Returns the result of multiplying the specified 2-dimensional vectors together.
         * @param {Array} v0 The 2-dimensional vector used as the first multiplicand of the operation.
         * @param {Array} v1 The 2-dimensional vector used as the second multiplicand of the operation.
         * @param {Array} r The result of the multiplication.
         * @returns {Array} The result of the multiplication (effectively a reference to the r parameter).
         * @example
         * var a = pc.math.vec2.create(2, 3);
         * var b = pc.math.vec2.create(4, 5);
         * var r = pc.math.vec2.create();
         *
         * pc.math.vec2.multiply(a, b, r);
         * // Should output 8, 15
         * console.log("The result of the multiplication is: " + r[0] + ", " + r[1]);
         * @author Will Eastcott
         */
        multiply: function (v0, v1, r) {
            r[0] = v0[0] * v1[0];
            r[1] = v0[1] * v1[1];
            return r;
        },

        /**
         * @function
         * @name pc.math.vec2.normalize
         * @description Returns the specified 2-dimensional vector copied and converted to a unit vector.
         * @param {Array} v0 The 2-dimensional vector to be normalized.
         * @param {Array} r The result of normalizing the source vector.
         * @returns {Array} The result of the normalization (effectively a reference to the r parameter).
         * @example
         * var a = pc.math.vec2.create(25, 0);
         * var r = pc.math.vec2.create();
         *
         * pc.math.vec2.normalize(a, r);
         * // Should output 1, 0
         * console.log("The result of the vector normalization is: " + r[0] + ", " + r[1]);
         * @author Will Eastcott
         */
        normalize: function (v0, r) {
            var length = pc.math.vec2.length(v0);
            pc.math.vec2.scale(v0, 1.0 / length, r);
            return r;
        },

        /**
         * @function
         * @name pc.math.vec2.scale
         * @description Scales each dimension of the specific 2-dimensional vector by the supplied
         * scalar value.
         * @param {Array} v0 The 2-dimensional vector to be scaled.
         * @param {number} s The value by which each vector dimension is multiplied.
         * @param {Array} r The result of scaling the source vector.
         * @returns {Array} The result of the vector scale operation (effectively a reference to the r parameter).
         * @example
         * var v = pc.math.vec2.create(2, 4);
         * var r = pc.math.vec2.create();
         * 
         * // Multiply by 2
         * pc.math.vec2.scale(v, 2, r);
         * 
         * // Negate
         * pc.math.vec2.scale(v, -1, r);
         * 
         * // Divide by 2
         * pc.math.vec2.scale(v, 0.5, r);
         * @author Will Eastcott
         */
        scale: function (v0, s, r) {
            r[0] = v0[0] * s;
            r[1] = v0[1] * s;
            return r;
        },

        /**
         * @function
         * @name pc.math.vec2.set
         * @description Sets the specified 2-dimensional vector to the supplied numerical values.
         * @param {Array} v0 The 2-dimensional vector to be set.
         * @param {number} x The value to set on the first dimension of the vector.
         * @param {number} y The value to set on the second dimension of the vector.
         * @example
         * var v = pc.math.vec2.create();
         * pc.math.vec2.set(v, 5, 10);
         *
         * // Should output 5, 10
         * console.log("The result of the vector set is: " + v[0] + ", " + v[1]);
         * @author Will Eastcott
         */
        set: function (v0, x, y) {
            v0[0] = x;
            v0[1] = y;
        },

        /**
         * @function
         * @name pc.math.vec2.subtract
         * @description Subtracts one 2-dimensional vector from another and returns the result.
         * @param {Array} v0 The minuend of the subtraction.
         * @param {Array} v1 The subtrahend of the subtraction.
         * @param {Array} r A vector to which the result of the subtraction is written.
         * @returns {Array} The result of the subtraction (effectively a reference to the r parameter).
         * @example
         * var v0 = pc.math.vec2.create(10, 5);
         * var v1 = pc.math.vec2.create(5, 2);
         * var result = pc.math.vec2.create(0, 0);
         * pc.math.vec2.subtract(v0, v1, result);
         * // Should output 5, 3
         * console.log("The result of the subtraction is: " + result[0] + ", " + result[1]);
         * @author Will Eastcott
         */
        subtract: function (v0, v1, r) {
            r[0] = v0[0] - v1[0];
            r[1] = v0[1] - v1[1];
            return r;
        },
        
        /**
         * @function
         * @name pc.math.vec2.sum
         * @description Adds an arbitrary number of 2-dimensional vectors together and returns the result.
         * @param {Array} v A vector that will be treated as an operand for the summation. The number of vectors that can
         * be specified is arbitrary.
         * @param {Array} r A vector to which the result of the summation is written. This parameter must be placed last in
         * parameter list.
         * @returns {Array} A 2-dimensional vector containing the result of the summation.
         * @example
         * var v = [];
         * for (var i = 0; i < 5; i++) {
         *     v.push(pc.math.vec2.create(i, i));
         * }
         * var result = pc.math.vec2.create();
         * pc.math.vec2.sum(v[0], v[1], v[2], v[3], v[4], result);
         * console.log("The result of the sum is: " + result[0] + ", " + result[1]);
         * @author Will Eastcott
         */
        sum: function () {
            var i;
            var num = arguments.length - 1;
            var x = 0;
            var y = 0;

            for(i = 0; i < num; ++i) {
                x += arguments[i][0];
                y += arguments[i][1];
            }
            
            arguments[num][0] = x;
            arguments[num][1] = y;
            
            return arguments[num];
        }
    };
} ();

/**
 * @namespace
 * @name pc.math.vec3
 */
pc.math.vec3 = function () {

    // Public functions
    return {
        zero: new Float32Array([0, 0, 0]),
        one: new Float32Array([1, 1, 1]),
        xaxis: new Float32Array([1, 0, 0]),
        yaxis: new Float32Array([0, 1, 0]),
        zaxis: new Float32Array([0, 0, 1]),

        /**
         * @function
         * @name pc.math.vec3.add
         * @description Adds two 3-dimensional vectors together and returns the result.
         * @param {Array} v0 The first vector operand for the addition.
         * @param {Array} v1 The second vector operand for the addition.
         * @param {Array} r A vector to which the result of the addition is written.
         * @returns {Array} A 3-dimensional vector containing the result of the addition.
         * @example
         * var v0 = pc.math.vec3.create(10, 10, 10);
         * var v1 = pc.math.vec3.create(20, 20, 20);
         * var result = pc.math.vec3.create();
         * pc.math.vec3.add(v0, v1, result);
         * // Should output 30, 30, 30
         * console.log("The result of the addition is: " + result[0] + ", " + result[1] + ", " + result[2]);
         * @author Will Eastcott
         */
        add: function (v0, v1, r) {
            r[0] = v0[0] + v1[0];
            r[1] = v0[1] + v1[1];
            r[2] = v0[2] + v1[2];
            return r;
        },
        
        /**
         * @function
         * @name pc.math.vec3.sum
         * @description Adds an arbitrary number of 3-dimensional vectors together and returns the result.
         * @param {Array} v A vector that will be treated as an operand for the summation. The number of vectors that can
         * be specified is arbitrary.
         * @param {Array} r A vector to which the result of the summation is written. This parameter must be placed last in
         * parameter list.
         * @returns {Array} A 3-dimensional vector containing the result of the summation.
         * @example
         * var v = [];
         * for (var i = 0; i < 5; i++) {
         *     v.push(pc.math.vec3.create(i, i, i));
         * }
         * var result = pc.math.vec3.create();
         * pc.math.vec3.sum(v[0], v[1], v[2], v[3], v[4], result);
         * console.log("The result of the sum is: " + result[0] + ", " + result[1] + ", " + result[2]);
         * @author Will Eastcott
         */
        sum: function () {
            var i;
            var num = arguments.length - 1;
            var x = 0;
            var y = 0;
            var z = 0;

            for(i = 0; i < num; ++i) {
                x += arguments[i][0];
                y += arguments[i][1];
                z += arguments[i][2];
            }
            
            arguments[num][0] = x;
            arguments[num][1] = y;
            arguments[num][2] = z;
            return arguments[num];
        },

        /**
         * @function
         * @name pc.math.vec3.clone
         * @description Returns an identical copy of the specified 2-dimensional vector.
         * @param {Array} v0 A 3-dimensional vector that will to be cloned and returned.
         * @returns {Array} A 3-dimensional vector containing the result of the cloning.
         * @example
         * var v = pc.math.vec3.create(10, 20, 30);
         * var vclone = pc.math.vec3.clone(v);
         * console.log("The result of the cloning is: " + vclone[0] + ", " + vclone[1] + ", " + vclone[2]);
         * @author Will Eastcott
         */
        clone: function (v0) {
            return new Float32Array(v0);
        },

        /**
         * @function
         * @name pc.math.vec3.copy
         * @description Copied the contents of a source 2-dimensional vector to a destination 3-dimensional vector.
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
        copy: function (v0, r) {
            r[0] = v0[0];
            r[1] = v0[1];
            r[2] = v0[2];
        },

        /**
         * @function
         * @name pc.math.vec3.create
         * @description Creates a new 3-dimensional vector set to the specified values.
         * @param {number} x The value of the x component of the 3D vector.
         * @param {number} y The value of the y component of the 3D vector.
         * @param {number} z The value of the z component of the 3D vector.
         * @returns {Array} A new 3-dimensional vector.
         * @example
         * // Create a 3-dimensional vector with all three components set to 'undefined'
         * var v1 = pc.math.vec3.create();
         * // Create a 3-dimensional vector set valid values
         * var v2 = pc.math.vec3.create(10, 20, 30);
         * @author Will Eastcott
         */
        create: function () {
            var v;
            if (arguments.length === 3) {
               v = new Float32Array(arguments);
               return v;
            } else {
               v = new Float32Array(3);
               return v;
            }
        },

        /**
         * @function
         * @name pc.math.vec3.cross
         * @description Returns the result of a cross product operation performed on the two specified 3-dimensional vectors.
         * @param {Array} v0 The first 3-dimensional vector operand of the cross product.
         * @param {Array} v1 The second 3-dimensional vector operand of the cross product.
         * @returns {Array} The 3-dimensional vector orthogonal to both v0 and v1.
         * @example
         * var v1 = pc.math.vec3.create(5, 10, 20);
         * var v2 = pc.math.vec3.create(10, 20, 40);
         * var crossProd = pc.math.vec3.cross(v1, v2);
         * console.log("The result of the dot product is: " + crossProd[0] + ", " + crossProd[1] + ", " + crossProd[2]);
         * @author Will Eastcott
         */
        cross: function (v0, v1, r) {
            r[0] = v0[1] * v1[2] - v1[1] * v0[2];
            r[1] = v0[2] * v1[0] - v1[2] * v0[0];
            r[2] = v0[0] * v1[1] - v1[0] * v0[1];
            return r;
        },

        /**
         * @function
         * @name pc.math.vec3.dot
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
        dot: function (v0, v1) {
            return v0[0]*v1[0] + v0[1]*v1[1] + v0[2]*v1[2];
        },

        /**
         * @function
         * @name pc.math.vec3.length
         * @description Returns the magnitude of the specified 3-dimensional vector.
         * @param {Array} v0 The 3-dimensional vector whose length is to be calculated.
         * @returns {number} The magnitude of the specified 3-dimensional vector.
         * @example
         * var vec = pc.math.vec3.create(3, 4, 0);
         * var len = pc.math.vec3.length(vec);
         * // Should output 5
         * console.log("The length of the vector is: " + len);
         * @author Will Eastcott
         */
        length: function (v0) {
            return Math.sqrt(pc.math.vec3.dot(v0, v0));
        },

        /**
         * @function
         * @name pc.math.vec3.lerp
         * @description Returns the result of a linear interpolation between two specified 3-dimensional vectors.
         * @param {Array} v0 The 3-dimensional to interpolate from.
         * @param {Array} v1 The 3-dimensional to interpolate to.
         * @param {number} alpha The value controlling the point of interpolation. Between 0 and 1, the linear interpolant
         * will occur on a straight line between v0 and v1. Outside of this range, the linear interpolant will occur on
         * a ray extrapolated from this line.
         * @param {Array} r The result of the linear interpolation.
         * @returns {Array} The result of the linear interpolation (effectively a reference to the r parameter).
         * @example
         * var a = pc.math.vec3.create(0, 0, 0);
         * var b = pc.math.vec3.create(10, 10, 10);
         * var r = pc.math.vec3.create();
         * 
         * pc.math.vec2.lerp(a, b, 0.0, r); // r is equal to a
         * pc.math.vec2.lerp(a, b, 0.5, r); // r is 5, 5, 5
         * pc.math.vec2.lerp(a, b, 1.0, r); // r is equal to b
         * @author Will Eastcott
         */
        lerp: function(v0, v1, alpha, r) {
            r[0] = v0[0] + alpha * (v1[0] - v0[0]);
            r[1] = v0[1] + alpha * (v1[1] - v0[1]);
            r[2] = v0[2] + alpha * (v1[2] - v0[2]);
            return r;
        },

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
        multiply: function (v0, v1, r) {
            r[0] = v0[0] * v1[0];
            r[1] = v0[1] * v1[1];
            r[2] = v0[2] * v1[2];
            return r;
        },

        /**
         * @function
         * @name pc.math.vec3.normalize
         * @description Returns the specified 3-dimensional vector copied and converted to a unit vector.
         * @param {Array} v0 The 3-dimensional vector to be normalized.
         * @param {Array} r The result of normalizing the source vector.
         * @returns {Array} The result of the normalization (effectively a reference to the r parameter).
         * @example
         * var a = pc.math.vec3.create(25, 0, 0);
         * var r = pc.math.vec3.create();
         *
         * pc.math.vec2.normalize(a, r);
         * // Should output 1, 0, 0
         * console.log("The result of the vector normalization is: " + r[0] + ", " + r[1] + ", " + r[2]);
         * @author Will Eastcott
         */
        normalize: function (v0, r) {
            var length = pc.math.vec3.length(v0);
            pc.math.vec3.scale(v0, 1.0 / length, r);
            return r;
        },
        
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
        },

        /**
         * @function
         * @name pc.math.vec3.scale
         * @description Scales each dimension of the specified 3-dimensional vector by the supplied
         * scalar value.
         * @param {Array} v0 The 3-dimensional vector to be scaled.
         * @param {number} s The value by which each vector dimension is multiplied.
         * @param {Array} r The result of scaling the source vector.
         * @returns {Array} The result of the vector scale operation (effectively a reference to the r parameter).
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
        scale: function (v0, s, r) {
            r[0] = v0[0] * s;
            r[1] = v0[1] * s;
            r[2] = v0[2] * s;
            return r;
        },

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
        set : function (v0, x, y, z) {
            v0[0] = x;
            v0[1] = y;
            v0[2] = z;
        },

        /**
         * @function
         * @name pc.math.vec3.subtract
         * @description Subtracts one 3-dimensional vector from another and returns the result.
         * @param {Array} v0 The minuend of the subtraction.
         * @param {Array} v1 The subtrahend of the subtraction.
         * @param {Array} r A vector to which the result of the subtraction is written.
         * @returns {Array} The result of the subtraction (effectively a reference to the r parameter).
         * @example
         * var v0 = pc.math.vec3.create(20, 10, 5);
         * var v1 = pc.math.vec3.create(10, 5, 2);
         * var r = pc.math.vec3.create();
         * pc.math.vec3.subtract(v0, v1, r);
         * // Should output 10, 5, 3
         * console.log("The result of the subtraction is: " + r[0] + ", " + r[1] + ", " + r[2]);
         * @author Will Eastcott
         */
        subtract : function (v0, v1, r) {
            r[0] = v0[0] - v1[0];
            r[1] = v0[1] - v1[1];
            r[2] = v0[2] - v1[2];
            return r;
        }
    };
} ();

/**
 * @namespace
 * @name pc.math.vec4
 */
pc.math.vec4 = function () {

    // Public functions
    return {

        add : function (v0, v1, r) {
            r[0] = v0[0] + v1[0];
            r[1] = v0[1] + v1[1];
            r[2] = v0[2] + v1[2];
            r[3] = v0[3] + v1[3];
            return r;
        },

        clone : function (v0) {
            return new Float32Array(v0);
        },

        copy : function (v0, r) {
            r[0] = v0[0];
            r[1] = v0[1];
            r[2] = v0[2];
            r[3] = v0[3];
        },

        create : function () {
            var v;
            if (arguments.length === 4) {
               v = new Float32Array(arguments);
               return v;
            } else {
               v = new Float32Array(4);
               return v;
            }
        },

        dot : function (v0, v1) {
            return v0[0]*v1[0] + v0[1]*v1[1] + v0[2]*v1[2] + v0[3]*v1[3];
        },

        length : function (v0) {
            return Math.sqrt(pc.math.vec4.dot(v0, v0));
        },

        lerp : function(v0, v1, alpha, r) {
            r[0] = v0[0] + alpha * (v1[0] - v0[0]);
            r[1] = v0[1] + alpha * (v1[1] - v0[1]);
            r[2] = v0[2] + alpha * (v1[2] - v0[2]);
            r[3] = v0[3] + alpha * (v1[3] - v0[3]);
        },
        
        multiply : function (v0, v1, r) {
            r[0] = v0[0] * v1[0];
            r[1] = v0[1] * v1[1];
            r[2] = v0[2] * v1[2];
            r[3] = v0[3] * v1[3];
            return r;
        },

        /**
         * @function
         * @name pc.math.vec4.normalize
         * @description Returns the specified 4-dimensional vector copied and converted to a unit vector.
         * @param {Array} v0 The 4-dimensional vector to be normalized.
         * @param {Array} r The result of normalizing the source vector.
         * @returns {Array} The result of the normalization (effectively a reference to the r parameter).
         * @example
         * var a = pc.math.vec4.create(25, 0, 0, 1);
         * var r = pc.math.vec4.create();
         *
         * pc.math.vec4.normalize(a, r);
         * // Should output 1, 0, 0, 1
         * console.log("The result of the vector normalization is: " + r[0] + ", " + r[1] + ", " + r[2]);
         * @author Will Eastcott
         */
        normalize: function (v0, r) {
            var length = pc.math.vec4.length(v0);
            pc.math.vec4.scale(v0, 1.0 / length, r);
            return r;
        },

        /**
         * @function
         * @name pc.math.vec4.scale
         * @description Scales each dimension of the specified 4-dimensional vector by the supplied
         * scalar value.
         * @param {Array} v0 The 4-dimensional vector to be scaled.
         * @param {number} s The value by which each vector dimension is multiplied.
         * @param {Array} r The result of scaling the source vector.
         * @returns {Array} The result of the vector scale operation (effectively a reference to the r parameter).
         * @example
         * var v = pc.math.vec4.create(2, 4, 8, 16);
         * var r = pc.math.vec4.create();
         * 
         * // Multiply by 2
         * pc.math.vec4.scale(v, 2, r);
         * 
         * // Negate
         * pc.math.vec4.scale(v, -1, r);
         * 
         * // Divide by 2
         * pc.math.vec4.scale(v, 0.5, r);
         * @author Will Eastcott
         */
        scale: function (v0, s, r) {
            r[0] = v0[0] * s;
            r[1] = v0[1] * s;
            r[2] = v0[2] * s;
            r[3] = v0[3] * s;
            return r;
        },

        /**
         * @function
         * @name pc.math.vec4.set
         * @description Sets the specified 4-dimensional vector to the supplied numerical values.
         * @param {Array} v0 The 4-dimensional vector to be set.
         * @param {number} x The value to set on the first dimension of the vector.
         * @param {number} y The value to set on the second dimension of the vector.
         * @param {number} z The value to set on the third dimension of the vector.
         * @param {number} w The value to set on the fourth dimension of the vector.
         * @example
         * var v = pc.math.vec4.create();
         * pc.math.vec4.set(v, 5, 10, 20, 40);
         *
         * // Should output 5, 10, 20, 40
         * console.log("The result of the vector set is: " + v[0] + ", " + v[1] + ", " + v[2] + ", " + v[3]);
         * @author Will Eastcott
         */
        set: function (v0, x, y, z, w) {
            v0[0] = x;
            v0[1] = y;
            v0[2] = z;
            v0[3] = w;
        },

        /**
         * @function
         * @name pc.math.vec4.subtract
         * @description Subtracts one 4-dimensional vector from another and returns the result.
         * @param {Array} v0 The minuend of the subtraction.
         * @param {Array} v1 The subtrahend of the subtraction.
         * @param {Array} r A vector to which the result of the subtraction is written.
         * @returns {Array} The result of the subtraction (effectively a reference to the r parameter).
         * @example
         * var v0 = pc.math.vec4.create(40, 20, 10, 5);
         * var v1 = pc.math.vec4.create(20, 10, 5, 2);
         * var r = pc.math.vec4.create();
         * pc.math.vec4.subtract(v0, v1, r);
         * // Should output 20, 10, 5, 3
         * console.log("The result of the subtraction is: " + r[0] + ", " + r[1] + ", " + r[2] + ", " + r[3]);
         * @author Will Eastcott
         */
        subtract: function (v0, v1, r) {
            r[0] = v0[0] - v1[0];
            r[1] = v0[1] - v1[1];
            r[2] = v0[2] - v1[2];
            r[3] = v0[3] - v1[3];
            return r;
        }
    };
} ();
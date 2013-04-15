pc.math.mat3 = function () {
    var scratchVecs = [];
    for (var i = 0; i < 3; i++) {
        scratchVecs.push(pc.math.vec3.create());
    }

    // Public functions
    return {
        create: function () {
            if (arguments.length === 9) {
                var a = arguments;
                return [a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8]];
            } else {
                return [1, 0, 0,
                        0, 1, 0,
                        0, 0, 1];
            }
        },

        createFromMat4: function (m4, r) {
            if (typeof r === 'undefined') {
                r = pc.math.Mat3.create();
            }
            r[0] = m4[0];
            r[1] = m4[1];
            r[2] = m4[2];
            r[3] = m4[4];
            r[4] = m4[5];
            r[5] = m4[6];
            r[6] = m4[8];
            r[7] = m4[9];
            r[8] = m4[10];
            return r;
        },

        getScale: function (m, r) {
            if (typeof r === 'undefined') {
               r = pc.math.vec3.create();
            }

            var x = scratchVecs[0];
            var y = scratchVecs[1];
            var z = scratchVecs[2];
            pc.math.vec3.set(x, m[0], m[1], m[2]);
            pc.math.vec3.set(y, m[3], m[4], m[5]);
            pc.math.vec3.set(z, m[6], m[7], m[8]);
            r[0] = pc.math.vec3.length(x);
            r[1] = pc.math.vec3.length(y);
            r[2] = pc.math.vec3.length(z);

            return r;
        },

        toEulerXYZ : function (m, r) {
            if (typeof r === 'undefined') {
                r = pc.math.vec3.create();
            }

            var scale = pc.math.mat3.getScale(m);
            
            var x; 
            var y = Math.asin(-m[2] / scale[0]);
            var z;
            var HALF_PI = Math.PI / 2;
            if (y < HALF_PI) {
                if (y > -HALF_PI) {
                    x = Math.atan2(m[5] / scale[1], m[8] / scale[2]);
                    z = Math.atan2(m[1] / scale[0], m[0] / scale[0]);
                } else {
                    // Not a unique solution
                    z = 0;
                    x = -Math.atan2(m[3] / scale[1], m[4] / scale[1]);
                }
            } else {
                // Not a unique solution
                z = 0;
                x = Math.atan2(m[3] / scale[1], m[4] / scale[1]);        
            }
            
            r[0] = x;
            r[1] = y;
            r[2] = z;

            return r;
        }
    };
} ();

/**
 * @namespace
 * @name pc.math.mat4
 */
pc.math.mat4 = function () {

    // Public functions
    return {

        /**
         * @function
         * @name pc.math.mat4.clone
         * @description Returns an identical copy of the specified 4x4 matrix.
         * @param {Array} m A 4x4 matrix that will to be cloned and returned.
         * @returns {Array} A 4x4 matrix containing the result of the cloning.
         * @example
         * var m = pc.math.mat4.makeTranslate(10, 20, 30);
         * var mclone = pc.math.mat4.clone(m);
         * @author Will Eastcott
         */
        clone: function (m) {
            return new Float32Array(m);
        },

        /**
         * @function
         * @name pc.math.mat4.copy
         * @description Copies the contents of a source 4x4 matrix to a destination 4x4 matrix.
         * @param {Array} src A 4x4 matrix to be copied.
         * @param {Array} dst A 4x4 matrix that will receive a copy of the source matrix.
         * @example
         * var src = pc.math.mat4.makeTranslate(10, 20, 30);
         * var dst = pc.math.mat4.create();
         * pc.math.mat4.copy(src, dst);
         * var equal = true;
         * for (var i = 0; i < 16; i++) {
         *     if (src[i] !== dst[i]) equal = false;
         * console.log("The two matrices are " + (equal ? "equal" : "different"));
         * @author Will Eastcott
         */
        copy: function (src, dst) {
            dst[0] = src[0];
            dst[1] = src[1];
            dst[2] = src[2];
            dst[3] = src[3];
            dst[4] = src[4];
            dst[5] = src[5];
            dst[6] = src[6];
            dst[7] = src[7];
            dst[8] = src[8];
            dst[9] = src[9];
            dst[10] = src[10];
            dst[11] = src[11];
            dst[12] = src[12];
            dst[13] = src[13];
            dst[14] = src[14];
            dst[15] = src[15];

            return dst;
        },

        /**
         * @function
         * @name pc.math.mat4.create
         * @description Creates a new 4x4 matrix set to the specified values. If no
         * parameters are passed to the function, the components of the matrix will
         * be set to undefined.
         * @param {number} m11 Value for row 1, column 1.
         * @param {number} m12 Value for row 1, column 2.
         * @param {number} m13 Value for row 1, column 3.
         * @param {number} m14 Value for row 1, column 4.
         * @param {number} m21 Value for row 2, column 1.
         * @param {number} m22 Value for row 2, column 2.
         * @param {number} m23 Value for row 2, column 3.
         * @param {number} m24 Value for row 2, column 4.
         * @param {number} m31 Value for row 3, column 1.
         * @param {number} m32 Value for row 3, column 2.
         * @param {number} m33 Value for row 3, column 3.
         * @param {number} m34 Value for row 3, column 4.
         * @param {number} m41 Value for row 4, column 1.
         * @param {number} m42 Value for row 4, column 2.
         * @param {number} m43 Value for row 4, column 3.
         * @param {number} m44 Value for row 4, column 4.
         * @returns {Array} A new 4x4 matrix.
         * @example
         * // Create a 4x4 matrix with all components set to undefined
         * var m1 = pc.math.mat4.create();
         * // Create a 4x4 matrix set valid values
         * var m2 = pc.math.mat4.create(1, 0, 0, 0,
         *                              0, 1, 0, 0,
         *                              0, 0, 1, 0,
         *                              10, 20, 30, 1);
         * @author Will Eastcott
         */
        create: function () {
            var m;
            if (arguments.length === 1 && arguments[0].length === 16) {
               m = new Float32Array(arguments[0]);
               return m;
            } else if (arguments.length === 16) {
               m = new Float32Array(arguments);
               return m;
            } else {
               m = new Float32Array(16);
               m[0] = 1;
               m[1] = 0;
               m[2] = 0;
               m[3] = 0;
               m[4] = 0;
               m[5] = 1;
               m[6] = 0;
               m[7] = 0;
               m[8] = 0;
               m[9] = 0;
               m[10] = 1;
               m[11] = 0;
               m[12] = 0;
               m[13] = 0;
               m[14] = 0;
               m[15] = 1;
               return m;               
            }
        },

        /**
         * @function
         * @name pc.math.mat4.multiply
         * @description Returns the result of multiplying the specified 4x4 matrices together.
         * @param {Array} m0 The 4x4 matrix used as the first multiplicand of the operation.
         * @param {Array} m1 The 4x4 matrix used as the second multiplicand of the operation.
         * @param {Array} r The result of the multiplication.
         * @returns {Array} The result of the multiplication (effectively a reference to the r parameter).
         * @example
         * var a = pc.math.mat4.makeTranslate(10, 20, 30);
         * var b = pc.math.mat4.makeRotate(180, [0, 1, 0]);
         *
         * // Generate result into an existing matrix
         * var r = pc.math.mat4.create();
         * pc.math.mat4.multiply(a, b, r);
         * 
         * // Generate result into a new matrix and return it
         * r = pc.math.mat4.multiply(a, b);
         * 
         * console.log("The result of the multiplication is: ");
         * console.log(r[0]+" "+r[1]+" "+r[2]+" "+r[3]+" ");
         * console.log(r[4]+" "+r[5]+" "+r[6]+" "+r[7]+" ");
         * console.log(r[8]+" "+r[9]+" "+r[10]+" "+r[11]+" ");
         * console.log(r[12]+" "+r[13]+" "+r[14]+" "+r[15]);
         * @author Will Eastcott
         */
        multiply: function (a, b, r) {
            if (typeof r === 'undefined') {
                r = pc.math.mat4.create();
            }

            var a00 = a[0];
            var a01 = a[1];
            var a02 = a[2];
            var a03 = a[3];
            var a10 = a[4];
            var a11 = a[5];
            var a12 = a[6];
            var a13 = a[7];
            var a20 = a[8];
            var a21 = a[9];
            var a22 = a[10];
            var a23 = a[11];
            var a30 = a[12];
            var a31 = a[13];
            var a32 = a[14];
            var a33 = a[15];

            var b0 = b[0];
            var b1 = b[1];
            var b2 = b[2];
            var b3 = b[3];
            r[0]  = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
            r[1]  = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
            r[2]  = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
            r[3]  = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;

            b0 = b[4];
            b1 = b[5];
            b2 = b[6];
            b3 = b[7];
            r[4]  = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
            r[5]  = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
            r[6]  = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
            r[7]  = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;

            b0 = b[8];
            b1 = b[9];
            b2 = b[10];
            b3 = b[11];
            r[8]  = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
            r[9]  = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
            r[10] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
            r[11] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;

            b0 = b[12];
            b1 = b[13];
            b2 = b[14];
            b3 = b[15];
            r[12] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
            r[13] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
            r[14] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
            r[15] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;

            return r;
        },

        /**
         * @function
         * @name pc.math.mat4.multiplyVec3
         * @description Multiplies a 3-dimensional vector by a 4x4 matrix. Se
         * @param {Array} v The 3-dimensional vector to be multiplied.
         * @param {Number} w The w-component of vector v.
         * @param {Array} m The matrix to which vector v is multiplied.
         * @param {Array} r An optional 3-dimensional vector to receive the result of the multiplication.
         * @returns {Array} The input vector v multiplied by input matrix m.
         * @example
         * // Create a 3-dimensional vector
         * var v = pc.math.vec3.create(1, 2, 3);
         * // Create a 4x4 translation matrix
         * var m = pc.math.mat4.makeTranslate(10, 20, 30);
         *
         * var mv = pc.math.mat4.multiplyVec3(v, 1.0, m);
         *
         * @author Will Eastcott
         */
        multiplyVec3: function (v, w, m, r) {
            if (typeof r === 'undefined') {
                r = pc.math.vec3.create();
            }

            var x, y, z;
            x =
                v[0] * m[0] +
                v[1] * m[4] +
                v[2] * m[8] +
                w * m[12];
            y = 
                v[0] * m[1] +
                v[1] * m[5] +
                v[2] * m[9] +
                w * m[13];
            z =
                v[0] * m[2] +
                v[1] * m[6] +
                v[2] * m[10] +
                w * m[14];
            r[0] = x;
            r[1] = y;
            r[2] = z;
            return r;
        },

        /**
         * @function
         * @name pc.math.mat4.makeLookAt
         * @description Creates a viewing matrix derived from an eye point, a reference point indicating the center
         * of the scene, and an up vector. The matrix maps the reference point to the negative z-axis and the eye
         * point to the origin, so that when you use a typical projection matrix, the center of the scene maps to 
         * the center of the viewport. Similarly, the direction described by the up vector projected onto the
         * viewing plane is mapped to the positive y-axis so that it points upward in the viewport. The up vector
         * must not be parallel to the line of sight from the eye to the reference point.
         * @param {Float32Array} position 3-d vector holding view position.
         * @param {Float32Array} target 3-d vector holding reference point.
         * @param {Float32Array} up 3-d vector holding the up direction.
         * @param {Float32Array} [r] 4x4 matrix to receive the calculated lookAt matrix.
         * @returns {Float32Array} The calculated lookAt matrix.
         * @example
         * var position = pc.math.vec3.create(10, 10, 10);
         * var target = pc.math.vec3.create(0, 0, 0);
         * var up = pc.math.vec3.create(0, 1, 0);
         * var lookAt = pc.math.mat4.makeLookAt(position, target, up);
         * @author Will Eastcott
         */
        makeLookAt: function () {
            var x = pc.math.vec3.create();
            var y = pc.math.vec3.create();
            var z = pc.math.vec3.create();

            return function (position, target, up, r) {
                if (typeof r === 'undefined') {
                    r = pc.math.mat4.create();
                }

                pc.math.vec3.subtract(position, target, z);
                pc.math.vec3.normalize(z, z);
                pc.math.vec3.normalize(up, y);
                pc.math.vec3.cross(y, z, x);
                pc.math.vec3.normalize(x, x);
                pc.math.vec3.cross(z, x, y);

                r[0]  = x[0];
                r[1]  = x[1];
                r[2]  = x[2];
                r[3]  = 0.0;
                r[4]  = y[0];
                r[5]  = y[1];
                r[6]  = y[2];
                r[7]  = 0.0;
                r[8]  = z[0];
                r[9]  = z[1];
                r[10] = z[2];
                r[11] = 0.0;
                r[12] = position[0];
                r[13] = position[1];
                r[14] = position[2];
                r[15] = 1.0;

                return r;
            };
        }(),

        /**
         * @function
         * @name pc.math.mat4.makeFrustum
         * @description Generates a persective projection matrix. The function's parameters define
         * the shape of a frustum.
         * @param {Number} left The x-coordinate for the left edge of the camera's projection plane in eye space.
         * @param {Number} right The x-coordinate for the right edge of the camera's projection plane in eye space.
         * @param {Number} bottom The y-coordinate for the bottom edge of the camera's projection plane in eye space.
         * @param {Number} top The y-coordinate for the top edge of the camera's projection plane in eye space.
         * @param {Number} znear The near clip plane in eye coordinates.
         * @param {Number} zfar The far clip plane in eye coordinates.
         * @param {Array} r An optional 4x4 matrix to receive the generated perspective projection matrix.
         * @returns {Array} The generated perspective projection matrix.
         * @example
         * // Create a 4x4 persepctive projection matrix
         * var persp = pc.math.mat4.makeFrustum(-2.0, 2.0, -1.0, 1.0, 1.0, 1000.0);
         * @author Will Eastcott
         */
        makeFrustum: function (left, right, bottom, top, znear, zfar, r) {
            if (typeof r === 'undefined') {
                r = pc.math.mat4.create();
            }

            var temp1 = 2.0 * znear;
            var temp2 = right - left;
            var temp3 = top - bottom;
            var temp4 = zfar - znear;
            r[0] = temp1 / temp2;
            r[1] = 0;
            r[2] = 0;
            r[3] = 0;
            r[4] = 0;
            r[5] = temp1 / temp3;
            r[6] = 0;
            r[7] = 0;
            r[8] = (right+left) / temp2;
            r[9] = (top+bottom) / temp3;
            r[10] = (-zfar-znear) / temp4;
            r[11] = -1.0;
            r[12] = 0;
            r[13] = 0;
            r[14] = (-temp1 * zfar) / temp4;
            r[15] = 0;

            return r;
        },

        /**
         * @function
         * @name pc.math.mat4.makePerspective
         * @description Generates a persective projection matrix. The function's parameters define
         * the shape of a frustum.
         * @param {Number} fovy The field of view in the frustum in the Y-axis of eye space.
         * @param {Number} aspect The aspect ratio of the frustum's projection plane (width / height).
         * @param {Number} znear The near clip plane in eye coordinates.
         * @param {Number} zfar The far clip plane in eye coordinates.
         * @param {Array} r An optional 4x4 matrix to receive the generated perspective projection matrix.
         * @returns {Array} The generated perspective projection matrix.
         * @example
         * // Create a 4x4 persepctive projection matrix
         * var persp = pc.math.mat4.makePerspective(45.0, 16.0/9.0, 1.0, 1000.0);
         * @author Will Eastcott
         */
        makePerspective: function (fovy, aspect, znear, zfar, r) {
            if (typeof r === 'undefined') {
                r = pc.math.mat4.create();
            }

            var ymax = znear * Math.tan(fovy * Math.PI / 360.0);
            var xmax = ymax * aspect;

            return pc.math.mat4.makeFrustum(-xmax, xmax, -ymax, ymax, znear, zfar, r);
        },
        
        /**
         * @function
         * @name pc.math.mat4.makeOrtho
         * @description Generates a orthographic projection matrix. The function's parameters define
         * the shape of a cuboid-shaped frustum.
         * @param {Number} left The x-coordinate for the left edge of the camera's projection plane in eye space.
         * @param {Number} right The x-coordinate for the right edge of the camera's projection plane in eye space.
         * @param {Number} bottom The y-coordinate for the bottom edge of the camera's projection plane in eye space.
         * @param {Number} top The y-coordinate for the top edge of the camera's projection plane in eye space.
         * @param {Number} znear The near clip plane in eye coordinates.
         * @param {Number} zfar The far clip plane in eye coordinates.
         * @param {Array} r An optional 4x4 matrix to receive the generated orthographic projection matrix.
         * @returns {Array} The generated orthographic projection matrix.
         * @example
         * // Create a 4x4 orthographic projection matrix
         * var persp = pc.math.mat4.makeOrtho(-2.0, 2.0, -2.0, 2.0, 1.0, 1000.0);
         * @author Will Eastcott
         */
        makeOrtho: function (left, right, bottom, top, near, far, r) {
            if (typeof r === 'undefined') {
                r = pc.math.mat4.create();
            }

            r[0] = 2 / (right - left);
            r[1] = 0;
            r[2] = 0;
            r[3] = 0;
            r[4] = 0;
            r[5] = 2 / (top - bottom);
            r[6] = 0;
            r[7] = 0;
            r[8] = 0;
            r[9] = 0;
            r[10] = -2 / (far - near);
            r[11] = 0;
            r[12] = -(right + left) / (right - left);
            r[13] = -(top + bottom) / (top - bottom);
            r[14] = -(far + near) / (far - near);
            r[15] = 1;
            
            return r;
        },

        /**
         * @function
         * @name pc.math.mat4.makeRotate
         * @description Generates a rotation matrix.
         * @param {Number} angle The angle of rotation in degrees.
         * @param {Array} axis The normalized axis vector around which to rotate.
         * @param {Array} r An optional 4x4 matrix to receive the generated rotation matrix.
         * @returns {Array} The generated rotation matrix.
         * @example
         * var yaxis = pc.math.vec3.create(0, 1, 0);
         *
         * // Create a 4x4 rotation matrix of 180 degrees around the y-axis
         * var rotation = pc.math.mat4.makeRotate(180, yaxis);
         * @author Will Eastcott
         */
        makeRotate: function (angle, axis, r) {
            if (typeof r === 'undefined') {
                r = pc.math.mat4.create();
            }

            var x = axis[0], y = axis[1], z = axis[2];
            angle *= pc.math.DEG_TO_RAD;
            var c = Math.cos(angle);
            var s = Math.sin(angle);
            var t = 1-c;
            var tx = t * x;
            var ty = t * y;

            r[0] = tx*x+c;
            r[1] = tx*y+s*z;
            r[2] = tx*z-s*y;
            r[3] = 0;
            r[4] = tx*y-s*z;
            r[5] = ty*y+c;
            r[6] = ty*z+s*x;
            r[7] = 0;
            r[8] = tx*z+s*y;
            r[9] = ty*z-x*s;
            r[10] = t*z*z+c;
            r[11] = 0;
            r[12] = 0;
            r[13] = 0;
            r[14] = 0;
            r[15] = 1;

            return r;
        },

        /**
         * @function
         * @name pc.math.mat4.makeTranslate
         * @description Generates a translation matrix.
         * @param {Number} x The x-component of the translation.
         * @param {Number} y The y-component of the translation.
         * @param {Number} z The z-component of the translation.
         * @param {Array} r An optional 4x4 matrix to receive the generated translation matrix.
         * @returns {Array} The generated translation matrix.
         * @example
         * // Create a 4x4 translation matrix
         * var translation = pc.math.mat4.makeTranslate(10, 20, 30);
         * @author Will Eastcott
         */
        makeTranslate: function (x, y, z, r) {
            if (typeof r === 'undefined') {
                r = pc.math.mat4.create();
            }

            r[0] = 1;
            r[1] = 0;
            r[2] = 0;
            r[3] = 0;
            r[4] = 0;
            r[5] = 1;
            r[6] = 0;
            r[7] = 0;
            r[8] = 0;
            r[9] = 0;
            r[10] = 1;
            r[11] = 0;
            r[12] = x;
            r[13] = y;
            r[14] = z;
            r[15] = 1;

            return r;
        },

        /**
         * @function
         * @name pc.math.mat4.makeScale
         * @description Generates a scale matrix.
         * @param {Number} x The x-component of the scale.
         * @param {Number} y The y-component of the scale.
         * @param {Number} z The z-component of the scale.
         * @param {Array} r An optional 4x4 matrix to receive the generated scale matrix.
         * @returns {Array} The generated scale matrix.
         * @example
         * // Create a 4x4 scale matrix
         * var scale = pc.math.mat4.makeScale(10, 10, 10);
         * @author Will Eastcott
         */
        makeScale: function(sx, sy, sz, r) {
            if (typeof r === 'undefined') {
                r = pc.math.mat4.create();
            }

            r[0] = sx;
            r[1] = 0;
            r[2] = 0;
            r[3] = 0;
            r[4] = 0;
            r[5] = sy;
            r[6] = 0;
            r[7] = 0;
            r[8] = 0;
            r[9] = 0;
            r[10] = sz;
            r[11] = 0;
            r[12] = 0;
            r[13] = 0;
            r[14] = 0;
            r[15] = 1;

            return r;
        },

        /**
         * @function
         * @name pc.math.mat4.transpose
         * @description Generates the transpose of the specified 4x4 matrix.
         * @param {Array} m The source matrix to be transposed.
         * @param {Array} r An optional 4x4 matrix to receive the transpose of the source matrix.
         * @returns {Array} The transpose of the source matrix.
         * @example
         * var yaxis = pc.math.vec3.create(0, 1, 0);
         *
         * // Create a 4x4 rotation matrix of 180 degrees around the y-axis
         * var rot = pc.math.mat4.makeRotate(180, yaxis);
         *
         * // Transpose in place
         * pc.math.mat4.transpose(rot, rot);
         *
         * // Generate a new transpose matrix
         * var rotTranspose = pc.math.mat4.transpose(rot);
         * @author Will Eastcott
         */
        transpose: function (m, r) {
            if (typeof r === 'undefined') {
                r = pc.math.mat4.create();
            }
            
            if (m === r) {
                var tmp = 0.0;
                tmp = m[1]; m[1] = m[4]; m[4] = tmp;
                tmp = m[2]; m[2] = m[8]; m[8] = tmp;
                tmp = m[3]; m[3] = m[12]; m[12] = tmp;
                tmp = m[6]; m[6] = m[9]; m[9] = tmp;
                tmp = m[7]; m[7] = m[13]; m[13] = tmp;
                tmp = m[11]; m[11] = m[14]; m[14] = tmp;
            } else {
                r[0] = m[0]; r[1] = m[4]; r[2] = m[8]; r[3] = m[12];
                r[4] = m[1]; r[5] = m[5]; r[6] = m[9]; r[7] = m[13];
                r[8] = m[2]; r[9] = m[6]; r[10] = m[10]; r[11] = m[14];
                r[12] = m[3]; r[13] = m[7]; r[14] = m[11]; r[15] = m[15];
            }
            
            return r;
        },

        /**
         * @function
         * @name pc.math.mat4.invert
         * @description Generates the inverse of the specified 4x4 matrix.
         * @param {Array} m The source matrix to be inverted.
         * @param {Array} r An optional 4x4 matrix to receive the inverse of the source matrix.
         * @returns {Array} The inverse of the source matrix.
         * @example
         * var yaxis = pc.math.vec3.create(0, 1, 0);
         *
         * // Create a 4x4 rotation matrix of 180 degrees around the y-axis
         * var rot = pc.math.mat4.makeRotate(180, yaxis);
         *
         * // Invert in place
         * pc.math.mat4.invert(rot, rot);
         *
         * // Generate a new inverse matrix
         * var rotInverse = pc.math.mat4.invert(rot);
         * @author Will Eastcott
         */
        invert: function (m, r) {
            if (typeof r === 'undefined') {
                r = pc.math.mat4.create();
            }

            var a00 = m[0],  a01 = m[1],  a02 = m[2],  a03 = m[3];
            var a10 = m[4],  a11 = m[5],  a12 = m[6],  a13 = m[7];
            var a20 = m[8],  a21 = m[9],  a22 = m[10], a23 = m[11];
            var a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];

            var b00 = a00*a11 - a01*a10;
            var b01 = a00*a12 - a02*a10;
            var b02 = a00*a13 - a03*a10;
            var b03 = a01*a12 - a02*a11;
            var b04 = a01*a13 - a03*a11;
            var b05 = a02*a13 - a03*a12;
            var b06 = a20*a31 - a21*a30;
            var b07 = a20*a32 - a22*a30;
            var b08 = a20*a33 - a23*a30;
            var b09 = a21*a32 - a22*a31;
            var b10 = a21*a33 - a23*a31;
            var b11 = a22*a33 - a23*a32;

            var invDet = 1.0/(b00*b11 - b01*b10 + b02*b09 + b03*b08 - b04*b07 + b05*b06);

            r[0] = (a11*b11 - a12*b10 + a13*b09)*invDet;
            r[1] = (-a01*b11 + a02*b10 - a03*b09)*invDet;
            r[2] = (a31*b05 - a32*b04 + a33*b03)*invDet;
            r[3] = (-a21*b05 + a22*b04 - a23*b03)*invDet;
            r[4] = (-a10*b11 + a12*b08 - a13*b07)*invDet;
            r[5] = (a00*b11 - a02*b08 + a03*b07)*invDet;
            r[6] = (-a30*b05 + a32*b02 - a33*b01)*invDet;
            r[7] = (a20*b05 - a22*b02 + a23*b01)*invDet;
            r[8] = (a10*b10 - a11*b08 + a13*b06)*invDet;
            r[9] = (-a00*b10 + a01*b08 - a03*b06)*invDet;
            r[10] = (a30*b04 - a31*b02 + a33*b00)*invDet;
            r[11] = (-a20*b04 + a21*b02 - a23*b00)*invDet;
            r[12] = (-a10*b09 + a11*b07 - a12*b06)*invDet;
            r[13] = (a00*b09 - a01*b07 + a02*b06)*invDet;
            r[14] = (-a30*b03 + a31*b01 - a32*b00)*invDet;
            r[15] = (a20*b03 - a21*b01 + a22*b00)*invDet;

            return r;
        },
        
        /**
         * @function
         * @name pc.math.mat4.getTranslation
         * @description Extracts the translation vector from the specified 4x4 matrix.
         * @param {Array} m The source matrix to be queried.
         * @returns {Array} The translation vector of the specified 4x4 matrix.
         * @example
         * // Create a 4x4 translation matrix
         * var t = pc.math.mat4.makeTranslate(10, 20, 30);
         *
         * // Query the translation component
         * var translation = pc.math.mat4.getTranslation(t);
         * @author Will Eastcott
         */
        getTranslation: function (m, r) {
            if (typeof r === 'undefined') {
               r = pc.math.vec3.create();
            }

            r[0] = m[12];
            r[1] = m[13];
            r[2] = m[14];

            return r;
        },

        /**
         * @function
         * @name pc.math.mat4.getX
         * @description Extracts the x-axis from the specified 4x4 matrix.
         * @param {Array} m The source matrix to be queried.
         * @returns {Array} The x-axis of the specified 4x4 matrix.
         * @example
         * var yaxis = pc.math.vec3.create(0, 1, 0);
         *
         * // Create a 4x4 rotation matrix of 180 degrees around the y-axis
         * var rot = pc.math.mat4.makeRotate(180, yaxis);
         *
         * // Query the x-axis component
         * var x = pc.math.mat4.getX(rot);
         * @author Will Eastcott
         */
        getX: function (m, r) {
            if (typeof r === 'undefined') {
               r = pc.math.vec3.create();
            }

            r[0] = m[0];
            r[1] = m[1];
            r[2] = m[2];

            return r;
        },

        /**
         * @function
         * @name pc.math.mat4.getY
         * @description Extracts the y-axis from the specified 4x4 matrix.
         * @param {Array} m The source matrix to be queried.
         * @returns {Array} The y-axis of the specified 4x4 matrix.
         * @example
         * var yaxis = pc.math.vec3.create(0, 1, 0);
         *
         * // Create a 4x4 rotation matrix of 180 degrees around the y-axis
         * var rot = pc.math.mat4.makeRotate(180, yaxis);
         *
         * // Query the y-axis component
         * var y = pc.math.mat4.getY(rot);
         * @author Will Eastcott
         */
        getY: function (m, r) {
            if (typeof r === 'undefined') {
               r = pc.math.vec3.create();
            }

            r[0] = m[4];
            r[1] = m[5];
            r[2] = m[6];

            return r;
        },

        /**
         * @function
         * @name pc.math.mat4.getZ
         * @description Extracts the z-axis from the specified 4x4 matrix.
         * @param {Array} m The source matrix to be queried.
         * @returns {Array} The z-axis of the specified 4x4 matrix.
         * @example
         * var yaxis = pc.math.vec3.create(0, 1, 0);
         *
         * // Create a 4x4 rotation matrix of 180 degrees around the y-axis
         * var rot = pc.math.mat4.makeRotate(180, yaxis);
         *
         * // Query the z-axis component
         * var z = pc.math.mat4.getZ(rot);
         * @author Will Eastcott
         */
        getZ: function (m, r) {
            if (typeof r === 'undefined') {
                r = pc.math.vec3.create();
            }

            r[0] = m[8];
            r[1] = m[9];
            r[2] = m[10];

            return r;
        },
        
        /**
         * @function
         * @name pc.math.mat4.getScale
         * @description Extracts the scale component from the specified 4x4 matrix.
         * @param {Float32Array} m The source matrix to be queried.
         * @returns {Float32Array} The scale in X, Y and Z of the specified 4x4 matrix.
         * @example
         * // Create a 4x4 scale matrix
         * var scaleMat = pc.math.mat4.makeScale(2, 3, 4);
         *
         * // Query the scale component
         * var scale = pc.math.mat4.getScale(scaleMat);
         * @author Will Eastcott
         */
        getScale: function () {
            var x = pc.math.vec3.create();
            var y = pc.math.vec3.create();
            var z = pc.math.vec3.create();

            return function (m, r) {
                if (typeof r === 'undefined') {
                    r = pc.math.vec3.create();
                }

                pc.math.mat4.getX(m, x);
                pc.math.mat4.getY(m, y);
                pc.math.mat4.getZ(m, z);
                r[0] = pc.math.vec3.length(x);
                r[1] = pc.math.vec3.length(y);
                r[2] = pc.math.vec3.length(z);

                return r;
            };
        }(),

        /**
         * @function
         * @name pc.math.mat4.fromEulerXYZ
         * @description Sets a 4x4 matrix from Euler angles specified in XYZ order.
         * @param {Number} ex Angle to rotate around X axis in degrees.
         * @param {Number} ey Angle to rotate around Y axis in degrees.
         * @param {Number} ez Angle to rotate around Z axis in degrees.
         * @param {Float32Array} [r] The matrix to set.
         * @returns The 4x4 matrix representation of the supplied Euler angles.
         * @example
         * // Create a 4x4 scale matrix
         * var rotationMatrix = pc.math.mat4.fromEulerXYZ(45, 90, 180);
         * @author Will Eastcott
         */
        // http://en.wikipedia.org/wiki/Rotation_matrix#Conversion_from_and_to_axis-angle
        // The 3D space is right-handed, so the rotation around each axis will be counterclockwise 
        // for an observer placed so that the axis goes in his or her direction (Right-hand rule).
        fromEulerXYZ: function (x, y, z, r) {
            if (typeof r === 'undefined') {
                r = pc.math.mat4.create();
            }

            // Convert degrees to radians for trig functions
            x *= pc.math.DEG_TO_RAD;
            y *= pc.math.DEG_TO_RAD;
            z *= pc.math.DEG_TO_RAD;

            // Solution taken from http://en.wikipedia.org/wiki/Euler_angles#Matrix_orientation
            var s1 = Math.sin(-x);
            var c1 = Math.cos(-x);
            var s2 = Math.sin(-y);
            var c2 = Math.cos(-y);
            var s3 = Math.sin(-z);
            var c3 = Math.cos(-z);

            // Set rotation elements
            r[0] = c2*c3;
            r[1] = -c2*s3;
            r[2] = s2;

            r[4] = c1*s3 + c3*s1*s2;
            r[5] = c1*c3 - s1*s2*s3;
            r[6] = -c2*s1;

            r[8] = s1*s3 - c1*c3*s2;
            r[9] = c3*s1 + c1*s2*s3;
            r[10] = c1*c2;

            return r;
        },

        /**
         * @function
         * @name pc.math.mat4.toEulerXYZ
         * @description Converts a 4x4 matrix to Euler angles specified in degrees in XYZ order.
         * @param {Float32Array} m The matrix to convert.
         * @param {Float32Array} [r] A 3-d vector to receive the Euler angles.
         * @returns A 3-d vector containing the Euler angles.
         * @example
         * var yaxis = pc.math.vec3.create(0, 1, 0);
         *
         * // Create a 4x4 rotation matrix of 45 degrees around the y-axis
         * var m = pc.math.mat4.makeRotate(45, yaxis);
         *
         * var eulers = pc.math.mat4.toEulerXYZ(m);
         * @author Will Eastcott
         */
        toEulerXYZ: function (m, r) {
            if (typeof r === 'undefined') {
                r = pc.math.vec3.create();
            }

            var scale = pc.math.mat4.getScale(m);
            
            var x; 
            var y = Math.asin(-m[2] / scale[0]);
            var z;
            var HALF_PI = Math.PI / 2;
            if (y < HALF_PI) {
                if (y > -HALF_PI) {
                    x = Math.atan2(m[6] / scale[1], m[10] / scale[2]);
                    z = Math.atan2(m[1] / scale[0], m[0] / scale[0]);
                } else {
                    // Not a unique solution
                    z = 0;
                    x = -Math.atan2(m[4] / scale[1], m[5] / scale[1]);
                }
            } else {
                // Not a unique solution
                z = 0;
                x = Math.atan2(m[4] / scale[1], m[5] / scale[1]);        
            }
            
            r[0] = x * pc.math.RAD_TO_DEG;
            r[1] = y * pc.math.RAD_TO_DEG;
            r[2] = z * pc.math.RAD_TO_DEG;

            return r;
        },

        /**
         * @function
         * @name pc.math.mat4.compose
         * @description Composes a 4x4 matrix from a translation, a quaternion rotation and
         * a scale.
         * @param {Float32Array} t A 3-d vector translation.
         * @param {Float32Array} q A quaternion rotation.
         * @param {Float32Array} s A 3-d vector scale.
         * @param {Float32Array} [r] A 4x4 matrix to receive the result of the composition.
         * @returns A newly composed 4x4 matrix.
         * @example
         * var yaxis = pc.math.vec3.create(0, 1, 0);
         *
         * // Create a 4x4 rotation matrix of 45 degrees around the y-axis
         * var m = pc.math.mat4.makeRotate(45, yaxis);
         *
         * var eulers = pc.math.mat4.toEulerXYZ(m);
         * @author Will Eastcott
         */
        compose: function (t, q, s, r) {
            if (typeof r === 'undefined') {
                r = pc.math.mat4.create();
            }

            var qx = q[0];
            var qy = q[1];
            var qz = q[2];
            var qw = q[3];

            var x2 = qx + qx;
            var y2 = qy + qy;
            var z2 = qz + qz;
            var xx = qx * x2;
            var xy = qx * y2;
            var xz = qx * z2;
            var yy = qy * y2;
            var yz = qy * z2;
            var zz = qz * z2;
            var wx = qw * x2;
            var wy = qw * y2;
            var wz = qw * z2;

            r[0] = (1.0 - (yy + zz)) * s[0];
            r[1] = (xy + wz) * s[0];
            r[2] = (xz - wy) * s[0];
            r[3] = 0.0;

            r[4] = (xy - wz) * s[1];
            r[5] = (1.0 - (xx + zz)) * s[1];
            r[6] = (yz + wx) * s[1];
            r[7] = 0.0;

            r[8] = (xz + wy) * s[2];
            r[9] = (yz - wx) * s[2];
            r[10] = (1.0 - (xx + yy)) * s[2];
            r[11] = 0.0;

            r[12] = t[0];
            r[13] = t[1];
            r[14] = t[2];
            r[15] = 1.0;

            return r;
        }
    };
} ();
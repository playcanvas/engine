pc.math.mat3 = function () {

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
            if (r === undefined) {
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
        }
    }
} ();

/**
 * @namespace
 * @name pc.math.mat4
 */
pc.math.mat4 = function () {

    var scratchVecs = [];
    for (var i = 0; i < 3; i++) {
        scratchVecs.push(pc.math.vec3.create());
    }

    var fromEulerScratchMats = [];
    for (var i = 0; i < 4; i++) {
        fromEulerScratchMats.push(new Float32Array(16));
    }

    var composeScratchMats = [];
    for (var i = 0; i < 4; i++) {
        composeScratchMats.push(new Float32Array(16));
    }

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
         * var b = pc.math.mat4.makeRotate(Math.PI, [0, 1, 0]);
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
            if (r === undefined) {
                r = pc.math.mat4.create();
            }

            var a11 = a[0];
            var a21 = a[1];
            var a31 = a[2];
            var a41 = a[3];
            var a12 = a[4];
            var a22 = a[5];
            var a32 = a[6];
            var a42 = a[7];
            var a13 = a[8];
            var a23 = a[9];
            var a33 = a[10];
            var a43 = a[11];
            var a14 = a[12];
            var a24 = a[13];
            var a34 = a[14];
            var a44 = a[15];

            var b11 = b[0];
            var b21 = b[1];
            var b31 = b[2];
            var b41 = b[3];
            var b12 = b[4];
            var b22 = b[5];
            var b32 = b[6];
            var b42 = b[7];
            var b13 = b[8];
            var b23 = b[9];
            var b33 = b[10];
            var b43 = b[11];
            var b14 = b[12];
            var b24 = b[13];
            var b34 = b[14];
            var b44 = b[15];

            r[0]  = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
            r[1]  = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
            r[2]  = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
            r[3]  = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
            r[4]  = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
            r[5]  = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
            r[6]  = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
            r[7]  = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
            r[8]  = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
            r[9]  = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
            r[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
            r[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
            r[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
            r[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
            r[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
            r[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;

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
            if (r === undefined) {
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

        makeLookAt: function (position, target, up, r) {
            if (r === undefined) {
                r = pc.math.mat4.create();
            }

            var x = scratchVecs[0];
            var y = scratchVecs[1];
            var z = scratchVecs[2];

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
        },

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
            if (r === undefined) {
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
            if (r === undefined) {
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
            if (r === undefined) {
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
         * @param {Number} angle The angle of rotation in radians.
         * @param {Array} axis The normalized axis vector around which to rotate.
         * @param {Array} r An optional 4x4 matrix to receive the generated rotation matrix.
         * @returns {Array} The generated rotation matrix.
         * @example
         * var yaxis = pc.math.vec3.create(0, 1, 0);
         *
         * // Create a 4x4 rotation matrix of 180 degrees around the y-axis
         * var rotation = pc.math.mat4.makeRotate(Math.PI, yaxis);
         * @author Will Eastcott
         */
        makeRotate: function (angle, axis, r) {
            if (r === undefined) {
                r = pc.math.mat4.create();
            }

            var x = axis[0], y = axis[1], z = axis[2];
            var c = Math.cos(angle);
            var c1 = 1-c;
            var s = Math.sin(angle);

            r[0] = x*x*c1+c;
            r[1] = y*x*c1+z*s;
            r[2] = z*x*c1-y*s;
            r[3] = 0;
            r[4] = x*y*c1-z*s;
            r[5] = y*y*c1+c;
            r[6] = y*z*c1+x*s;
            r[7] = 0;
            r[8] = x*z*c1+y*s;
            r[9] = y*z*c1-x*s;
            r[10] = z*z*c1+c;
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
            if (r === undefined) {
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
            if (r === undefined) {
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
         * var rot = pc.math.mat4.makeRotate(Math.PI, yaxis);
         *
         * // Transpose in place
         * pc.math.mat4.transpose(rot, rot);
         *
         * // Generate a new transpose matrix
         * var rotTranspose = pc.math.mat4.transpose(rot);
         * @author Will Eastcott
         */
        transpose: function (m, r) {
            if (r === undefined) {
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
         * var rot = pc.math.mat4.makeRotate(Math.PI, yaxis);
         *
         * // Invert in place
         * pc.math.mat4.invert(rot, rot);
         *
         * // Generate a new inverse matrix
         * var rotInverse = pc.math.mat4.invert(rot);
         * @author Will Eastcott
         */
        invert: function (m, r) {
            if (r === undefined) {
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
            if (r === undefined) {
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
         * var rot = pc.math.mat4.makeRotate(Math.PI, yaxis);
         *
         * // Query the x-axis component
         * var x = pc.math.mat4.getX(rot);
         * @author Will Eastcott
         */
        getX: function (m, r) {
            if (r === undefined) {
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
         * var rot = pc.math.mat4.makeRotate(Math.PI, yaxis);
         *
         * // Query the y-axis component
         * var y = pc.math.mat4.getY(rot);
         * @author Will Eastcott
         */
        getY: function (m, r) {
            if (r === undefined) {
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
         * var zaxis = pc.math.vec3.create(0, 1, 0);
         *
         * // Create a 4x4 rotation matrix of 180 degrees around the y-axis
         * var rot = pc.math.mat4.makeRotate(Math.PI, zaxis);
         *
         * // Query the z-axis component
         * var z = pc.math.mat4.getZ(rot);
         * @author Will Eastcott
         */
        getZ: function (m, r) {
            if (r === undefined) {
               r = pc.math.vec3.create();
            }

            r[0] = m[8];
            r[1] = m[9];
            r[2] = m[10];

            return pc.math.vec3.create(m[8], m[9], m[10]);
        },
        
        getScale: function (m, r) {
            if (r === undefined) {
               r = pc.math.vec3.create();
            }

            var x = scratchVecs[0];
            var y = scratchVecs[1];
            var z = scratchVecs[2];
            pc.math.vec3.set(x, m[0], m[1], m[2]);
            pc.math.vec3.set(y, m[4], m[5], m[6]);
            pc.math.vec3.set(z, m[8], m[9], m[10]);
            r[0] = pc.math.vec3.length(x);
            r[1] = pc.math.vec3.length(y);
            r[2] = pc.math.vec3.length(z);

            return r;
        },
        
        // http://en.wikipedia.org/wiki/Rotation_matrix#Conversion_from_and_to_axis-angle
        // The 3D space is right-handed, so the rotation around each axis will be counterclockwise 
        // for an observer placed so that the axis goes in his or her direction (Right-hand rule).
        fromEulerXYZ: function (x, y, z, r) {
            if (r === undefined) {
                r = pc.math.mat4.create();
            }

            var xm = fromEulerScratchMats[0];
            var ym = fromEulerScratchMats[1];
            var zm = fromEulerScratchMats[2];

            pc.math.mat4.makeRotate(x, pc.math.vec3.xaxis, xm);
            pc.math.mat4.makeRotate(y, pc.math.vec3.yaxis, ym);
            pc.math.mat4.makeRotate(z, pc.math.vec3.zaxis, zm);

            pc.math.mat4.multiply(ym, xm, r);
            pc.math.mat4.multiply(zm, r, r);

            return r;
        },

        toEulerXYZ : function (m, r) {
            if (r === undefined) {
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
            
            r[0] = x;
            r[1] = y;
            r[2] = z;
            
            return r;
        },
    
        /**
         * @function
         * @name pc.math.mat4.toQuat
         * @description Converts the specified 4x4 matrix to a quaternion. Note that since
         * a quaternion is purely a representation for orientation, only the translational part
         * of the matrix is lost.
         * @param {Array} m The 4x4 matrix to convert.
         * @param {Array} r An optional quaternion that will receive the result of the conversion. If
         * this parameter is omitted, the function will create a new quaternion internally and return it.
         * @returns {Array} A quaternion corresponding to the specified 4x4 matrix. If the r parameter is
         * specified, the return value will be equal to r. Otherwise, it will be a newly created quaternion.
         * @example
         * var yaxis = pc.math.vec3.create(0, 1, 0);
         *
         * // Create a 4x4 rotation matrix of 180 degrees around the y-axis
         * var rot = pc.math.mat4.makeRotate(Math.PI, yaxis);
         *
         * // Allow toQuat to create a new quaternion internally
         * var q1 = pc.math.mat4.toQuat(rot);
         *
         * // Supply a quaternion to receive the result of the conversion
         * var q2 = pc.math.quat.create();
         * pc.math.mat4.toQuat(m, q2);
         * @author Will Eastcott
         */
        toQuat: function (m, r) {
            if (r === undefined) {
                r = pc.math.quat.create();
            }

            var nxt = [ 1, 2, 0 ];
            var tr = m[0] + m[5] + m[10];

            if (tr > 0.0)
            {
                var s = Math.sqrt(tr + m[15]);
                r[3] = s * 0.5;
                s = 0.5 / s;

                r[0] = (m[6] - m[9]) * s;
                r[1] = (m[8] - m[2]) * s;
                r[2] = (m[1] - m[4]) * s;
            }
            else
            {
                var rs;
                if (m[0] > m[5])
                {
                    if (m[0] > m[10])
                    {
                        // XDiagDomMatrix
                        rs = (m[0] - (m[5] + m[10])) + 1.0;
                        rs = Math.sqrt(rs);

                        r[0] = rs * 0.5;
                        rs = 0.5 / rs;
                        r[3] = (m[6] - m[9]) * rs;
                        r[1] = (m[1] + m[4]) * rs;
                        r[2] = (m[2] + m[8]) * rs;
                    }
                    else
                    {
                        // ZDiagDomMatrix
                        rs = (m[10] - (m[0] + m[5])) + 1.0;
                        rs = Math.sqrt(rs);

                        r[2] = rs * 0.5;
                        rs = 0.5 / rs;
                        r[3] = (m[1] - m[4]) * rs;
                        r[0] = (m[8] + m[2]) * rs;
                        r[1] = (m[9] + m[6]) * rs;
                    }
                }
                else if (m[5] > m[10])
                {
                    // YDiagDomMatrix
                    rs = (m[5] - (m[10] + m[0])) + 1.0;
                    rs = Math.sqrt(rs);

                    r[1] = rs * 0.5;
                    rs = 0.5 / rs;
                    r[3] = (m[8] - m[2]) * rs;
                    r[2] = (m[6] + m[9]) * rs;
                    r[0] = (m[4] + m[1]) * rs;
                }
                else
                {
                    // ZDiagDomMatrix
                    rs = (m[10] - (m[0] + m[5])) + 1.0;
                    rs = Math.sqrt(rs);

                    r[2] = rs * 0.5;
                    rs = 0.5 / rs;
                    r[3] = (m[1] - m[4]) * rs;
                    r[0] = (m[8] + m[2]) * rs;
                    r[1] = (m[9] + m[6]) * rs;
                }            
            }

            return r;
        },

        compose: function (t, r, s, result) {
            var mat = pc.math.mat4;
            if (result === undefined) {
                result = mat.create();
            }

            var translate = composeScratchMats[0];
            var rotate = composeScratchMats[1];
            var scale = composeScratchMats[2];
            var temp = composeScratchMats[3];

            mat.makeTranslate(t[0], t[1], t[2], translate);
            mat.fromEulerXYZ(r[0], r[1], r[2], rotate);
            mat.makeScale(s[0], s[1], s[2], scale);

            // multiplied in order: translate * rotate * scale 
            mat.multiply(rotate, scale, temp);
            mat.multiply(translate, temp, result);

            return result;
        }
    }
} ();
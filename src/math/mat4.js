pc.extend(pc, (function () {
    'use strict';

    var typeNumber = 'number';

    /**
    * @name pc.Mat4
    * @class A 4x4 matrix.
    * @description Creates a new Mat4 object
    * @param {Number} [v0] The value in row 0, column 0. If v0 is an array of length 16, the array will be used to populate all components.
    * @param {Number} [v1] The value in row 1, column 0.
    * @param {Number} [v2] The value in row 2, column 0.
    * @param {Number} [v3] The value in row 3, column 0.
    * @param {Number} [v4] The value in row 0, column 1.
    * @param {Number} [v5] The value in row 1, column 1.
    * @param {Number} [v6] The value in row 2, column 1.
    * @param {Number} [v7] The value in row 3, column 1.
    * @param {Number} [v8] The value in row 0, column 2.
    * @param {Number} [v9] The value in row 1, column 2.
    * @param {Number} [v10] The value in row 2, column 2.
    * @param {Number} [v11] The value in row 3, column 2.
    * @param {Number} [v12] The value in row 0, column 3.
    * @param {Number} [v13] The value in row 1, column 3.
    * @param {Number} [v14] The value in row 2, column 3.
    * @param {Number} [v15] The value in row 3, column 3.
    */
    var Mat4 = function (v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15) {
        if (v0 && v0.length === 16) {
            this.data = new Float32Array(v0);
            return;
        }

        this.data = new Float32Array(16);

        if (typeof(v0) === typeNumber) {
            this.data[0] = v0;
            this.data[1] = v1;
            this.data[2] = v2;
            this.data[3] = v3;
            this.data[4] = v4;
            this.data[5] = v5;
            this.data[6] = v6;
            this.data[7] = v7;
            this.data[8] = v8;
            this.data[9] = v9;
            this.data[10] = v10;
            this.data[11] = v11;
            this.data[12] = v12;
            this.data[13] = v13;
            this.data[14] = v14;
            this.data[15] = v15;
        } else {
            this.setIdentity();
        }
    };

    Mat4.prototype = {
        /**
         * @function
         * @name pc.Mat4#add2
         * @description Adds the specified 4x4 matrices together and stores the result in
         * the current instance.
         * @param {pc.Mat4} lhs The 4x4 matrix used as the first operand of the addition.
         * @param {pc.Mat4} rhs The 4x4 matrix used as the second operand of the addition.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * var m = new pc.Mat4();
         *
         * m.add2(pc.Mat4.INDENTITY, pc.Mat4.ONE);
         *
         * console.log("The result of the addition is: " a.toString());
         */
        add2: function (lhs, rhs) {
            var a = lhs.data,
                b = rhs.data,
                r = this.data;

            r[0] = a[0] + b[0];
            r[1] = a[1] + b[1];
            r[2] = a[2] + b[2];
            r[3] = a[3] + b[3];
            r[4] = a[4] + b[4];
            r[5] = a[5] + b[5];
            r[6] = a[6] + b[6];
            r[7] = a[7] + b[7];
            r[8] = a[8] + b[8];
            r[9] = a[9] + b[9];
            r[10] = a[10] + b[10];
            r[11] = a[11] + b[11];
            r[12] = a[12] + b[12];
            r[13] = a[13] + b[13];
            r[14] = a[14] + b[14];
            r[15] = a[15] + b[15];

            return this;
        },

        /**
         * @function
         * @name pc.Mat4#add
         * @description Adds the specified 4x4 matrix to the current instance.
         * @param {pc.Mat4} rhs The 4x4 matrix used as the second operand of the addition.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * var m = new pc.Mat4();
         *
         * m.add(pc.Mat4.ONE);
         *
         * console.log("The result of the addition is: " a.toString());
         */
        add: function (rhs) {
            return this.add2(this, rhs);
        },

        /**
         * @function
         * @name pc.Mat4#clone
         * @description Creates a duplicate of the specified matrix.
         * @returns {pc.Mat4} A duplicate matrix.
         * @example
         * var src = new pc.Mat4().setFromEulerAngles(10, 20, 30);
         * var dst = new pc.Mat4();
         * dst.copy(src);
         * console.log("The two matrices are " + (src.equal(dst) ? "equal" : "different"));
         */
        clone: function () {
            return new pc.Mat4().copy(this);
        },

        /**
         * @function
         * @name pc.Mat4#copy
         * @description Copies the contents of a source 4x4 matrix to a destination 4x4 matrix.
         * @param {pc.Mat4} rhs A 4x4 matrix to be copied.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * var src = new pc.Mat4().setFromEulerAngles(10, 20, 30);
         * var dst = new pc.Mat4();
         * dst.copy(src);
         * console.log("The two matrices are " + (src.equal(dst) ? "equal" : "different"));
         */
        copy: function (rhs) {
            var src = rhs.data,
                dst = this.data;

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

            return this;
        },

        /**
         * @function
         * @name pc.Mat4#equals
         * @description Reports whether two matrices are equal.
         * @param {pc.Mat4} rhs The other matrix.
         * @returns {Boolean} true if the matrices are equal and false otherwise.
         * @example
         * var a = new pc.Mat4().setFromEulerAngles(10, 20, 30);
         * var b = new pc.Mat4();
         * console.log("The two matrices are " + (a.equals(b) ? "equal" : "different"));
         */
        equals: function (rhs) {
            var l = this.data,
                r = rhs.data;

            return ((l[0] === r[0]) &&
                    (l[1] === r[1]) &&
                    (l[2] === r[2]) &&
                    (l[3] === r[3]) &&
                    (l[4] === r[4]) &&
                    (l[5] === r[5]) &&
                    (l[6] === r[6]) &&
                    (l[7] === r[7]) &&
                    (l[8] === r[8]) &&
                    (l[9] === r[9]) &&
                    (l[10] === r[10]) &&
                    (l[11] === r[11]) &&
                    (l[12] === r[12]) &&
                    (l[13] === r[13]) &&
                    (l[14] === r[14]) &&
                    (l[15] === r[15]));
        },

        /**
         * @function
         * @name pc.Mat4#isIdentity
         * @description Reports whether the specified matrix is the identity matrix.
         * @returns {Boolean} true if the matrix is identity and false otherwise.
         * @example
         * var m = new pc.Mat4();
         * console.log("The matrix is " + (m.isIdentity() ? "identity" : "not identity"));
         */
        isIdentity: function () {
            var m = this.data;

            return ((m[0] === 1) &&
                    (m[1] === 0) &&
                    (m[2] === 0) &&
                    (m[3] === 0) &&
                    (m[4] === 0) &&
                    (m[5] === 1) &&
                    (m[6] === 0) &&
                    (m[7] === 0) &&
                    (m[8] === 0) &&
                    (m[9] === 0) &&
                    (m[10] === 1) &&
                    (m[11] === 0) &&
                    (m[12] === 0) &&
                    (m[13] === 0) &&
                    (m[14] === 0) &&
                    (m[15] === 1));
        },

        /**
         * @function
         * @name pc.Mat4#mul2
         * @description Multiplies the specified 4x4 matrices together and stores the result in
         * the current instance.
         * @param {pc.Mat4} lhs The 4x4 matrix used as the first multiplicand of the operation.
         * @param {pc.Mat4} rhs The 4x4 matrix used as the second multiplicand of the operation.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * var a = new pc.Mat4().setFromEulerAngles(10, 20, 30);
         * var b = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 180);
         * var r = new pc.Mat4();
         *
         * // r = a * b
         * r.mul2(a, b);
         *
         * console.log("The result of the multiplication is: " r.toString());
         */
        mul2: function (lhs, rhs) {
            var a00, a01, a02, a03,
                a10, a11, a12, a13,
                a20, a21, a22, a23,
                a30, a31, a32, a33,
                b0, b1, b2, b3,
                a = lhs.data,
                b = rhs.data,
                r = this.data;

            a00 = a[0];
            a01 = a[1];
            a02 = a[2];
            a03 = a[3];
            a10 = a[4];
            a11 = a[5];
            a12 = a[6];
            a13 = a[7];
            a20 = a[8];
            a21 = a[9];
            a22 = a[10];
            a23 = a[11];
            a30 = a[12];
            a31 = a[13];
            a32 = a[14];
            a33 = a[15];

            b0 = b[0];
            b1 = b[1];
            b2 = b[2];
            b3 = b[3];
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

            return this;
        },

        /**
         * @function
         * @name pc.Mat4#mul
         * @description Multiplies the current instance by the specified 4x4 matrix.
         * @param {pc.Mat4} rhs The 4x4 matrix used as the second multiplicand of the operation.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * var a = new pc.Mat4().setFromEulerAngles(10, 20, 30);
         * var b = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 180);
         *
         * // a = a * b
         * a.mul(b);
         *
         * console.log("The result of the multiplication is: " a.toString());
         */
        mul: function (rhs) {
            return this.mul2(this, rhs);
        },

        /**
         * @function
         * @name pc.Mat4#transformPoint
         * @description Transforms a 3-dimensional point by a 4x4 matrix.
         * @param {pc.Vec3} vec The 3-dimensional point to be transformed.
         * @param {pc.Vec3} [res] An optional 3-dimensional point to receive the result of the transformation.
         * @returns {pc.Vec3} The input point v transformed by the current instance.
         * @example
         * // Create a 3-dimensional point
         * var v = new pc.Vec3(1, 2, 3);
         *
         * // Create a 4x4 rotation matrix
         * var m = new pc.Mat4().setFromEulerAngles(10, 20, 30);
         *
         * var tv = m.transformPoint(v);
         */
        transformPoint: function (vec, res) {
            var x, y, z,
                m = this.data,
                v = vec.data;

            res = (res === undefined) ? new pc.Vec3() : res;

            x =
                v[0] * m[0] +
                v[1] * m[4] +
                v[2] * m[8] +
                m[12];
            y =
                v[0] * m[1] +
                v[1] * m[5] +
                v[2] * m[9] +
                m[13];
            z =
                v[0] * m[2] +
                v[1] * m[6] +
                v[2] * m[10] +
                m[14];

            return res.set(x, y, z);
        },

        /**
         * @function
         * @name pc.Mat4#transformVector
         * @description Transforms a 3-dimensional vector by a 4x4 matrix.
         * @param {pc.Vec3} vec The 3-dimensional vector to be transformed.
         * @param {pc.Vec3} [res] An optional 3-dimensional vector to receive the result of the transformation.
         * @returns {pc.Vec3} The input vector v transformed by the current instance.
         * @example
         * // Create a 3-dimensional vector
         * var v = new pc.Vec3(1, 2, 3);
         *
         * // Create a 4x4 rotation matrix
         * var m = new pc.Mat4().setFromEulerAngles(10, 20, 30);
         *
         * var tv = m.transformVector(v);
         */
        transformVector: function (vec, res) {
            var x, y, z,
                m = this.data,
                v = vec.data;

            res = (res === undefined) ? new pc.Vec3() : res;

            x =
                v[0] * m[0] +
                v[1] * m[4] +
                v[2] * m[8];
            y =
                v[0] * m[1] +
                v[1] * m[5] +
                v[2] * m[9];
            z =
                v[0] * m[2] +
                v[1] * m[6] +
                v[2] * m[10];

            return res.set(x, y, z);
        },

         /**
         * @function
         * @name pc.Mat4#transformVec4
         * @description Transforms a 4-dimensional vector by a 4x4 matrix.
         * @param {pc.Vec4} vec The 4-dimensional vector to be transformed.
         * @param {pc.Vec4} [res] An optional 4-dimensional vector to receive the result of the transformation.
         * @returns {pc.Vec4} The input vector v transformed by the current instance.
         * @example
         * // Create an input 4-dimensional vector
         * var v = new pc.Vec4(1, 2, 3, 4);
         *
         * // Create an output 4-dimensional vector
         * var result = new pc.Vec4();
         *
         * // Create a 4x4 rotation matrix
         * var m = new pc.Mat4().setFromEulerAngles(10, 20, 30);
         *
         * m.transformVec4(v, result);
         */
        transformVec4: function (vec, res) {
            var x, y, z, w,
                m = this.data,
                v = vec.data;

            res = (res === undefined) ? new pc.Vec4() : res;

            x =
                v[0] * m[0] +
                v[1] * m[4] +
                v[2] * m[8] +
                v[3] * m[12];
            y =
                v[0] * m[1] +
                v[1] * m[5] +
                v[2] * m[9] +
                v[3] * m[13];
            z =
                v[0] * m[2] +
                v[1] * m[6] +
                v[2] * m[10] +
                v[3] * m[14];

            w =
                v[0] * m[3] +
                v[1] * m[7] +
                v[2] * m[11] +
                v[3] * m[15];

            return res.set(x, y, z, w);
        },

        /**
         * @function
         * @name pc.Mat4#setLookAt
         * @description Sets the specified matrix to a viewing matrix derived from an eye point, a target point
         * and an up vector. The matrix maps the target point to the negative z-axis and the eye point to the
         * origin, so that when you use a typical projection matrix, the center of the scene maps to the center
         * of the viewport. Similarly, the direction described by the up vector projected onto the viewing plane
         * is mapped to the positive y-axis so that it points upward in the viewport. The up vector must not be
         * parallel to the line of sight from the eye to the reference point.
         * @param {pc.Vec3} position 3-d vector holding view position.
         * @param {pc.Vec3} target 3-d vector holding reference point.
         * @param {pc.Vec3} up 3-d vector holding the up direction.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * var position = new pc.Vec3(10, 10, 10);
         * var target = new pc.Vec3(0, 0, 0);
         * var up = new pc.Vec3(0, 1, 0);
         * var m = new pc.Mat4().setLookAt(position, target, up);
         */
        setLookAt: (function () {
            var x, y, z;

            x = new pc.Vec3();
            y = new pc.Vec3();
            z = new pc.Vec3();

            return function (position, target, up) {
                z.sub2(position, target).normalize();
                y.copy(up).normalize();
                x.cross(y, z).normalize();
                y.cross(z, x);

                var r = this.data;

                r[0]  = x.x;
                r[1]  = x.y;
                r[2]  = x.z;
                r[3]  = 0;
                r[4]  = y.x;
                r[5]  = y.y;
                r[6]  = y.z;
                r[7]  = 0;
                r[8]  = z.x;
                r[9]  = z.y;
                r[10] = z.z;
                r[11] = 0;
                r[12] = position.x;
                r[13] = position.y;
                r[14] = position.z;
                r[15] = 1;

                return this;
            };
        }()),

        /**
         * @private
         * @function
         * @name pc.Mat4#setFrustum
         * @description Sets the specified matrix to a persective projection matrix. The function's parameters define
         * the shape of a frustum.
         * @param {Number} left The x-coordinate for the left edge of the camera's projection plane in eye space.
         * @param {Number} right The x-coordinate for the right edge of the camera's projection plane in eye space.
         * @param {Number} bottom The y-coordinate for the bottom edge of the camera's projection plane in eye space.
         * @param {Number} top The y-coordinate for the top edge of the camera's projection plane in eye space.
         * @param {Number} znear The near clip plane in eye coordinates.
         * @param {Number} zfar The far clip plane in eye coordinates.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * // Create a 4x4 persepctive projection matrix
         * var f = pc.Mat4().setFrustum(-2, 2, -1, 1, 1, 1000);
         */
        setFrustum: function (left, right, bottom, top, znear, zfar) {
            var temp1, temp2, temp3, temp4, r;

            temp1 = 2 * znear;
            temp2 = right - left;
            temp3 = top - bottom;
            temp4 = zfar - znear;

            r = this.data;
            r[0] = temp1 / temp2;
            r[1] = 0;
            r[2] = 0;
            r[3] = 0;
            r[4] = 0;
            r[5] = temp1 / temp3;
            r[6] = 0;
            r[7] = 0;
            r[8] = (right + left) / temp2;
            r[9] = (top + bottom) / temp3;
            r[10] = (-zfar - znear) / temp4;
            r[11] = -1;
            r[12] = 0;
            r[13] = 0;
            r[14] = (-temp1 * zfar) / temp4;
            r[15] = 0;

            return this;
        },

        /**
         * @function
         * @name pc.Mat4#setPerspective
         * @description Sets the specified matrix to a persective projection matrix. The function's
         * parameters define the shape of a frustum.
         * @param {Number} fovy The field of view in the frustum in the Y-axis of eye space (or X axis if fovIsHorizontal is true).
         * @param {Number} aspect The aspect ratio of the frustum's projection plane (width / height).
         * @param {Number} znear The near clip plane in eye coordinates.
         * @param {Number} zfar The far clip plane in eye coordinates.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * // Create a 4x4 persepctive projection matrix
         * var persp = pc.Mat4().setPerspective(45, 16 / 9, 1, 1000);
         */
        setPerspective: function (fovy, aspect, znear, zfar, fovIsHorizontal) {
            var xmax, ymax;

            if (!fovIsHorizontal) {
                ymax = znear * Math.tan(fovy * Math.PI / 360);
                xmax = ymax * aspect;
            } else {
                xmax = znear * Math.tan(fovy * Math.PI / 360);
                ymax = xmax / aspect;
            }

            return this.setFrustum(-xmax, xmax, -ymax, ymax, znear, zfar);
        },

        /**
         * @function
         * @name pc.Mat4#setOrtho
         * @description Sets the specified matrix to an orthographic projection matrix. The function's parameters
         * define the shape of a cuboid-shaped frustum.
         * @param {Number} left The x-coordinate for the left edge of the camera's projection plane in eye space.
         * @param {Number} right The x-coordinate for the right edge of the camera's projection plane in eye space.
         * @param {Number} bottom The y-coordinate for the bottom edge of the camera's projection plane in eye space.
         * @param {Number} top The y-coordinate for the top edge of the camera's projection plane in eye space.
         * @param {Number} znear The near clip plane in eye coordinates.
         * @param {Number} zfar The far clip plane in eye coordinates.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * // Create a 4x4 orthographic projection matrix
         * var ortho = pc.Mat4().ortho(-2, 2, -2, 2, 1, 1000);
         */
        setOrtho: function (left, right, bottom, top, near, far) {
            var r = this.data;

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

            return this;
        },

        /**
         * @function
         * @name pc.Mat4#setFromAxisAngle
         * @description Sets the specified matrix to a rotation matrix equivalent to a rotation around
         * an axis. The axis must be normalized (unit length) and the angle must be specified in degrees.
         * @param {pc.Vec3} axis The normalized axis vector around which to rotate.
         * @param {Number} angle The angle of rotation in degrees.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * // Create a 4x4 rotation matrix
         * var rm = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 90);
         */
        setFromAxisAngle: function (axis, angle) {
            var x, y, z, c, s, t, tx, ty, m;

            angle *= pc.math.DEG_TO_RAD;

            x = axis.x;
            y = axis.y;
            z = axis.z;
            c = Math.cos(angle);
            s = Math.sin(angle);
            t = 1 - c;
            tx = t * x;
            ty = t * y;
            m = this.data;

            m[0] = tx * x + c;
            m[1] = tx * y + s * z;
            m[2] = tx * z - s * y;
            m[3] = 0;
            m[4] = tx * y - s * z;
            m[5] = ty * y + c;
            m[6] = ty * z + s * x;
            m[7] = 0;
            m[8] = tx * z + s * y;
            m[9] = ty * z - x * s;
            m[10] = t * z * z + c;
            m[11] = 0;
            m[12] = 0;
            m[13] = 0;
            m[14] = 0;
            m[15] = 1;

            return this;
        },

        /**
         * @private
         * @function
         * @name pc.Mat4#setTranslate
         * @description Sets the specified matrix to a translation matrix.
         * @param {Number} x The x-component of the translation.
         * @param {Number} y The y-component of the translation.
         * @param {Number} z The z-component of the translation.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * // Create a 4x4 translation matrix
         * var tm = new pc.Mat4().setTranslate(10, 10, 10);
         */
        setTranslate: function (tx, ty, tz) {
            var m = this.data;

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
            m[12] = tx;
            m[13] = ty;
            m[14] = tz;
            m[15] = 1;

            return this;
        },

        /**
         * @private
         * @function
         * @name pc.Mat4#setScale
         * @description Sets the specified matrix to a scale matrix.
         * @param {Number} x The x-component of the scale.
         * @param {Number} y The y-component of the scale.
         * @param {Number} z The z-component of the scale.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * // Create a 4x4 scale matrix
         * var sm = new pc.Mat4().setScale(10, 10, 10);
         */
        setScale: function (sx, sy, sz) {
            var m = this.data;

            m[0] = sx;
            m[1] = 0;
            m[2] = 0;
            m[3] = 0;
            m[4] = 0;
            m[5] = sy;
            m[6] = 0;
            m[7] = 0;
            m[8] = 0;
            m[9] = 0;
            m[10] = sz;
            m[11] = 0;
            m[12] = 0;
            m[13] = 0;
            m[14] = 0;
            m[15] = 1;

            return this;
        },

        /**
         * @function
         * @name pc.Mat4#invert
         * @description Sets the specified matrix to its inverse.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * // Create a 4x4 rotation matrix of 180 degrees around the y-axis
         * var rot = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 180);
         *
         * // Invert in place
         * rot.invert();
         */
        invert: function () {
            var a00, a01, a02, a03,
                a10, a11, a12, a13,
                a20, a21, a22, a23,
                a30, a31, a32, a33,
                b00, b01, b02, b03,
                b04, b05, b06, b07,
                b08, b09, b10, b11,
                det, invDet, m;

            m = this.data;
            a00 = m[0];
            a01 = m[1];
            a02 = m[2];
            a03 = m[3];
            a10 = m[4];
            a11 = m[5];
            a12 = m[6];
            a13 = m[7];
            a20 = m[8];
            a21 = m[9];
            a22 = m[10];
            a23 = m[11];
            a30 = m[12];
            a31 = m[13];
            a32 = m[14];
            a33 = m[15];

            b00 = a00 * a11 - a01 * a10;
            b01 = a00 * a12 - a02 * a10;
            b02 = a00 * a13 - a03 * a10;
            b03 = a01 * a12 - a02 * a11;
            b04 = a01 * a13 - a03 * a11;
            b05 = a02 * a13 - a03 * a12;
            b06 = a20 * a31 - a21 * a30;
            b07 = a20 * a32 - a22 * a30;
            b08 = a20 * a33 - a23 * a30;
            b09 = a21 * a32 - a22 * a31;
            b10 = a21 * a33 - a23 * a31;
            b11 = a22 * a33 - a23 * a32;

            det = (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
            if (det === 0) {
                // #ifdef DEBUG
                console.warn("Can't invert matrix, determinant is 0");
                // #endif
                this.setIdentity();
            } else {
                invDet = 1 / det;

                m[0] = (a11 * b11 - a12 * b10 + a13 * b09) * invDet;
                m[1] = (-a01 * b11 + a02 * b10 - a03 * b09) * invDet;
                m[2] = (a31 * b05 - a32 * b04 + a33 * b03) * invDet;
                m[3] = (-a21 * b05 + a22 * b04 - a23 * b03) * invDet;
                m[4] = (-a10 * b11 + a12 * b08 - a13 * b07) * invDet;
                m[5] = (a00 * b11 - a02 * b08 + a03 * b07) * invDet;
                m[6] = (-a30 * b05 + a32 * b02 - a33 * b01) * invDet;
                m[7] = (a20 * b05 - a22 * b02 + a23 * b01) * invDet;
                m[8] = (a10 * b10 - a11 * b08 + a13 * b06) * invDet;
                m[9] = (-a00 * b10 + a01 * b08 - a03 * b06) * invDet;
                m[10] = (a30 * b04 - a31 * b02 + a33 * b00) * invDet;
                m[11] = (-a20 * b04 + a21 * b02 - a23 * b00) * invDet;
                m[12] = (-a10 * b09 + a11 * b07 - a12 * b06) * invDet;
                m[13] = (a00 * b09 - a01 * b07 + a02 * b06) * invDet;
                m[14] = (-a30 * b03 + a31 * b01 - a32 * b00) * invDet;
                m[15] = (a20 * b03 - a21 * b01 + a22 * b00) * invDet;
            }
            

            return this;
        },

        /**
         * @function
         * @name pc.Mat4#set
         * @description Sets matrix data from an array.
         * @param {Array} Source array. Must have 16 values.
         */
        set: function (src) {
            var dst = this.data;
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

            return this;
        },

        /**
         * @function
         * @name pc.Mat4#setIdentity
         * @description Sets the specified matrix to the identity matrix.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * m.setIdentity();
         * console.log("The two matrices are " + (src.equal(dst) ? "equal" : "different"));
         */
        setIdentity: function () {
            var m = this.data;
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

            return this;
        },

        /**
         * @function
         * @name pc.Mat4#setTRS
         * @description Sets the specified matrix to the concatenation of a translation, a
         * quaternion rotation and a scale.
         * @param {pc.Vec3} t A 3-d vector translation.
         * @param {pc.Quat} r A quaternion rotation.
         * @param {pc.Vec3} s A 3-d vector scale.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * var t = new pc.Vec3(10, 20, 30);
         * var r = new pc.Quat();
         * var s = new pc.Vec3(2, 2, 2);
         *
         * var m = new pc.Mat4();
         * m.compose(t, r, s);
         */
        setTRS: function (t, r, s) {
            var tx, ty, tz, qx, qy, qz, qw, sx, sy, sz,
                x2, y2, z2, xx, xy, xz, yy, yz, zz, wx, wy, wz, m;

            tx = t.x;
            ty = t.y;
            tz = t.z;

            qx = r.x;
            qy = r.y;
            qz = r.z;
            qw = r.w;

            sx = s.x;
            sy = s.y;
            sz = s.z;

            x2 = qx + qx;
            y2 = qy + qy;
            z2 = qz + qz;
            xx = qx * x2;
            xy = qx * y2;
            xz = qx * z2;
            yy = qy * y2;
            yz = qy * z2;
            zz = qz * z2;
            wx = qw * x2;
            wy = qw * y2;
            wz = qw * z2;

            m = this.data;

            m[0] = (1 - (yy + zz)) * sx;
            m[1] = (xy + wz) * sx;
            m[2] = (xz - wy) * sx;
            m[3] = 0;

            m[4] = (xy - wz) * sy;
            m[5] = (1 - (xx + zz)) * sy;
            m[6] = (yz + wx) * sy;
            m[7] = 0;

            m[8] = (xz + wy) * sz;
            m[9] = (yz - wx) * sz;
            m[10] = (1 - (xx + yy)) * sz;
            m[11] = 0;

            m[12] = tx;
            m[13] = ty;
            m[14] = tz;
            m[15] = 1;

            return this;
        },

        /**
         * @function
         * @name pc.Mat4#transpose
         * @description Sets the specified matrix to its transpose.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * var m = new pc.Mat4();
         *
         * // Transpose in place
         * m.transpose();
         */
        transpose: function () {
            var tmp, m = this.data;

            tmp = m[1];
            m[1] = m[4];
            m[4] = tmp;

            tmp = m[2];
            m[2] = m[8];
            m[8] = tmp;

            tmp = m[3];
            m[3] = m[12];
            m[12] = tmp;

            tmp = m[6];
            m[6] = m[9];
            m[9] = tmp;

            tmp = m[7];
            m[7] = m[13];
            m[13] = tmp;

            tmp = m[11];
            m[11] = m[14];
            m[14] = tmp;

            return this;
        },

        invertTo3x3: function (res) {
            var a11, a21, a31, a12, a22, a32, a13, a23, a33,
                m, r, det, idet;

            m = this.data;
            r = res.data;

            var m0 = m[0];
            var m1 = m[1];
            var m2 = m[2];
            var m3 = m[3];
            var m4 = m[4];
            var m5 = m[5];
            var m6 = m[6];
            var m7 = m[7];
            var m8 = m[8];
            var m9 = m[9];
            var m10 = m[10];

            a11 =  m10 * m5 - m6 * m9;
            a21 = -m10 * m1 + m2 * m9;
            a31 =  m6  * m1 - m2 * m5;
            a12 = -m10 * m4 + m6 * m8;
            a22 =  m10 * m0 - m2 * m8;
            a32 = -m6  * m0 + m2 * m4;
            a13 =  m9  * m4 - m5 * m8;
            a23 = -m9  * m0 + m1 * m8;
            a33 =  m5  * m0 - m1 * m4;

            det =  m0 * a11 + m1 * a12 + m2 * a13;
            if (det === 0) { // no inverse
                console.warn("pc.Mat4#invertTo3x3: Matrix not invertible");
                return this;
            }

            idet = 1 / det;

            r[0] = idet * a11;
            r[1] = idet * a21;
            r[2] = idet * a31;
            r[3] = idet * a12;
            r[4] = idet * a22;
            r[5] = idet * a32;
            r[6] = idet * a13;
            r[7] = idet * a23;
            r[8] = idet * a33;

            return this;
        },

        /**
         * @function
         * @name pc.Mat4#getTranslation
         * @description Extracts the transational component from the specified 4x4 matrix.
         * @param {pc.Vec3} [t] The vector to receive the translation of the matrix.
         * @returns {pc.Vec3} The translation of the specified 4x4 matrix.
         * @example
         * // Create a 4x4 matrix
         * var m = new pc.Mat4();
         *
         * // Query the z-axis component
         * var t = new pc.Vec3();
         * m.getTranslation(t);
         */
        getTranslation: function (t) {
            t = (t === undefined) ? new pc.Vec3() : t;

            return t.set(this.data[12], this.data[13], this.data[14]);
        },

        /**
         * @function
         * @name pc.Mat4#getX
         * @description Extracts the x-axis from the specified 4x4 matrix.
         * @param {pc.Vec3} [x] The vector to receive the x axis of the matrix.
         * @returns {pc.Vec3} The x-axis of the specified 4x4 matrix.
         * @example
         * // Create a 4x4 matrix
         * var m = new pc.Mat4();
         *
         * // Query the z-axis component
         * var x = new pc.Vec3();
         * m.getX(x);
         */
        getX: function (x) {
            x = (x === undefined) ? new pc.Vec3() : x;

            return x.set(this.data[0], this.data[1], this.data[2]);
        },

        /**
         * @function
         * @name pc.Mat4#getY
         * @description Extracts the y-axis from the specified 4x4 matrix.
         * @param {pc.Vec3} [y] The vector to receive the y axis of the matrix.
         * @returns {pc.Vec3} The y-axis of the specified 4x4 matrix.
         * @example
         * // Create a 4x4 matrix
         * var m = new pc.Mat4();
         *
         * // Query the z-axis component
         * var y = new pc.Vec3();
         * m.getY(y);
         */
        getY: function (y) {
            y = (y === undefined) ? new pc.Vec3() : y;

            return y.set(this.data[4], this.data[5], this.data[6]);
        },

        /**
         * @function
         * @name pc.Mat4#getZ
         * @description Extracts the z-axis from the specified 4x4 matrix.
         * @param {pc.Vec3} [z] The vector to receive the z axis of the matrix.
         * @returns {pc.Vec3} The z-axis of the specified 4x4 matrix.
         * @example
         * // Create a 4x4 matrix
         * var m = new pc.Mat4();
         *
         * // Query the z-axis component
         * var z = new pc.Vec3();
         * m.getZ(z);
         */
        getZ: function (z) {
            z = (z === undefined) ? new pc.Vec3() : z;

            return z.set(this.data[8], this.data[9], this.data[10]);
        },

        /**
         * @function
         * @name pc.Mat4#getScale
         * @description Extracts the scale component from the specified 4x4 matrix.
         * @param {pc.Vec3} [scale] Vector to receive the scale.
         * @returns {pc.Vec3} The scale in X, Y and Z of the specified 4x4 matrix.
         * @example
         * // Create a 4x4 scale matrix
         * var m = new pc.Mat4().scale(2, 3, 4);
         *
         * // Query the scale component
         * var scale = m.getScale();
         */
        getScale: (function () {
            var x, y, z;

            x = new pc.Vec3();
            y = new pc.Vec3();
            z = new pc.Vec3();

            return function (scale) {
                scale = (scale === undefined) ? new pc.Vec3() : scale;

                this.getX(x);
                this.getY(y);
                this.getZ(z);
                scale.set(x.length(), y.length(), z.length());

                return scale;
            };
        }()),

        /**
         * @function
         * @name pc.Mat4#setFromEulerAngles
         * @description Sets the specified matrix to a rotation matrix defined by
         * Euler angles. The Euler angles are specified in XYZ order and in degrees.
         * @param {Number} ex Angle to rotate around X axis in degrees.
         * @param {Number} ey Angle to rotate around Y axis in degrees.
         * @param {Number} ez Angle to rotate around Z axis in degrees.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * var m = new pc.Mat4();
         * m.setFromEulerAngles(45, 90, 180);
         */
        // http://en.wikipedia.org/wiki/Rotation_matrix#Conversion_from_and_to_axis-angle
        // The 3D space is right-handed, so the rotation around each axis will be counterclockwise
        // for an observer placed so that the axis goes in his or her direction (Right-hand rule).
        setFromEulerAngles: function (ex, ey, ez) {
            var s1, c1, s2, c2, s3, c3, m;

            ex *= pc.math.DEG_TO_RAD;
            ey *= pc.math.DEG_TO_RAD;
            ez *= pc.math.DEG_TO_RAD;

            // Solution taken from http://en.wikipedia.org/wiki/Euler_angles#Matrix_orientation
            s1 = Math.sin(-ex);
            c1 = Math.cos(-ex);
            s2 = Math.sin(-ey);
            c2 = Math.cos(-ey);
            s3 = Math.sin(-ez);
            c3 = Math.cos(-ez);

            m = this.data;

            // Set rotation elements
            m[0] = c2 * c3;
            m[1] = -c2 * s3;
            m[2] = s2;
            m[3] = 0;

            m[4] = c1 * s3 + c3 * s1 * s2;
            m[5] = c1 * c3 - s1 * s2 * s3;
            m[6] = -c2 * s1;
            m[7] = 0;

            m[8] = s1 * s3 - c1 * c3 * s2;
            m[9] = c3 * s1 + c1 * s2 * s3;
            m[10] = c1 * c2;
            m[11] = 0;

            m[12] = 0;
            m[13] = 0;
            m[14] = 0;
            m[15] = 1;

            return this;
        },

        /**
         * @function
         * @name pc.Mat4#getEulerAngles
         * @description Extracts the Euler angles equivalent to the rotational portion
         * of the specified matrix. The returned Euler angles are in XYZ order an in degrees.
         * @param {pc.Vec3} [eulers] A 3-d vector to receive the Euler angles.
         * @returns {pc.Vec3} A 3-d vector containing the Euler angles.
         * @example
         * // Create a 4x4 rotation matrix of 45 degrees around the y-axis
         * var m = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 45);
         *
         * var eulers = m.getEulerAngles();
         */
        getEulerAngles: (function () {
            var scale = new pc.Vec3();

            return function (eulers) {
                var x, y, z, sx, sy, sz, m, halfPi;

                eulers = (eulers === undefined) ? new pc.Vec3() : eulers;

                this.getScale(scale);
                sx = scale.x;
                sy = scale.y;
                sz = scale.z;

                m = this.data;

                y = Math.asin(-m[2] / sx);
                halfPi = Math.PI * 0.5;

                if (y < halfPi) {
                    if (y > -halfPi) {
                        x = Math.atan2(m[6] / sy, m[10] / sz);
                        z = Math.atan2(m[1] / sx, m[0] / sx);
                    } else {
                        // Not a unique solution
                        z = 0;
                        x = -Math.atan2(m[4] / sy, m[5] / sy);
                    }
                } else {
                    // Not a unique solution
                    z = 0;
                    x = Math.atan2(m[4] / sy, m[5] / sy);
                }

                return eulers.set(x, y, z).scale(pc.math.RAD_TO_DEG);
            };
        }()),

        /**
         * @function
         * @name pc.Mat4#toString
         * @description Converts the specified matrix to string form.
         * @returns {String} The matrix in string form.
         * @example
         * var m = new pc.Mat4();
         * // Should output '[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]'
         * console.log(m.toString());
         */
        toString: function () {
            var i, t;

            t = '[';
            for (i = 0; i < 16; i += 1) {
                t += this.data[i];
                t += (i !== 15) ? ', ' : '';
            }
            t += ']';
            return t;
        }
    };

    /**
     * @field
     * @static
     * @readonly
     * @type pc.Mat4
     * @name pc.Mat4.IDENTITY
     * @description A constant matrix set to the identity.
     */
    Object.defineProperty(Mat4, 'IDENTITY', {
        get: (function () {
            var identity = new Mat4();
            return function () {
                return identity;
            };
        }())
    });

    /**
     * @field
     * @static
     * @readonly
     * @type pc.Mat4
     * @name pc.Mat4.ZERO
     * @description A constant matrix with all elements set to 0.
     */
    Object.defineProperty(Mat4, 'ZERO', {
        get: (function () {
            var zero = new Mat4(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
            return function () {
                return zero;
            };
        }())
    });

    return {
        Mat4: Mat4
    };
}()));

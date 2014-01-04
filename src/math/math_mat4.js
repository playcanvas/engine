pc.extend(pc, function () {
    /**
    * @name pc.Mat4
    * @class A 4x4 matrix.
    * @constructor Creates a new Mat4 object
    * @property {pc.Mat4} identity [Read only] The identity matrix.
    * @property {pc.Mat4} zero [Read only] A matrix with all elements set to zero.
    */
    var Mat4 = function () {
        this.data = new Float32Array(16);

        if (arguments.length === 16) {
            this.data.set(arguments);
        } else {
            this.setIdentity();
        }
    };

    Mat4.prototype = {
        /**
         * @function
         * @name pc.Mat4#add2
         * @description Returns the result of adding the specified 4x4 matrices together.
         * @param {pc.Mat4} lhs The 4x4 matrix used as the first operand of the addition.
         * @param {pc.Mat4} rhs The 4x4 matrix used as the second operand of the addition.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * var m = new pc.Mat4();
         *
         * m.add2(pc.Mat4.INDENTITY, pc.Mat4.ONE);
         * 
         * console.log("The result of the addition is: " a.toString());
         * @author Will Eastcott
         */
        add2: function (lhs, rhs) {
            var a = lhs.data;
            var b = rhs.data;
            var r = this.data;

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
         * @description Returns the result of adding the specified 4x4 matrices together.
         * @param {pc.Mat4} rhs The 4x4 matrix used as the second operand of the addition.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * var m = new pc.Mat4();
         *
         * m.add(pc.Mat4.ONE);
         * 
         * console.log("The result of the addition is: " a.toString());
         * @author Will Eastcott
         */
        add: function (rhs) {
            return this.add2(this, rhs);
        },

        /**
         * @function
         * @name pc.Mat4#clone
         * @description Creates a duplicate of the specified matrix.
         * @example
         * var src = new pc.Mat4().translate(10, 20, 30);
         * var dst = new pc.Mat4();
         * dst.copy(src);
         * console.log("The two matrices are " + (src.equal(dst) ? "equal" : "different"));
         * @author Will Eastcott
         */
        clone: function () {
            return new pc.Mat4().copy(this);
        },

        /**
         * @function
         * @name pc.Mat4#copy
         * @description Copies the contents of a source 4x4 matrix to a destination 4x4 matrix.
         * @param {pc.Mat4} src A 4x4 matrix to be copied.
         * var src = new pc.Mat4().translate(10, 20, 30);
         * var dst = new pc.Mat4();
         * dst.copy(src);
         * console.log("The two matrices are " + (src.equal(dst) ? "equal" : "different"));
         * @author Will Eastcott
         */
        copy: function (rhs) {
            var src = rhs.data;
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
         * @name pc.Mat4#equals
         * @description Reports whether two matrices are equal.
         * @returns {Boolean} true if the matrices are equal and false otherwise.
         * var a = new pc.Mat4().translate(10, 20, 30);
         * var b = new pc.Mat4();
         * console.log("The two matrices are " + (a.equals(b) ? "equal" : "different"));
         * @author Will Eastcott
         */
        equals: function (rhs) {
            var l = this.data;
            var r = rhs.data;

            return
               ((l[0] === r[0]) &&
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
         * var m = new pc.Mat4();
         * console.log("The matrix is " + (m.isIdentity() ? "identity" : "not identity"));
         * @author Will Eastcott
         */
        isIdentity: function () {
            var m = this.data;
            return
               ((m[0] === 1) &&
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
         * @description Returns the result of multiplying the specified 4x4 matrices together.
         * @param {pc.Mat4} lhs The 4x4 matrix used as the first multiplicand of the operation.
         * @param {pc.Mat4} rhs The 4x4 matrix used as the second multiplicand of the operation.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * var a = new pc.Mat4().translate(10, 20, 30);
         * var b = new pc.Mat4().rotate(180, pc.Vec3.UP);
         * var r = new pc.Mat4();
         *
         * // r = a * b
         * r.mul2(a, b);
         * 
         * console.log("The result of the multiplication is: " r.toString());
         * @author Will Eastcott
         */
        mul2: function (lhs, rhs) {
            var a = lhs.data;
            var b = rhs.data;
            var r = this.data;

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

            return this;
        },

        /**
         * @function
         * @name pc.Mat4#mul
         * @description Returns the result of multiplying the specified 4x4 matrices together.
         * @param {pc.Mat4} rhs The 4x4 matrix used as the second multiplicand of the operation.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * var a = new pc.Mat4().translate(10, 20, 30);
         * var b = new pc.Mat4().rotate(180, pc.Vec3.UP);
         *
         * // a = a * b
         * a.mul(b);
         * 
         * console.log("The result of the multiplication is: " a.toString());
         * @author Will Eastcott
         */
        mul: function (rhs) {
            return this.mul2(this, rhs);
        },

        /**
         * @function
         * @name pc.Mat4#transformPoint
         * @description Transforms a 3-dimensional point by a 4x4 matrix.
         * @param {pc.Vec3} vec The 3-dimensional vector to be multiplied.
         * @param {pc.Vec3} [res] An optional 3-dimensional vector to receive the result of the multiplication.
         * @returns {pc.Vec3} The input vector v multiplied by input matrix m.
         * @example
         * // Create a 3-dimensional vector
         * var v = new pc.Vec3(1, 2, 3);
         *
         * // Create a 4x4 translation matrix
         * var m = new pc.Mat4().translate(10, 20, 30);
         *
         * var tv = m.transformPoint(v);
         * @author Will Eastcott
         */
        transformPoint: function (vec, res) {
            if (typeof res === 'undefined') {
                res = new pc.Vec3();
            }

            var m = this.data;
            var v = vec.data;
            var r = res.data;

            var x, y, z;
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
         * @param {pc.Vec3} vec The 3-dimensional vector to be multiplied.
         * @param {pc.Vec3} [res] An optional 3-dimensional vector to receive the result of the multiplication.
         * @returns {pc.Vec3} The input vector v multiplied by input matrix m.
         * @example
         * // Create a 3-dimensional vector
         * var v = new pc.Vec3(1, 2, 3);
         *
         * // Create a 4x4 translation matrix
         * var m = new pc.Mat4().translate(10, 20, 30);
         *
         * var tv = m.transformVector(v);
         * @author Will Eastcott
         */
        transformVector: function (vec, res) {
            if (typeof res === 'undefined') {
                res = new pc.Vec3();
            }

            var m = this.data;
            var v = vec.data;
            var r = res.data;

            var x, y, z;
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
         * @name pc.Mat4#lookAt
         * @description Creates a viewing matrix derived from an eye point, a reference point indicating the center
         * of the scene, and an up vector. The matrix maps the reference point to the negative z-axis and the eye
         * point to the origin, so that when you use a typical projection matrix, the center of the scene maps to 
         * the center of the viewport. Similarly, the direction described by the up vector projected onto the
         * viewing plane is mapped to the positive y-axis so that it points upward in the viewport. The up vector
         * must not be parallel to the line of sight from the eye to the reference point.
         * @param {pc.Vec3} position 3-d vector holding view position.
         * @param {pc.Vec3} target 3-d vector holding reference point.
         * @param {pc.Vec3} up 3-d vector holding the up direction.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * var position = new pc.Vec3(10, 10, 10);
         * var target = new pc.Vec3(0, 0, 0);
         * var up = new pc.Vec3(0, 1, 0);
         * var m = new pc.Mat4().lookAt(position, target, up);
         * @author Will Eastcott
         */
        lookAt: function () {
            var x = new pc.Vec3();
            var y = new pc.Vec3();
            var z = new pc.Vec3();

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
        }(),

        /**
         * @function
         * @name pc.Mat4#frustum
         * @description Generates a persective projection matrix. The function's parameters define
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
         * var f = pc.Mat4().frustum(-2, 2, -1, 1, 1, 1000);
         * @author Will Eastcott
         */
        frustum: function (left, right, bottom, top, znear, zfar) {
            var temp1 = 2 * znear;
            var temp2 = right - left;
            var temp3 = top - bottom;
            var temp4 = zfar - znear;

            var r = this.data;
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
            r[11] = -1;
            r[12] = 0;
            r[13] = 0;
            r[14] = (-temp1 * zfar) / temp4;
            r[15] = 0;

            return this;
        },

        /**
         * @function
         * @name pc.Mat4#perspective
         * @description Generates a persective projection matrix. The function's parameters define
         * the shape of a frustum.
         * @param {Number} fovy The field of view in the frustum in the Y-axis of eye space.
         * @param {Number} aspect The aspect ratio of the frustum's projection plane (width / height).
         * @param {Number} znear The near clip plane in eye coordinates.
         * @param {Number} zfar The far clip plane in eye coordinates.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * // Create a 4x4 persepctive projection matrix
         * var persp = pc.Mat4().perspective(45, 16 / 9, 1, 1000);
         * @author Will Eastcott
         */
        perspective: function (fovy, aspect, znear, zfar) {
            var ymax = znear * Math.tan(fovy * Math.PI / 360);
            var xmax = ymax * aspect;

            return this.frustum(-xmax, xmax, -ymax, ymax, znear, zfar);
        },
        
        /**
         * @function
         * @name pc.Mat4#ortho
         * @description Generates an orthographic projection matrix. The function's parameters define
         * the shape of a cuboid-shaped frustum.
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
         * @author Will Eastcott
         */
        ortho: function (left, right, bottom, top, near, far) {
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
         * @name pc.Mat4#rotate
         * @description Generates a rotation matrix.
         * @param {Number} angle The angle of rotation in degrees.
         * @param {pc.Vec3} axis The normalized axis vector around which to rotate.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * // Create a 4x4 rotation matrix
         * var rm = new pc.Mat4().rotate(90, pc.Vec3.UP);
         * @author Will Eastcott
         */
        rotate: function (angle, axis) {
            angle *= pc.math.DEG_TO_RAD;

            var m = this.data;
            var x = axis.x, y = axis.y, z = axis.z;
            var c = Math.cos(angle);
            var s = Math.sin(angle);
            var t = 1-c;
            var tx = t * x;
            var ty = t * y;

            m[0] = tx*x+c;
            m[1] = tx*y+s*z;
            m[2] = tx*z-s*y;
            m[3] = 0;
            m[4] = tx*y-s*z;
            m[5] = ty*y+c;
            m[6] = ty*z+s*x;
            m[7] = 0;
            m[8] = tx*z+s*y;
            m[9] = ty*z-x*s;
            m[10] = t*z*z+c;
            m[11] = 0;
            m[12] = 0;
            m[13] = 0;
            m[14] = 0;
            m[15] = 1;

            return this;
        },

        /**
         * @function
         * @name pc.Mat4#translate
         * @description Generates a translation matrix.
         * @param {Number} x The x-component of the translation.
         * @param {Number} y The y-component of the translation.
         * @param {Number} z The z-component of the translation.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * // Create a 4x4 translation matrix
         * var tm = new pc.Mat4().translate(10, 10, 10);
         * @author Will Eastcott
         */
        translate: function (tx, ty, tz) {
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
         * @function
         * @name pc.Mat4#scale
         * @description Generates a scale matrix.
         * @param {Number} x The x-component of the scale.
         * @param {Number} y The y-component of the scale.
         * @param {Number} z The z-component of the scale.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * // Create a 4x4 scale matrix
         * var sm = new pc.Mat4().scale(10, 10, 10);
         * @author Will Eastcott
         */
        scale: function (sx, sy, sz) {
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
         * @description Generates the inverse of the specified 4x4 matrix.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * // Create a 4x4 rotation matrix of 180 degrees around the y-axis
         * var rot = new pc.Mat4().rotate(180, pc.Vec3.UP);
         *
         * // Invert in place
         * rot.invert();
         * @author Will Eastcott
         */
        invert: function () {
            var m = this.data;

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

            var invDet = 1 / (b00*b11 - b01*b10 + b02*b09 + b03*b08 - b04*b07 + b05*b06);

            m[0] = (a11*b11 - a12*b10 + a13*b09)*invDet;
            m[1] = (-a01*b11 + a02*b10 - a03*b09)*invDet;
            m[2] = (a31*b05 - a32*b04 + a33*b03)*invDet;
            m[3] = (-a21*b05 + a22*b04 - a23*b03)*invDet;
            m[4] = (-a10*b11 + a12*b08 - a13*b07)*invDet;
            m[5] = (a00*b11 - a02*b08 + a03*b07)*invDet;
            m[6] = (-a30*b05 + a32*b02 - a33*b01)*invDet;
            m[7] = (a20*b05 - a22*b02 + a23*b01)*invDet;
            m[8] = (a10*b10 - a11*b08 + a13*b06)*invDet;
            m[9] = (-a00*b10 + a01*b08 - a03*b06)*invDet;
            m[10] = (a30*b04 - a31*b02 + a33*b00)*invDet;
            m[11] = (-a20*b04 + a21*b02 - a23*b00)*invDet;
            m[12] = (-a10*b09 + a11*b07 - a12*b06)*invDet;
            m[13] = (a00*b09 - a01*b07 + a02*b06)*invDet;
            m[14] = (-a30*b03 + a31*b01 - a32*b00)*invDet;
            m[15] = (a20*b03 - a21*b01 + a22*b00)*invDet;

            return this;
        },

        /**
         * @function
         * @name pc.Mat4#identity
         * @description Sets the matrix to the identity matrix.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * m.setIdentity();
         * console.log("The two matrices are " + (src.equal(dst) ? "equal" : "different"));
         * @author Will Eastcott
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
         * @description Composes a 4x4 matrix from a translation, a quaternion rotation and
         * a scale.
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
         * @author Will Eastcott
         */
        setTRS: function (t, r, s) {
            var tx = t.x;
            var ty = t.y;
            var tz = t.z;

            var qx = r.x;
            var qy = r.y;
            var qz = r.z;
            var qw = r.w;

            var sx = s.x;
            var sy = s.y;
            var sz = s.z;

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

            var m = this.data;
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
         * @description Generates the transpose of the specified 4x4 matrix.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * var m = new pc.Mat4();
         *
         * // Transpose in place
         * m.transpose();
         * @author Will Eastcott
         */
        transpose: function () {
            var m = this.data;

            var tmp;
            tmp = m[1]; m[1] = m[4]; m[4] = tmp;
            tmp = m[2]; m[2] = m[8]; m[8] = tmp;
            tmp = m[3]; m[3] = m[12]; m[12] = tmp;
            tmp = m[6]; m[6] = m[9]; m[9] = tmp;
            tmp = m[7]; m[7] = m[13]; m[13] = tmp;
            tmp = m[11]; m[11] = m[14]; m[14] = tmp;

            return this;
        },

        invertTo3x3: function (res) {
            var m = this.data;
            var r = res.data;

            var a11 =  m[10] * m[5] - m[6] * m[9];
            var a21 = -m[10] * m[1] + m[2] * m[9];
            var a31 =  m[6]  * m[1] - m[2] * m[5];
            var a12 = -m[10] * m[4] + m[6] * m[8];
            var a22 =  m[10] * m[0] - m[2] * m[8];
            var a32 = -m[6]  * m[0] + m[2] * m[4];
            var a13 =  m[9]  * m[4] - m[5] * m[8];
            var a23 = -m[9]  * m[0] + m[1] * m[8];
            var a33 =  m[5]  * m[0] - m[1] * m[4];

            var det =  m[0] * a11 + m[1] * a12 + m[2] * a13;
            if (det == 0) { // no inverse
                console.warn("pc.Mat4#invertTo3x3: Matrix not invertible");
                return r;
            }

            var idet = 1.0 / det;

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
         * @name pc.Vec3#getTranslation
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
         * @author Will Eastcott
         */
        getTranslation: function (t) {
            if (typeof t === 'undefined') {
                t = new pc.Vec3();
            }

            return t.set(this.data[12], this.data[13], this.data[14]);
        },

        /**
         * @function
         * @name pc.Vec3#getX
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
         * @author Will Eastcott
         */
        getX: function (x) {
            if (typeof x === 'undefined') {
                x = new pc.Vec3();
            }

            return x.set(this.data[0], this.data[1], this.data[2]);
        },

        /**
         * @function
         * @name pc.Vec3#getY
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
         * @author Will Eastcott
         */
        getY: function (y) {
            if (typeof y === 'undefined') {
                y = new pc.Vec3();
            }

            return y.set(this.data[4], this.data[5], this.data[6]);
        },

        /**
         * @function
         * @name pc.Vec3#getZ
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
         * @author Will Eastcott
         */
        getZ: function (z) {
            if (typeof z === 'undefined') {
                z = new pc.Vec3();
            }

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
         * @author Will Eastcott
         */
        getScale: function () {
            var x = new pc.Vec3();
            var y = new pc.Vec3();
            var z = new pc.Vec3();

            return function (scale) {
                if (typeof scale === 'undefined') {
                    scale = new pc.Vec3();
                }

                this.getX(x);
                this.getY(y);
                this.getZ(z);
                scale.set(x.length(), y.length(), z.length());

                return scale;
            };
        }(),

        /**
         * @function
         * @name pc.Mat4#setFromEulers
         * @description Sets a 4x4 matrix from Euler angles specified in XYZ order.
         * @param {Number} ex Angle to rotate around X axis in degrees.
         * @param {Number} ey Angle to rotate around Y axis in degrees.
         * @param {Number} ez Angle to rotate around Z axis in degrees.
         * @returns {pc.Mat4} Self for chaining.
         * @example
         * var m = new pc.Mat4();
         * m.setFromEulers(45, 90, 180);
         * @author Will Eastcott
         */
        // http://en.wikipedia.org/wiki/Rotation_matrix#Conversion_from_and_to_axis-angle
        // The 3D space is right-handed, so the rotation around each axis will be counterclockwise 
        // for an observer placed so that the axis goes in his or her direction (Right-hand rule).
        setFromEulers: function (ex, ey, ez) {
            ex *= pc.math.DEG_TO_RAD;
            ey *= pc.math.DEG_TO_RAD;
            ez *= pc.math.DEG_TO_RAD;

            // Solution taken from http://en.wikipedia.org/wiki/Euler_angles#Matrix_orientation
            var s1 = Math.sin(-ex);
            var c1 = Math.cos(-ex);
            var s2 = Math.sin(-ey);
            var c2 = Math.cos(-ey);
            var s3 = Math.sin(-ez);
            var c3 = Math.cos(-ez);

            var m = this.data;

            // Set rotation elements
            m[0] = c2*c3;
            m[1] = -c2*s3;
            m[2] = s2;
            m[3] = 0;

            m[4] = c1*s3 + c3*s1*s2;
            m[5] = c1*c3 - s1*s2*s3;
            m[6] = -c2*s1;
            m[7] = 0;

            m[8] = s1*s3 - c1*c3*s2;
            m[9] = c3*s1 + c1*s2*s3;
            m[10] = c1*c2;
            m[11] = 0;

            m[12] = 0;
            m[13] = 0;
            m[14] = 0;
            m[15] = 1;

            return this;
        },

        /**
         * @function
         * @name pc.Mat4#toEulers
         * @description Converts a 4x4 matrix to Euler angles specified in degrees in XYZ order.
         * @param {Float32Array} [eulers] A 3-d vector to receive the Euler angles.
         * @returns A 3-d vector containing the Euler angles.
         * @example
         * // Create a 4x4 rotation matrix of 45 degrees around the y-axis
         * var m = new pc.Mat4().rotate(45, pc.Vec3.UP);
         *
         * var eulers = m.toEulers();
         * @author Will Eastcott
         */
        toEulers: function () {
            var scale = new pc.Vec3();

            return function (eulers) {
                this.getScale(scale);
                var sx = scale.x;
                var sy = scale.y;
                var sz = scale.z;

                var m = this.data;

                var x; 
                var y = Math.asin(-m[2] / sx);
                var z;
                var HALF_PI = Math.PI / 2;
                if (y < HALF_PI) {
                    if (y > -HALF_PI) {
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

                return eulers.set(x * pc.math.RAD_TO_DEG, y * pc.math.RAD_TO_DEG, z * pc.math.RAD_TO_DEG);
            }
        }(),

        /**
         * @function
         * @name pc.Mat4#toString
         * @description Converts the matrix to string form.
         * @returns {String} The matrix in string form.
         * @example
         * var m = new pc.Mat4();
         * // Should output '[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]'
         * console.log(m.toString());
         * @author Will Eastcott
         */
        toString: function () {
            var t = "[";
            for (var i = 0; i < 16; i++) {
                t += this.data[i];
                t += (i !== 15) ? ", " : "";
            }
            t += "]";
            return t;
        }
    };

    Object.defineProperty(Mat4, 'IDENTITY', {
        get: function () {
            var identity = new Mat4();
            return function() {
                return identity;
            }
        }()
    });

    Object.defineProperty(Mat4, 'ZERO', {
        get: function () {
            var zero = new Mat4(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
            return function() {
                return zero;
            }
        }()
    });

    return {
        Mat4: Mat4
    };
}());
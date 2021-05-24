import { math } from './math.js';
import { Vec2 } from './vec2.js';
import { Vec3 } from './vec3.js';
import { Vec4 } from './vec4.js';

const _halfSize = new Vec2();
const x = new Vec3();
const y = new Vec3();
const z = new Vec3();
const scale = new Vec3();


/**
 * @class
 * @name Mat4
 * @classdesc A 4x4 matrix.
 * @description Creates a new identity Mat4 object.
 * @property {Float32Array} data Matrix elements in the form of a flat array.
 */
class Mat4 {
    constructor() {
        // Create an identity matrix. Note that a new Float32Array has all elements set
        // to zero by default, so we only need to set the relevant elements to one.
        const data = new Float32Array(16);
        data[0] = data[5] = data[10] = data[15] = 1;
        this.data = data;
    }

    // Static function which evaluates perspective projection matrix half size at the near plane
    static _getPerspectiveHalfSize(halfSize, fov, aspect, znear, fovIsHorizontal) {
        if (fovIsHorizontal) {
            halfSize.x = znear * Math.tan(fov * Math.PI / 360);
            halfSize.y = halfSize.x / aspect;
        } else {
            halfSize.y = znear * Math.tan(fov * Math.PI / 360);
            halfSize.x = halfSize.y * aspect;
        }
    }

    /**
     * @function
     * @name Mat4#add2
     * @description Adds the specified 4x4 matrices together and stores the result in
     * the current instance.
     * @param {Mat4} lhs - The 4x4 matrix used as the first operand of the addition.
     * @param {Mat4} rhs - The 4x4 matrix used as the second operand of the addition.
     * @returns {Mat4} Self for chaining.
     * @example
     * var m = new pc.Mat4();
     *
     * m.add2(pc.Mat4.IDENTITY, pc.Mat4.ONE);
     *
     * console.log("The result of the addition is: " + m.toString());
     */
    add2(lhs, rhs) {
        const a = lhs.data,
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
    }

    /**
     * @function
     * @name Mat4#add
     * @description Adds the specified 4x4 matrix to the current instance.
     * @param {Mat4} rhs - The 4x4 matrix used as the second operand of the addition.
     * @returns {Mat4} Self for chaining.
     * @example
     * var m = new pc.Mat4();
     *
     * m.add(pc.Mat4.ONE);
     *
     * console.log("The result of the addition is: " + m.toString());
     */
    add(rhs) {
        return this.add2(this, rhs);
    }

    /**
     * @function
     * @name Mat4#clone
     * @description Creates a duplicate of the specified matrix.
     * @returns {Mat4} A duplicate matrix.
     * @example
     * var src = new pc.Mat4().setFromEulerAngles(10, 20, 30);
     * var dst = src.clone();
     * console.log("The two matrices are " + (src.equals(dst) ? "equal" : "different"));
     */
    clone() {
        return new Mat4().copy(this);
    }

    /**
     * @function
     * @name Mat4#copy
     * @description Copies the contents of a source 4x4 matrix to a destination 4x4 matrix.
     * @param {Mat4} rhs - A 4x4 matrix to be copied.
     * @returns {Mat4} Self for chaining.
     * @example
     * var src = new pc.Mat4().setFromEulerAngles(10, 20, 30);
     * var dst = new pc.Mat4();
     * dst.copy(src);
     * console.log("The two matrices are " + (src.equals(dst) ? "equal" : "different"));
     */
    copy(rhs) {
        const src = rhs.data,
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
    }

    /**
     * @function
     * @name Mat4#equals
     * @description Reports whether two matrices are equal.
     * @param {Mat4} rhs - The other matrix.
     * @returns {boolean} True if the matrices are equal and false otherwise.
     * @example
     * var a = new pc.Mat4().setFromEulerAngles(10, 20, 30);
     * var b = new pc.Mat4();
     * console.log("The two matrices are " + (a.equals(b) ? "equal" : "different"));
     */
    equals(rhs) {
        const l = this.data,
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
    }

    /**
     * @function
     * @name Mat4#isIdentity
     * @description Reports whether the specified matrix is the identity matrix.
     * @returns {boolean} True if the matrix is identity and false otherwise.
     * @example
     * var m = new pc.Mat4();
     * console.log("The matrix is " + (m.isIdentity() ? "identity" : "not identity"));
     */
    isIdentity() {
        const m = this.data;

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
    }

    /**
     * @function
     * @name Mat4#mul2
     * @description Multiplies the specified 4x4 matrices together and stores the result in
     * the current instance.
     * @param {Mat4} lhs - The 4x4 matrix used as the first multiplicand of the operation.
     * @param {Mat4} rhs - The 4x4 matrix used as the second multiplicand of the operation.
     * @returns {Mat4} Self for chaining.
     * @example
     * var a = new pc.Mat4().setFromEulerAngles(10, 20, 30);
     * var b = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 180);
     * var r = new pc.Mat4();
     *
     * // r = a * b
     * r.mul2(a, b);
     *
     * console.log("The result of the multiplication is: " + r.toString());
     */
    mul2(lhs, rhs) {
        const a = lhs.data;
        const b = rhs.data;
        const r = this.data;

        const a00 = a[0];
        const a01 = a[1];
        const a02 = a[2];
        const a03 = a[3];
        const a10 = a[4];
        const a11 = a[5];
        const a12 = a[6];
        const a13 = a[7];
        const a20 = a[8];
        const a21 = a[9];
        const a22 = a[10];
        const a23 = a[11];
        const a30 = a[12];
        const a31 = a[13];
        const a32 = a[14];
        const a33 = a[15];

        let b0, b1, b2, b3;

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
    }

    /**
     * @function
     * @name Mat4#mulAffine2
     * @description Multiplies the specified 4x4 matrices together and stores the result in
     * the current instance. This function assumes the matrices are affine transformation matrices, where the upper left 3x3 elements
     * are a rotation matrix, and the bottom left 3 elements are translation. The rightmost column is assumed to be [0, 0, 0, 1]. The parameters
     * are not verified to be in the expected format. This function is faster than general {@link Mat4#mul2}.
     * @param {Mat4} lhs - The affine transformation 4x4 matrix used as the first multiplicand of the operation.
     * @param {Mat4} rhs - The affine transformation 4x4 matrix used as the second multiplicand of the operation.
     * @returns {Mat4} Self for chaining.
     */
    mulAffine2(lhs, rhs) {
        const a = lhs.data;
        const b = rhs.data;
        const r = this.data;

        const a00 = a[0];
        const a01 = a[1];
        const a02 = a[2];
        const a10 = a[4];
        const a11 = a[5];
        const a12 = a[6];
        const a20 = a[8];
        const a21 = a[9];
        const a22 = a[10];
        const a30 = a[12];
        const a31 = a[13];
        const a32 = a[14];

        let b0, b1, b2;

        b0 = b[0];
        b1 = b[1];
        b2 = b[2];
        r[0]  = a00 * b0 + a10 * b1 + a20 * b2;
        r[1]  = a01 * b0 + a11 * b1 + a21 * b2;
        r[2]  = a02 * b0 + a12 * b1 + a22 * b2;
        r[3] = 0;

        b0 = b[4];
        b1 = b[5];
        b2 = b[6];
        r[4]  = a00 * b0 + a10 * b1 + a20 * b2;
        r[5]  = a01 * b0 + a11 * b1 + a21 * b2;
        r[6]  = a02 * b0 + a12 * b1 + a22 * b2;
        r[7] = 0;

        b0 = b[8];
        b1 = b[9];
        b2 = b[10];
        r[8]  = a00 * b0 + a10 * b1 + a20 * b2;
        r[9]  = a01 * b0 + a11 * b1 + a21 * b2;
        r[10] = a02 * b0 + a12 * b1 + a22 * b2;
        r[11] = 0;

        b0 = b[12];
        b1 = b[13];
        b2 = b[14];
        r[12] = a00 * b0 + a10 * b1 + a20 * b2 + a30;
        r[13] = a01 * b0 + a11 * b1 + a21 * b2 + a31;
        r[14] = a02 * b0 + a12 * b1 + a22 * b2 + a32;
        r[15] = 1;

        return this;
    }

    /**
     * @function
     * @name Mat4#mul
     * @description Multiplies the current instance by the specified 4x4 matrix.
     * @param {Mat4} rhs - The 4x4 matrix used as the second multiplicand of the operation.
     * @returns {Mat4} Self for chaining.
     * @example
     * var a = new pc.Mat4().setFromEulerAngles(10, 20, 30);
     * var b = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 180);
     *
     * // a = a * b
     * a.mul(b);
     *
     * console.log("The result of the multiplication is: " + a.toString());
     */
    mul(rhs) {
        return this.mul2(this, rhs);
    }

    /**
     * @function
     * @name Mat4#transformPoint
     * @description Transforms a 3-dimensional point by a 4x4 matrix.
     * @param {Vec3} vec - The 3-dimensional point to be transformed.
     * @param {Vec3} [res] - An optional 3-dimensional point to receive the result of the transformation.
     * @returns {Vec3} The input point v transformed by the current instance.
     * @example
     * // Create a 3-dimensional point
     * var v = new pc.Vec3(1, 2, 3);
     *
     * // Create a 4x4 rotation matrix
     * var m = new pc.Mat4().setFromEulerAngles(10, 20, 30);
     *
     * var tv = m.transformPoint(v);
     */
    transformPoint(vec, res = new Vec3()) {
        const m = this.data;

        const x = vec.x;
        const y = vec.y;
        const z = vec.z;

        res.x = x * m[0] + y * m[4] + z * m[8] + m[12];
        res.y = x * m[1] + y * m[5] + z * m[9] + m[13];
        res.z = x * m[2] + y * m[6] + z * m[10] + m[14];

        return res;
    }

    /**
     * @function
     * @name Mat4#transformVector
     * @description Transforms a 3-dimensional vector by a 4x4 matrix.
     * @param {Vec3} vec - The 3-dimensional vector to be transformed.
     * @param {Vec3} [res] - An optional 3-dimensional vector to receive the result of the transformation.
     * @returns {Vec3} The input vector v transformed by the current instance.
     * @example
     * // Create a 3-dimensional vector
     * var v = new pc.Vec3(1, 2, 3);
     *
     * // Create a 4x4 rotation matrix
     * var m = new pc.Mat4().setFromEulerAngles(10, 20, 30);
     *
     * var tv = m.transformVector(v);
     */
    transformVector(vec, res = new Vec3()) {
        const m = this.data;

        const x = vec.x;
        const y = vec.y;
        const z = vec.z;

        res.x = x * m[0] + y * m[4] + z * m[8];
        res.y = x * m[1] + y * m[5] + z * m[9];
        res.z = x * m[2] + y * m[6] + z * m[10];

        return res;
    }

    /**
     * @function
     * @name Mat4#transformVec4
     * @description Transforms a 4-dimensional vector by a 4x4 matrix.
     * @param {Vec4} vec - The 4-dimensional vector to be transformed.
     * @param {Vec4} [res] - An optional 4-dimensional vector to receive the result of the transformation.
     * @returns {Vec4} The input vector v transformed by the current instance.
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
    transformVec4(vec, res = new Vec4()) {
        const m = this.data;

        const x = vec.x;
        const y = vec.y;
        const z = vec.z;
        const w = vec.w;

        res.x = x * m[0] + y * m[4] + z * m[8] + w * m[12];
        res.y = x * m[1] + y * m[5] + z * m[9] + w * m[13];
        res.z = x * m[2] + y * m[6] + z * m[10] + w * m[14];
        res.w = x * m[3] + y * m[7] + z * m[11] + w * m[15];

        return res;
    }

    /**
     * @function
     * @name Mat4#setLookAt
     * @description Sets the specified matrix to a viewing matrix derived from an eye point, a target point
     * and an up vector. The matrix maps the target point to the negative z-axis and the eye point to the
     * origin, so that when you use a typical projection matrix, the center of the scene maps to the center
     * of the viewport. Similarly, the direction described by the up vector projected onto the viewing plane
     * is mapped to the positive y-axis so that it points upward in the viewport. The up vector must not be
     * parallel to the line of sight from the eye to the reference point.
     * @param {Vec3} position - 3-d vector holding view position.
     * @param {Vec3} target - 3-d vector holding reference point.
     * @param {Vec3} up - 3-d vector holding the up direction.
     * @returns {Mat4} Self for chaining.
     * @example
     * var position = new pc.Vec3(10, 10, 10);
     * var target = new pc.Vec3(0, 0, 0);
     * var up = new pc.Vec3(0, 1, 0);
     * var m = new pc.Mat4().setLookAt(position, target, up);
     */
    setLookAt(position, target, up) {
        z.sub2(position, target).normalize();
        y.copy(up).normalize();
        x.cross(y, z).normalize();
        y.cross(z, x);

        const r = this.data;

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
    }

    /**
     * @private
     * @function
     * @name Mat4#setFrustum
     * @description Sets the specified matrix to a perspective projection matrix. The function's parameters define
     * the shape of a frustum.
     * @param {number} left - The x-coordinate for the left edge of the camera's projection plane in eye space.
     * @param {number} right - The x-coordinate for the right edge of the camera's projection plane in eye space.
     * @param {number} bottom - The y-coordinate for the bottom edge of the camera's projection plane in eye space.
     * @param {number} top - The y-coordinate for the top edge of the camera's projection plane in eye space.
     * @param {number} znear - The near clip plane in eye coordinates.
     * @param {number} zfar - The far clip plane in eye coordinates.
     * @returns {Mat4} Self for chaining.
     * @example
     * // Create a 4x4 perspective projection matrix
     * var f = pc.Mat4().setFrustum(-2, 2, -1, 1, 1, 1000);
     */
    setFrustum(left, right, bottom, top, znear, zfar) {
        const temp1 = 2 * znear;
        const temp2 = right - left;
        const temp3 = top - bottom;
        const temp4 = zfar - znear;

        const r = this.data;
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
    }

    /**
     * @function
     * @name Mat4#setPerspective
     * @description Sets the specified matrix to a perspective projection matrix. The function's
     * parameters define the shape of a frustum.
     * @param {number} fov - The frustum's field of view in degrees. The fovIsHorizontal parameter
     * controls whether this is a vertical or horizontal field of view. By default, it's a vertical
     * field of view.
     * @param {number} aspect - The aspect ratio of the frustum's projection plane (width / height).
     * @param {number} znear - The near clip plane in eye coordinates.
     * @param {number} zfar - The far clip plane in eye coordinates.
     * @param {boolean} [fovIsHorizontal=false] - Set to true to treat the fov as horizontal (x-axis)
     * and false for vertical (y-axis). Defaults to false.
     * @returns {Mat4} Self for chaining.
     * @example
     * // Create a 4x4 perspective projection matrix
     * var persp = pc.Mat4().setPerspective(45, 16 / 9, 1, 1000);
     */
    setPerspective(fov, aspect, znear, zfar, fovIsHorizontal) {
        Mat4._getPerspectiveHalfSize(_halfSize, fov, aspect, znear, fovIsHorizontal);
        return this.setFrustum(-_halfSize.x, _halfSize.x, -_halfSize.y, _halfSize.y, znear, zfar);
    }

    /**
     * @function
     * @name Mat4#setOrtho
     * @description Sets the specified matrix to an orthographic projection matrix. The function's parameters
     * define the shape of a cuboid-shaped frustum.
     * @param {number} left - The x-coordinate for the left edge of the camera's projection plane in eye space.
     * @param {number} right - The x-coordinate for the right edge of the camera's projection plane in eye space.
     * @param {number} bottom - The y-coordinate for the bottom edge of the camera's projection plane in eye space.
     * @param {number} top - The y-coordinate for the top edge of the camera's projection plane in eye space.
     * @param {number} near - The near clip plane in eye coordinates.
     * @param {number} far - The far clip plane in eye coordinates.
     * @returns {Mat4} Self for chaining.
     * @example
     * // Create a 4x4 orthographic projection matrix
     * var ortho = pc.Mat4().ortho(-2, 2, -2, 2, 1, 1000);
     */
    setOrtho(left, right, bottom, top, near, far) {
        const r = this.data;

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
    }

    /**
     * @function
     * @name Mat4#setFromAxisAngle
     * @description Sets the specified matrix to a rotation matrix equivalent to a rotation around
     * an axis. The axis must be normalized (unit length) and the angle must be specified in degrees.
     * @param {Vec3} axis - The normalized axis vector around which to rotate.
     * @param {number} angle - The angle of rotation in degrees.
     * @returns {Mat4} Self for chaining.
     * @example
     * // Create a 4x4 rotation matrix
     * var rm = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 90);
     */
    setFromAxisAngle(axis, angle) {
        angle *= math.DEG_TO_RAD;

        const x = axis.x;
        const y = axis.y;
        const z = axis.z;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const t = 1 - c;
        const tx = t * x;
        const ty = t * y;
        const m = this.data;

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
    }

    /**
     * @private
     * @function
     * @name Mat4#setTranslate
     * @description Sets the specified matrix to a translation matrix.
     * @param {number} x - The x-component of the translation.
     * @param {number} y - The y-component of the translation.
     * @param {number} z - The z-component of the translation.
     * @returns {Mat4} Self for chaining.
     * @example
     * // Create a 4x4 translation matrix
     * var tm = new pc.Mat4().setTranslate(10, 10, 10);
     */
    setTranslate(x, y, z) {
        const m = this.data;

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
        m[12] = x;
        m[13] = y;
        m[14] = z;
        m[15] = 1;

        return this;
    }

    /**
     * @private
     * @function
     * @name Mat4#setScale
     * @description Sets the specified matrix to a scale matrix.
     * @param {number} x - The x-component of the scale.
     * @param {number} y - The y-component of the scale.
     * @param {number} z - The z-component of the scale.
     * @returns {Mat4} Self for chaining.
     * @example
     * // Create a 4x4 scale matrix
     * var sm = new pc.Mat4().setScale(10, 10, 10);
     */
    setScale(x, y, z) {
        const m = this.data;

        m[0] = x;
        m[1] = 0;
        m[2] = 0;
        m[3] = 0;
        m[4] = 0;
        m[5] = y;
        m[6] = 0;
        m[7] = 0;
        m[8] = 0;
        m[9] = 0;
        m[10] = z;
        m[11] = 0;
        m[12] = 0;
        m[13] = 0;
        m[14] = 0;
        m[15] = 1;

        return this;
    }

    /**
     * @private
     * @function
     * @name Mat4#setViewport
     * @description Sets the specified matrix to a matrix transforming a normalized view volume (in range of -1 .. 1)
     * to their position inside a viewport (in range of 0 .. 1). This encapsulates a scaling to the size of the viewport
     * and a translation to the position of the viewport.
     * @param {number} x - The x-component of the position of the viewport (in 0..1 range).
     * @param {number} y - The y-component of the position of the viewport (in 0..1 range).
     * @param {number} width - The width of the viewport (in 0..1 range).
     * @param {number} height - The height of the viewport (in 0..1 range).
     * @returns {Mat4} Self for chaining.
     * @example
     * // Create a 4x4 viewport matrix which scales normalized view volume to full texture viewport.
     * var vm = new pc.Mat4().setViewport(0, 0, 1, 1);
     */
    setViewport(x, y, width, height) {
        const m = this.data;

        m[0] = width * 0.5;
        m[1] = 0;
        m[2] = 0;
        m[3] = 0;
        m[4] = 0;
        m[5] = height * 0.5;
        m[6] = 0;
        m[7] = 0;
        m[8] = 0;
        m[9] = 0;
        m[10] = 0.5;
        m[11] = 0;
        m[12] = x + width * 0.5;
        m[13] = y + height * 0.5;
        m[14] = 0.5;
        m[15] = 1;

        return this;
    }

    /**
     * @function
     * @name Mat4#invert
     * @description Sets the specified matrix to its inverse.
     * @returns {Mat4} Self for chaining.
     * @example
     * // Create a 4x4 rotation matrix of 180 degrees around the y-axis
     * var rot = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 180);
     *
     * // Invert in place
     * rot.invert();
     */
    invert() {
        const m = this.data;

        const a00 = m[0];
        const a01 = m[1];
        const a02 = m[2];
        const a03 = m[3];
        const a10 = m[4];
        const a11 = m[5];
        const a12 = m[6];
        const a13 = m[7];
        const a20 = m[8];
        const a21 = m[9];
        const a22 = m[10];
        const a23 = m[11];
        const a30 = m[12];
        const a31 = m[13];
        const a32 = m[14];
        const a33 = m[15];

        const b00 = a00 * a11 - a01 * a10;
        const b01 = a00 * a12 - a02 * a10;
        const b02 = a00 * a13 - a03 * a10;
        const b03 = a01 * a12 - a02 * a11;
        const b04 = a01 * a13 - a03 * a11;
        const b05 = a02 * a13 - a03 * a12;
        const b06 = a20 * a31 - a21 * a30;
        const b07 = a20 * a32 - a22 * a30;
        const b08 = a20 * a33 - a23 * a30;
        const b09 = a21 * a32 - a22 * a31;
        const b10 = a21 * a33 - a23 * a31;
        const b11 = a22 * a33 - a23 * a32;

        const det = (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
        if (det === 0) {
            this.setIdentity();
        } else {
            const invDet = 1 / det;

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
    }

    /**
     * @function
     * @name Mat4#set
     * @description Sets matrix data from an array.
     * @param {number[]} src - Source array. Must have 16 values.
     * @returns {Mat4} Self for chaining.
     */
    set(src) {
        const dst = this.data;

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
    }

    /**
     * @function
     * @name Mat4#setIdentity
     * @description Sets the specified matrix to the identity matrix.
     * @returns {Mat4} Self for chaining.
     * @example
     * m.setIdentity();
     * console.log("The matrix is " + (m.isIdentity() ? "identity" : "not identity"));
     */
    setIdentity() {
        const m = this.data;

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
    }

    /**
     * @function
     * @name Mat4#setTRS
     * @description Sets the specified matrix to the concatenation of a translation, a
     * quaternion rotation and a scale.
     * @param {Vec3} t - A 3-d vector translation.
     * @param {Quat} r - A quaternion rotation.
     * @param {Vec3} s - A 3-d vector scale.
     * @returns {Mat4} Self for chaining.
     * @example
     * var t = new pc.Vec3(10, 20, 30);
     * var r = new pc.Quat();
     * var s = new pc.Vec3(2, 2, 2);
     *
     * var m = new pc.Mat4();
     * m.setTRS(t, r, s);
     */
    setTRS(t, r, s) {
        const qx = r.x;
        const qy = r.y;
        const qz = r.z;
        const qw = r.w;

        const sx = s.x;
        const sy = s.y;
        const sz = s.z;

        const x2 = qx + qx;
        const y2 = qy + qy;
        const z2 = qz + qz;
        const xx = qx * x2;
        const xy = qx * y2;
        const xz = qx * z2;
        const yy = qy * y2;
        const yz = qy * z2;
        const zz = qz * z2;
        const wx = qw * x2;
        const wy = qw * y2;
        const wz = qw * z2;

        const m = this.data;

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

        m[12] = t.x;
        m[13] = t.y;
        m[14] = t.z;
        m[15] = 1;

        return this;
    }

    /**
     * @function
     * @name Mat4#transpose
     * @description Sets the specified matrix to its transpose.
     * @returns {Mat4} Self for chaining.
     * @example
     * var m = new pc.Mat4();
     *
     * // Transpose in place
     * m.transpose();
     */
    transpose() {
        let tmp;
        const m = this.data;

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
    }

    invertTo3x3(res) {
        const m = this.data;
        const r = res.data;

        const m0 = m[0];
        const m1 = m[1];
        const m2 = m[2];

        const m4 = m[4];
        const m5 = m[5];
        const m6 = m[6];

        const m8 = m[8];
        const m9 = m[9];
        const m10 = m[10];

        const a11 =  m10 * m5 - m6 * m9;
        const a21 = -m10 * m1 + m2 * m9;
        const a31 =  m6  * m1 - m2 * m5;
        const a12 = -m10 * m4 + m6 * m8;
        const a22 =  m10 * m0 - m2 * m8;
        const a32 = -m6  * m0 + m2 * m4;
        const a13 =  m9  * m4 - m5 * m8;
        const a23 = -m9  * m0 + m1 * m8;
        const a33 =  m5  * m0 - m1 * m4;

        const det =  m0 * a11 + m1 * a12 + m2 * a13;
        if (det === 0) { // no inverse
            return this;
        }

        const idet = 1 / det;

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
    }

    /**
     * @function
     * @name Mat4#getTranslation
     * @description Extracts the translational component from the specified 4x4 matrix.
     * @param {Vec3} [t] - The vector to receive the translation of the matrix.
     * @returns {Vec3} The translation of the specified 4x4 matrix.
     * @example
     * // Create a 4x4 matrix
     * var m = new pc.Mat4();
     *
     * // Query the z-axis component
     * var t = new pc.Vec3();
     * m.getTranslation(t);
     */
    getTranslation(t = new Vec3()) {
        return t.set(this.data[12], this.data[13], this.data[14]);
    }

    /**
     * @function
     * @name Mat4#getX
     * @description Extracts the x-axis from the specified 4x4 matrix.
     * @param {Vec3} [x] - The vector to receive the x axis of the matrix.
     * @returns {Vec3} The x-axis of the specified 4x4 matrix.
     * @example
     * // Create a 4x4 matrix
     * var m = new pc.Mat4();
     *
     * // Query the z-axis component
     * var x = new pc.Vec3();
     * m.getX(x);
     */
    getX(x = new Vec3()) {
        return x.set(this.data[0], this.data[1], this.data[2]);
    }

    /**
     * @function
     * @name Mat4#getY
     * @description Extracts the y-axis from the specified 4x4 matrix.
     * @param {Vec3} [y] - The vector to receive the y axis of the matrix.
     * @returns {Vec3} The y-axis of the specified 4x4 matrix.
     * @example
     * // Create a 4x4 matrix
     * var m = new pc.Mat4();
     *
     * // Query the z-axis component
     * var y = new pc.Vec3();
     * m.getY(y);
     */
    getY(y = new Vec3()) {
        return y.set(this.data[4], this.data[5], this.data[6]);
    }

    /**
     * @function
     * @name Mat4#getZ
     * @description Extracts the z-axis from the specified 4x4 matrix.
     * @param {Vec3} [z] - The vector to receive the z axis of the matrix.
     * @returns {Vec3} The z-axis of the specified 4x4 matrix.
     * @example
     * // Create a 4x4 matrix
     * var m = new pc.Mat4();
     *
     * // Query the z-axis component
     * var z = new pc.Vec3();
     * m.getZ(z);
     */
    getZ(z = new Vec3()) {
        return z.set(this.data[8], this.data[9], this.data[10]);
    }

    /**
     * @function
     * @name Mat4#getScale
     * @description Extracts the scale component from the specified 4x4 matrix.
     * @param {Vec3} [scale] - Vector to receive the scale.
     * @returns {Vec3} The scale in X, Y and Z of the specified 4x4 matrix.
     * @example
     * // Query the scale component
     * var scale = m.getScale();
     */
    getScale(scale = new Vec3()) {
        this.getX(x);
        this.getY(y);
        this.getZ(z);
        scale.set(x.length(), y.length(), z.length());

        return scale;
    }

    /**
     * @function
     * @name Mat4#setFromEulerAngles
     * @description Sets the specified matrix to a rotation matrix defined by
     * Euler angles. The Euler angles are specified in XYZ order and in degrees.
     * @param {number} ex - Angle to rotate around X axis in degrees.
     * @param {number} ey - Angle to rotate around Y axis in degrees.
     * @param {number} ez - Angle to rotate around Z axis in degrees.
     * @returns {Mat4} Self for chaining.
     * @example
     * var m = new pc.Mat4();
     * m.setFromEulerAngles(45, 90, 180);
     */
    // http://en.wikipedia.org/wiki/Rotation_matrix#Conversion_from_and_to_axis-angle
    // The 3D space is right-handed, so the rotation around each axis will be counterclockwise
    // for an observer placed so that the axis goes in his or her direction (Right-hand rule).
    setFromEulerAngles(ex, ey, ez) {
        ex *= math.DEG_TO_RAD;
        ey *= math.DEG_TO_RAD;
        ez *= math.DEG_TO_RAD;

        // Solution taken from http://en.wikipedia.org/wiki/Euler_angles#Matrix_orientation
        const s1 = Math.sin(-ex);
        const c1 = Math.cos(-ex);
        const s2 = Math.sin(-ey);
        const c2 = Math.cos(-ey);
        const s3 = Math.sin(-ez);
        const c3 = Math.cos(-ez);

        const m = this.data;

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
    }

    /**
     * @function
     * @name Mat4#getEulerAngles
     * @description Extracts the Euler angles equivalent to the rotational portion
     * of the specified matrix. The returned Euler angles are in XYZ order an in degrees.
     * @param {Vec3} [eulers] - A 3-d vector to receive the Euler angles.
     * @returns {Vec3} A 3-d vector containing the Euler angles.
     * @example
     * // Create a 4x4 rotation matrix of 45 degrees around the y-axis
     * var m = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 45);
     *
     * var eulers = m.getEulerAngles();
     */
    getEulerAngles(eulers = new Vec3()) {
        this.getScale(scale);
        const sx = scale.x;
        const sy = scale.y;
        const sz = scale.z;

        if (sx === 0 || sy === 0 || sz === 0)
            return eulers.set(0, 0, 0);

        const m = this.data;

        const y = Math.asin(-m[2] / sx);
        const halfPi = Math.PI * 0.5;

        let x, z;

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

        return eulers.set(x, y, z).mulScalar(math.RAD_TO_DEG);
    }

    /**
     * @function
     * @name Mat4#toString
     * @description Converts the specified matrix to string form.
     * @returns {string} The matrix in string form.
     * @example
     * var m = new pc.Mat4();
     * // Outputs [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
     * console.log(m.toString());
     */
    toString() {
        let t = '[';
        for (let i = 0; i < 16; i += 1) {
            t += this.data[i];
            t += (i !== 15) ? ', ' : '';
        }
        t += ']';
        return t;
    }

    /**
     * @field
     * @static
     * @readonly
     * @name Mat4.IDENTITY
     * @type {Mat4}
     * @description A constant matrix set to the identity.
     */
    static IDENTITY = Object.freeze(new Mat4());

    /**
     * @field
     * @static
     * @readonly
     * @name Mat4.ZERO
     * @type {Mat4}
     * @description A constant matrix with all elements set to 0.
     */
    static ZERO = Object.freeze(new Mat4().set([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
}

export { Mat4 };

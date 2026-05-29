import { math } from './math.js';
import { Vec3 } from './vec3.js';

/**
 * @import { Mat4 } from './mat4.js'
 */

/**
 * A quaternion representing rotation in 3D space. Quaternions are typically used to represent
 * rotations in 3D applications, offering advantages over Euler angles including no gimbal lock and
 * more efficient interpolation.
 *
 * @category Math
 */
class Quat {
    /**
     * The x component of the quaternion.
     *
     * @type {number}
     */
    x;

    /**
     * The y component of the quaternion.
     *
     * @type {number}
     */
    y;

    /**
     * The z component of the quaternion.
     *
     * @type {number}
     */
    z;

    /**
     * The w component of the quaternion.
     *
     * @type {number}
     */
    w;

    /**
     * Creates a new Quat instance.
     *
     * @overload
     * @param {number} [x] - The x value. Defaults to 0.
     * @param {number} [y] - The y value. Defaults to 0.
     * @param {number} [z] - The z value. Defaults to 0.
     * @param {number} [w] - The w value. Defaults to 1.
     * @example
     * const q1 = new pc.Quat(); // defaults to 0, 0, 0, 1
     * const q2 = new pc.Quat(1, 2, 3, 4);
     */
    /**
     * Creates a new Quat instance.
     *
     * @overload
     * @param {number[]} arr - The array to set the quaternion values from.
     * @example
     * const q = new pc.Quat([1, 2, 3, 4]);
     */
    /**
     * @param {number|number[]} [x] - The x value. Defaults to 0. If x is an array of length 4, the
     * array will be used to populate all components.
     * @param {number} [y] - The y value. Defaults to 0.
     * @param {number} [z] - The z value. Defaults to 0.
     * @param {number} [w] - The w value. Defaults to 1.
     */
    constructor(x = 0, y = 0, z = 0, w = 1) {
        if (x.length === 4) {
            this.x = x[0];
            this.y = x[1];
            this.z = x[2];
            this.w = x[3];
        } else {
            this.x = x;
            this.y = y;
            this.z = z;
            this.w = w;
        }
    }

    /**
     * Returns an identical copy of the specified quaternion.
     *
     * @returns {this} A new quaternion identical to this one.
     * @example
     * const q = new pc.Quat(-0.11, -0.15, -0.46, 0.87);
     * const qclone = q.clone();
     *
     * console.log("The result of the cloning is: " + qclone.toString());
     */
    clone() {
        /** @type {this} */
        const cstr = this.constructor;
        return new cstr(this.x, this.y, this.z, this.w);
    }

    /**
     * Conjugates a quaternion.
     *
     * @param {Quat} [src] - The quaternion to conjugate. If not set, the operation is done in place.
     * @returns {Quat} Self for chaining.
     * @example
     * const q = new pc.Quat(1, 2, 3, 4);
     * q.conjugate();
     * // q is now [-1, -2, -3, 4]
     * @ignore
     */
    conjugate(src = this) {
        this.x = src.x * -1;
        this.y = src.y * -1;
        this.z = src.z * -1;
        this.w = src.w;

        return this;
    }

    /**
     * Copies the contents of a source quaternion to a destination quaternion.
     *
     * @param {Quat} rhs - The quaternion to be copied.
     * @returns {Quat} Self for chaining.
     * @example
     * const src = new pc.Quat();
     * const dst = new pc.Quat();
     * dst.copy(src);
     * console.log("The two quaternions are " + (src.equals(dst) ? "equal" : "different"));
     */
    copy(rhs) {
        this.x = rhs.x;
        this.y = rhs.y;
        this.z = rhs.z;
        this.w = rhs.w;

        return this;
    }

    /**
     * Calculates the dot product of two quaternions.
     *
     * @param {Quat} other - The quaternion to calculate the dot product with.
     * @returns {number} The dot product of the two quaternions.
     * @example
     * const a = new pc.Quat(1, 0, 0, 0);
     * const b = new pc.Quat(0, 1, 0, 0);
     * console.log("Dot product: " + a.dot(b)); // Outputs 0
     */
    dot(other) {
        return this.x * other.x + this.y * other.y + this.z * other.z + this.w * other.w;
    }

    /**
     * Reports whether two quaternions are equal.
     *
     * @param {Quat} rhs - The quaternion to be compared against.
     * @returns {boolean} True if the quaternions are equal and false otherwise.
     * @example
     * const a = new pc.Quat();
     * const b = new pc.Quat();
     * console.log("The two quaternions are " + (a.equals(b) ? "equal" : "different"));
     */
    equals(rhs) {
        return ((this.x === rhs.x) && (this.y === rhs.y) && (this.z === rhs.z) && (this.w === rhs.w));
    }

    /**
     * Reports whether two quaternions are equal using an absolute error tolerance.
     *
     * @param {Quat} rhs - The quaternion to be compared against.
     * @param {number} [epsilon] - The maximum difference between each component of the two
     * quaternions. Defaults to 1e-6.
     * @returns {boolean} True if the quaternions are equal and false otherwise.
     * @example
     * const a = new pc.Quat();
     * const b = new pc.Quat();
     * console.log("The two quaternions are approximately " + (a.equalsApprox(b, 1e-9) ? "equal" : "different"));
     */
    equalsApprox(rhs, epsilon = 1e-6) {
        return (Math.abs(this.x - rhs.x) < epsilon) &&
            (Math.abs(this.y - rhs.y) < epsilon) &&
            (Math.abs(this.z - rhs.z) < epsilon) &&
            (Math.abs(this.w - rhs.w) < epsilon);
    }

    /**
     * Gets the rotation axis and angle for a given quaternion. If a quaternion is created with
     * `setFromAxisAngle`, this method will return the same values as provided in the original
     * parameter list OR functionally equivalent values.
     *
     * @param {Vec3} axis - The 3-dimensional vector to receive the axis of rotation.
     * @returns {number} Angle, in degrees, of the rotation.
     * @example
     * const q = new pc.Quat();
     * q.setFromAxisAngle(new pc.Vec3(0, 1, 0), 90);
     * const v = new pc.Vec3();
     * const angle = q.getAxisAngle(v);
     * // Outputs 90
     * console.log(angle);
     * // Outputs [0, 1, 0]
     * console.log(v.toString());
     */
    getAxisAngle(axis) {
        let rad = Math.acos(this.w) * 2;
        const s = Math.sin(rad / 2);
        if (s !== 0) {
            axis.x = this.x / s;
            axis.y = this.y / s;
            axis.z = this.z / s;
            if (axis.x < 0 || axis.y < 0 || axis.z < 0) {
                // Flip the sign
                axis.x *= -1;
                axis.y *= -1;
                axis.z *= -1;
                rad *= -1;
            }
        } else {
            // If s is zero, return any axis (no rotation - axis does not matter)
            axis.x = 1;
            axis.y = 0;
            axis.z = 0;
        }
        return rad * math.RAD_TO_DEG;
    }

    /**
     * Converts this quaternion to Euler angles, specified in degrees. The decomposition uses an
     * **intrinsic XYZ** order, representing the angles required to achieve the quaternion's
     * orientation by rotating sequentially: first around the X-axis, then around the newly
     * transformed Y-axis, and finally around the resulting Z-axis.
     *
     * @param {Vec3} [eulers] - An optional 3-dimensional vector to receive the calculated
     * Euler angles (output parameter). If not provided, a new Vec3 object will be allocated
     * and returned.
     * @returns {Vec3} The 3-dimensional vector holding the Euler angles in degrees. This will be
     * the same object passed in as the `eulers` parameter (if one was provided).
     * @example
     * const q = new pc.Quat();
     * q.setFromAxisAngle(pc.Vec3.UP, 90);
     * const e = new pc.Vec3();
     * q.getEulerAngles(e);
     * // Outputs [0, 90, 0]
     * console.log(e.toString());
     */
    getEulerAngles(eulers = new Vec3()) {
        let x, y, z;

        const qx = this.x;
        const qy = this.y;
        const qz = this.z;
        const qw = this.w;

        const a2 = 2 * (qw * qy - qx * qz);

        if (a2 <= -0.99999) {
            x = 2 * Math.atan2(qx, qw);
            y = -Math.PI / 2;
            z = 0;
        } else if (a2 >= 0.99999) {
            x = 2 * Math.atan2(qx, qw);
            y = Math.PI / 2;
            z = 0;
        } else {
            x = Math.atan2(2 * (qw * qx + qy * qz), 1 - 2 * (qx * qx + qy * qy));
            y = Math.asin(a2);
            z = Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz));
        }

        return eulers.set(x, y, z).mulScalar(math.RAD_TO_DEG);
    }

    /**
     * Generates the inverse of the specified quaternion.
     *
     * @param {Quat} [src] - The quaternion to invert. If not set, the operation is done in place.
     * @returns {Quat} Self for chaining.
     * @example
     * // Create a quaternion rotated 180 degrees around the y-axis
     * const rot = new pc.Quat().setFromEulerAngles(0, 180, 0);
     *
     * // Invert in place
     * rot.invert();
     */
    invert(src = this) {
        return this.conjugate(src).normalize();
    }

    /**
     * Returns the magnitude of the specified quaternion.
     *
     * @returns {number} The magnitude of the specified quaternion.
     * @example
     * const q = new pc.Quat(0, 0, 0, 5);
     * const len = q.length();
     * // Outputs 5
     * console.log("The length of the quaternion is: " + len);
     */
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
    }

    /**
     * Returns the magnitude squared of the specified quaternion.
     *
     * @returns {number} The magnitude squared of the quaternion.
     * @example
     * const q = new pc.Quat(3, 4, 0, 0);
     * const lenSq = q.lengthSq();
     * // Outputs 25
     * console.log("The length squared of the quaternion is: " + lenSq);
     */
    lengthSq() {
        return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
    }


    /**
     * Performs a linear interpolation between two quaternions. The result of the interpolation
     * is written to the quaternion calling the function.
     *
     * @param {Quat} lhs - The quaternion to interpolate from.
     * @param {Quat} rhs - The quaternion to interpolate to.
     * @param {number} alpha - The value controlling the interpolation in relation to the two input
     * quaternions. The value is in the range 0 to 1, 0 generating q1, 1 generating q2 and anything
     * in between generating a linear interpolation between the two.
     * @returns {Quat} Self for chaining.
     * @example
     * const q1 = new pc.Quat(-0.11, -0.15, -0.46, 0.87);
     * const q2 = new pc.Quat(-0.21, -0.21, -0.67, 0.68);
     *
     * const result = new pc.Quat();
     * result.lerp(q1, q2, 0);   // Return q1
     * result.lerp(q1, q2, 0.5); // Return the midpoint interpolant
     * result.lerp(q1, q2, 1);   // Return q2
     */
    lerp(lhs, rhs, alpha) {
        const omt = (1 - alpha) * (lhs.dot(rhs) < 0 ? -1 : 1);
        this.x = lhs.x * omt + rhs.x * alpha;
        this.y = lhs.y * omt + rhs.y * alpha;
        this.z = lhs.z * omt + rhs.z * alpha;
        this.w = lhs.w * omt + rhs.w * alpha;
        return this.normalize();
    }

    /**
     * Returns the result of multiplying the specified quaternions together.
     *
     * @param {Quat} rhs - The quaternion used as the second multiplicand of the operation.
     * @returns {Quat} Self for chaining.
     * @example
     * const a = new pc.Quat().setFromEulerAngles(0, 30, 0);
     * const b = new pc.Quat().setFromEulerAngles(0, 60, 0);
     *
     * // a becomes a 90 degree rotation around the Y axis
     * // In other words, a = a * b
     * a.mul(b);
     *
     * console.log("The result of the multiplication is: " + a.toString());
     */
    mul(rhs) {
        const q1x = this.x;
        const q1y = this.y;
        const q1z = this.z;
        const q1w = this.w;

        const q2x = rhs.x;
        const q2y = rhs.y;
        const q2z = rhs.z;
        const q2w = rhs.w;

        this.x = q1w * q2x + q1x * q2w + q1y * q2z - q1z * q2y;
        this.y = q1w * q2y + q1y * q2w + q1z * q2x - q1x * q2z;
        this.z = q1w * q2z + q1z * q2w + q1x * q2y - q1y * q2x;
        this.w = q1w * q2w - q1x * q2x - q1y * q2y - q1z * q2z;

        return this;
    }

    /**
     * Multiplies each element of a quaternion by a number.
     *
     * @param {number} scalar - The number to multiply by.
     * @param {Quat} [src] - The quaternion to scale. If not set, the operation is done in place.
     * @returns {Quat} Self for chaining.
     * @example
     * const q = new pc.Quat(1, 2, 3, 4);
     * q.mulScalar(2);
     * // q is now [2, 4, 6, 8]
     */
    mulScalar(scalar, src = this) {
        this.x = src.x * scalar;
        this.y = src.y * scalar;
        this.z = src.z * scalar;
        this.w = src.w * scalar;
        return this;
    }

    /**
     * Returns the result of multiplying the specified quaternions together.
     *
     * @param {Quat} lhs - The quaternion used as the first multiplicand of the operation.
     * @param {Quat} rhs - The quaternion used as the second multiplicand of the operation.
     * @returns {Quat} Self for chaining.
     * @example
     * const a = new pc.Quat().setFromEulerAngles(0, 30, 0);
     * const b = new pc.Quat().setFromEulerAngles(0, 60, 0);
     * const r = new pc.Quat();
     *
     * // r is set to a 90 degree rotation around the Y axis
     * // In other words, r = a * b
     * r.mul2(a, b);
     */
    mul2(lhs, rhs) {
        const q1x = lhs.x;
        const q1y = lhs.y;
        const q1z = lhs.z;
        const q1w = lhs.w;

        const q2x = rhs.x;
        const q2y = rhs.y;
        const q2z = rhs.z;
        const q2w = rhs.w;

        this.x = q1w * q2x + q1x * q2w + q1y * q2z - q1z * q2y;
        this.y = q1w * q2y + q1y * q2w + q1z * q2x - q1x * q2z;
        this.z = q1w * q2z + q1z * q2w + q1x * q2y - q1y * q2x;
        this.w = q1w * q2w - q1x * q2x - q1y * q2y - q1z * q2z;

        return this;
    }

    /**
     * Normalizes the specified quaternion.
     *
     * @param {Quat} [src] - The quaternion to normalize. If not set, the operation is done in place.
     * @returns {Quat} Self for chaining.
     * @example
     * const v = new pc.Quat(0, 0, 0, 5);
     * v.normalize();
     * // Outputs [0, 0, 0, 1]
     * console.log(v.toString());
     */
    normalize(src = this) {
        let len = src.length();
        if (len === 0) {
            this.x = this.y = this.z = 0;
            this.w = 1;
        } else {
            len = 1 / len;
            this.x = src.x * len;
            this.y = src.y * len;
            this.z = src.z * len;
            this.w = src.w * len;
        }

        return this;
    }

    /**
     * Sets the specified quaternion to the supplied numerical values.
     *
     * @param {number} x - The x component of the quaternion.
     * @param {number} y - The y component of the quaternion.
     * @param {number} z - The z component of the quaternion.
     * @param {number} w - The w component of the quaternion.
     * @returns {Quat} Self for chaining.
     * @example
     * const q = new pc.Quat();
     * q.set(1, 0, 0, 0);
     *
     * // Outputs 1, 0, 0, 0
     * console.log("The result of the quaternion set is: " + q.toString());
     */
    set(x, y, z, w) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;

        return this;
    }

    /**
     * Sets a quaternion from an angular rotation around an axis.
     *
     * @param {Vec3} axis - World space axis around which to rotate. Should be normalized.
     * @param {number} angle - Angle to rotate around the given axis in degrees.
     * @returns {Quat} Self for chaining.
     * @example
     * const q = new pc.Quat();
     * q.setFromAxisAngle(pc.Vec3.UP, 90);
     */
    setFromAxisAngle(axis, angle) {
        angle *= 0.5 * math.DEG_TO_RAD;

        const sa = Math.sin(angle);
        const ca = Math.cos(angle);

        this.x = sa * axis.x;
        this.y = sa * axis.y;
        this.z = sa * axis.z;
        this.w = ca;

        return this;
    }

    /**
     * Sets this quaternion to represent a rotation specified by Euler angles in degrees.
     * The rotation is applied using an **intrinsic XYZ** order: first around the X-axis, then
     * around the newly transformed Y-axis, and finally around the resulting Z-axis.
     *
     * @param {number|Vec3} ex - The angle to rotate around the X-axis in degrees, or a Vec3
     * object containing the X, Y, and Z angles in degrees in its respective components (`ex.x`,
     * `ex.y`, `ex.z`).
     * @param {number} [ey] - The angle to rotate around the Y-axis in degrees. This parameter is
     * only used if `ex` is provided as a number.
     * @param {number} [ez] - The angle to rotate around the Z-axis in degrees. This parameter is
     * only used if `ex` is provided as a number.
     * @returns {Quat} The quaternion itself (this), now representing the orientation from the
     * specified XYZ Euler angles. Allows for method chaining.
     * @example
     * // Create a quaternion from 3 individual Euler angles (interpreted as X, Y, Z order)
     * const q1 = new pc.Quat();
     * q1.setFromEulerAngles(45, 90, 180); // 45 deg around X, then 90 deg around Y', then 180 deg around Z''
     * console.log("From numbers:", q1.toString());
     * @example
     * // Create the same quaternion from a Vec3 containing the angles (X, Y, Z)
     * const anglesVec = new pc.Vec3(45, 90, 180);
     * const q2 = new pc.Quat();
     * q2.setFromEulerAngles(anglesVec);
     * console.log("From Vec3:", q2.toString()); // Should match q1
     */
    setFromEulerAngles(ex, ey, ez) {
        if (ex instanceof Vec3) {
            const vec = ex;
            ex = vec.x;
            ey = vec.y;
            ez = vec.z;
        }

        const halfToRad = 0.5 * math.DEG_TO_RAD;
        ex *= halfToRad;
        ey *= halfToRad;
        ez *= halfToRad;

        const sx = Math.sin(ex);
        const cx = Math.cos(ex);
        const sy = Math.sin(ey);
        const cy = Math.cos(ey);
        const sz = Math.sin(ez);
        const cz = Math.cos(ez);

        this.x = sx * cy * cz - cx * sy * sz;
        this.y = cx * sy * cz + sx * cy * sz;
        this.z = cx * cy * sz - sx * sy * cz;
        this.w = cx * cy * cz + sx * sy * sz;

        return this;
    }

    /**
     * Converts the specified 4x4 matrix to a quaternion. Note that since a quaternion is purely a
     * representation for orientation, only the rotational part of the matrix is used.
     *
     * @param {Mat4} m - The 4x4 matrix to convert.
     * @returns {Quat} Self for chaining.
     * @example
     * // Create a 4x4 rotation matrix of 180 degrees around the y-axis
     * const rot = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 180);
     *
     * // Convert to a quaternion
     * const q = new pc.Quat().setFromMat4(rot);
     */
    setFromMat4(m) {
        const d = m.data;

        let m00 = d[0];
        let m01 = d[1];
        let m02 = d[2];
        let m10 = d[4];
        let m11 = d[5];
        let m12 = d[6];
        let m20 = d[8];
        let m21 = d[9];
        let m22 = d[10];

        // if negative the space is inverted so flip X axis to restore right-handedness
        const det = m00 * (m11 * m22 - m12 * m21) -
                    m01 * (m10 * m22 - m12 * m20) +
                    m02 * (m10 * m21 - m11 * m20);
        if (det < 0) {
            m00 = -m00;
            m01 = -m01;
            m02 = -m02;
        }

        let l;

        // remove scaling from axis vectors
        l = m00 * m00 + m01 * m01 + m02 * m02;
        if (l === 0) return this.set(0, 0, 0, 1);
        l = 1 / Math.sqrt(l);
        m00 *= l;
        m01 *= l;
        m02 *= l;

        l = m10 * m10 + m11 * m11 + m12 * m12;
        if (l === 0) return this.set(0, 0, 0, 1);
        l = 1 / Math.sqrt(l);
        m10 *= l;
        m11 *= l;
        m12 *= l;

        l = m20 * m20 + m21 * m21 + m22 * m22;
        if (l === 0) return this.set(0, 0, 0, 1);
        l = 1 / Math.sqrt(l);
        m20 *= l;
        m21 *= l;
        m22 *= l;

        // https://d3cw3dd2w32x2b.cloudfront.net/wp-content/uploads/2015/01/matrix-to-quat.pdf

        if (m22 < 0) {
            if (m00 > m11) {
                this.set(1 + m00 - m11 - m22, m01 + m10, m20 + m02, m12 - m21);
            } else {
                this.set(m01 + m10, 1 - m00 + m11 - m22, m12 + m21, m20 - m02);
            }
        } else {
            if (m00 < -m11) {
                this.set(m20 + m02, m12 + m21, 1 - m00 - m11 + m22, m01 - m10);
            } else {
                this.set(m12 - m21, m20 - m02, m01 - m10, 1 + m00 + m11 + m22);
            }
        }

        // Instead of scaling by 0.5 / Math.sqrt(t) (to match the original implementation),
        // instead we normalize the result. It costs 3 more adds and muls, but we get
        // a stable result and in some cases normalization is required anyway, see
        // https://github.com/blender/blender/blob/v4.1.1/source/blender/blenlib/intern/math_rotation.c#L368
        return this.mulScalar(1.0 / this.length());
    }

    /**
     * Set the quaternion that represents the shortest rotation from one direction to another.
     *
     * @param {Vec3} from - The direction to rotate from. It should be normalized.
     * @param {Vec3} to - The direction to rotate to. It should be normalized.
     * @returns {Quat} Self for chaining.
     * @example
     * const q = new pc.Quat();
     * const from = new pc.Vec3(0, 0, 1);
     * const to = new pc.Vec3(0, 1, 0);
     * q.setFromDirections(from, to);
     */
    setFromDirections(from, to) {
        const dotProduct = 1 + from.dot(to);

        if (dotProduct < Number.EPSILON) {
            // the vectors point in opposite directions
            // so we need to rotate 180 degrees around an arbitrary orthogonal axis
            if (Math.abs(from.x) > Math.abs(from.y)) {
                this.x = -from.z;
                this.y = 0;
                this.z = from.x;
                this.w = 0;
            } else {
                this.x = 0;
                this.y = -from.z;
                this.z = from.y;
                this.w = 0;
            }
        } else {
            // cross product between the two vectors
            this.x = from.y * to.z - from.z * to.y;
            this.y = from.z * to.x - from.x * to.z;
            this.z = from.x * to.y - from.y * to.x;
            this.w = dotProduct;
        }

        return this.normalize();
    }

    /**
     * Performs a spherical interpolation between two quaternions. The result of the interpolation
     * is written to the quaternion calling the function.
     *
     * @param {Quat} lhs - The quaternion to interpolate from.
     * @param {Quat} rhs - The quaternion to interpolate to.
     * @param {number} alpha - The value controlling the interpolation in relation to the two input
     * quaternions. The value is in the range 0 to 1, 0 generating q1, 1 generating q2 and anything
     * in between generating a spherical interpolation between the two.
     * @returns {Quat} Self for chaining.
     * @example
     * const q1 = new pc.Quat(-0.11, -0.15, -0.46, 0.87);
     * const q2 = new pc.Quat(-0.21, -0.21, -0.67, 0.68);
     *
     * const result = new pc.Quat();
     * result.slerp(q1, q2, 0);   // Return q1
     * result.slerp(q1, q2, 0.5); // Return the midpoint interpolant
     * result.slerp(q1, q2, 1);   // Return q2
     */
    slerp(lhs, rhs, alpha) {
        // Algorithm sourced from:
        // http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/slerp/
        const lx = lhs.x;
        const ly = lhs.y;
        const lz = lhs.z;
        const lw = lhs.w;
        let rx = rhs.x;
        let ry = rhs.y;
        let rz = rhs.z;
        let rw = rhs.w;

        // Calculate angle between them.
        let cosHalfTheta = lw * rw + lx * rx + ly * ry + lz * rz;

        if (cosHalfTheta < 0) {
            rw = -rw;
            rx = -rx;
            ry = -ry;
            rz = -rz;
            cosHalfTheta = -cosHalfTheta;
        }

        // If lhs == rhs or lhs == -rhs then theta == 0 and we can return lhs
        if (Math.abs(cosHalfTheta) >= 1) {
            this.w = lw;
            this.x = lx;
            this.y = ly;
            this.z = lz;
            return this;
        }

        // Calculate temporary values.
        const halfTheta = Math.acos(cosHalfTheta);
        const sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta);

        // If theta = 180 degrees then result is not fully defined
        // we could rotate around any axis normal to qa or qb
        if (Math.abs(sinHalfTheta) < 0.001) {
            this.w = (lw * 0.5 + rw * 0.5);
            this.x = (lx * 0.5 + rx * 0.5);
            this.y = (ly * 0.5 + ry * 0.5);
            this.z = (lz * 0.5 + rz * 0.5);
            return this;
        }

        const ratioA = Math.sin((1 - alpha) * halfTheta) / sinHalfTheta;
        const ratioB = Math.sin(alpha * halfTheta) / sinHalfTheta;

        // Calculate Quaternion.
        this.w = (lw * ratioA + rw * ratioB);
        this.x = (lx * ratioA + rx * ratioB);
        this.y = (ly * ratioA + ry * ratioB);
        this.z = (lz * ratioA + rz * ratioB);
        return this;
    }

    /**
     * Transforms a 3-dimensional vector by the specified quaternion.
     *
     * @param {Vec3} vec - The 3-dimensional vector to be transformed.
     * @param {Vec3} [res] - An optional 3-dimensional vector to receive the result of the transformation.
     * @returns {Vec3} The transformed vector (res if specified, otherwise a new Vec3).
     * @example
     * // Create a 3-dimensional vector
     * const v = new pc.Vec3(1, 2, 3);
     *
     * // Create a quaternion rotation
     * const q = new pc.Quat().setFromEulerAngles(10, 20, 30);
     *
     * const tv = q.transformVector(v);
     */
    transformVector(vec, res = new Vec3()) {
        const x = vec.x, y = vec.y, z = vec.z;
        const qx = this.x, qy = this.y, qz = this.z, qw = this.w;

        // calculate quat * vec
        const ix = qw * x + qy * z - qz * y;
        const iy = qw * y + qz * x - qx * z;
        const iz = qw * z + qx * y - qy * x;
        const iw = -qx * x - qy * y - qz * z;

        // calculate result * inverse quat
        res.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
        res.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
        res.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;

        return res;
    }

    /**
     * Set the values of the quaternion from an array.
     *
     * @param {number[]|ArrayBufferView} arr - The array to set the quaternion values from.
     * @param {number} [offset] - The zero-based index at which to start copying elements from the
     * array. Default is 0.
     * @returns {Quat} Self for chaining.
     * @example
     * const q = new pc.Quat();
     * q.fromArray([20, 10, 5, 0]);
     * // q is set to [20, 10, 5, 0]
     */
    fromArray(arr, offset = 0) {
        this.x = arr[offset] ?? this.x;
        this.y = arr[offset + 1] ?? this.y;
        this.z = arr[offset + 2] ?? this.z;
        this.w = arr[offset + 3] ?? this.w;

        return this;
    }

    /**
     * Converts the quaternion to string form.
     *
     * @returns {string} The quaternion in string form.
     * @example
     * const q = new pc.Quat(0, 0, 0, 1);
     * // Outputs [0, 0, 0, 1]
     * console.log(q.toString());
     */
    toString() {
        return `[${this.x}, ${this.y}, ${this.z}, ${this.w}]`;
    }

    /**
     * @overload
     * @param {number[]} [arr] - The array to populate with the quaternion's number
     * components. If not specified, a new array is created.
     * @param {number} [offset] - The zero-based index at which to start copying elements to the
     * array. Default is 0.
     * @returns {number[]} The quaternion as an array.
     */
    /**
     * @overload
     * @param {ArrayBufferView} arr - The array to populate with the quaternion's number
     * components. If not specified, a new array is created.
     * @param {number} [offset] - The zero-based index at which to start copying elements to the
     * array. Default is 0.
     * @returns {ArrayBufferView} The quaternion as an array.
     */
    /**
     * Converts the quaternion to an array.
     *
     * @param {number[]|ArrayBufferView} [arr] - The array to populate with the quaternion's number
     * components. If not specified, a new array is created.
     * @param {number} [offset] - The zero-based index at which to start copying elements to the
     * array. Default is 0.
     * @returns {number[]|ArrayBufferView} The quaternion as an array.
     * @example
     * const q = new pc.Quat(20, 10, 5, 1);
     * // Outputs [20, 10, 5, 1]
     * console.log(q.toArray());
     */
    toArray(arr = [], offset = 0) {
        arr[offset] = this.x;
        arr[offset + 1] = this.y;
        arr[offset + 2] = this.z;
        arr[offset + 3] = this.w;

        return arr;
    }

    /**
     * A constant quaternion set to [0, 0, 0, 1] (the identity). Represents no rotation.
     *
     * @type {Quat}
     * @readonly
     */
    static IDENTITY = Object.freeze(new Quat(0, 0, 0, 1));

    /**
     * A constant quaternion set to [0, 0, 0, 0].
     *
     * @type {Quat}
     * @readonly
     */
    static ZERO = Object.freeze(new Quat(0, 0, 0, 0));
}

export { Quat };

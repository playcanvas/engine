import { math } from './math.js';
import { Vec3 } from './vec3.js';

/**
 * A quaternion.
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
     * Create a new Quat instance.
     *
     * @param {number|number[]} [x] - The quaternion's x component. Defaults to 0. If x is an array
     * of length 4, the array will be used to populate all components.
     * @param {number} [y] - The quaternion's y component. Defaults to 0.
     * @param {number} [z] - The quaternion's z component. Defaults to 0.
     * @param {number} [w] - The quaternion's w component. Defaults to 1.
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
     * @returns {this} A quaternion containing the result of the cloning.
     * @example
     * const q = new pc.Quat(-0.11, -0.15, -0.46, 0.87);
     * const qclone = q.clone();
     *
     * console.log("The result of the cloning is: " + q.toString());
     */
    clone() {
        /** @type {this} */
        const cstr = this.constructor;
        return new cstr(this.x, this.y, this.z, this.w);
    }

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
     * dst.copy(src, src);
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
     * Converts the supplied quaternion to Euler angles.
     *
     * @param {Vec3} [eulers] - The 3-dimensional vector to receive the Euler angles.
     * @returns {Vec3} The 3-dimensional vector holding the Euler angles that
     * correspond to the supplied quaternion.
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
     * @returns {number} The magnitude of the specified quaternion.
     * @example
     * const q = new pc.Quat(3, 4, 0);
     * const lenSq = q.lengthSq();
     * // Outputs 25
     * console.log("The length squared of the quaternion is: " + lenSq);
     */
    lengthSq() {
        return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
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
     *
     * console.log("The result of the multiplication is: " + r.toString());
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
     * Returns the specified quaternion converted in place to a unit quaternion.
     *
     * @param {Quat} [src] - The quaternion to normalize. If not set, the operation is done in place.
     * @returns {Quat} The result of the normalization.
     * @example
     * const v = new pc.Quat(0, 0, 0, 5);
     *
     * v.normalize();
     *
     * // Outputs 0, 0, 0, 1
     * console.log("The result of the vector normalization is: " + v.toString());
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
     * console.log("The result of the vector set is: " + q.toString());
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
     * @param {Vec3} axis - World space axis around which to rotate.
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
     * Sets a quaternion from Euler angles specified in XYZ order.
     *
     * @param {number|Vec3} ex - Angle to rotate around X axis in degrees. If ex is a Vec3, the
     * three angles will be read from it instead.
     * @param {number} [ey] - Angle to rotate around Y axis in degrees.
     * @param {number} [ez] - Angle to rotate around Z axis in degrees.
     * @returns {Quat} Self for chaining.
     * @example
     * // Create a quaternion from 3 euler angles
     * const q = new pc.Quat();
     * q.setFromEulerAngles(45, 90, 180);
     *
     * // Create the same quaternion from a vector containing the same 3 euler angles
     * const v = new pc.Vec3(45, 90, 180);
     * const r = new pc.Quat();
     * r.setFromEulerAngles(v);
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
     * representation for orientation, only the translational part of the matrix is lost.
     *
     * @param {import('./mat4.js').Mat4} m - The 4x4 matrix to convert.
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
     *
     * {@link https://www.xarg.org/proof/quaternion-from-two-vectors/ Proof of correctness}
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
     * const result;
     * result = new pc.Quat().slerp(q1, q2, 0);   // Return q1
     * result = new pc.Quat().slerp(q1, q2, 0.5); // Return the midpoint interpolant
     * result = new pc.Quat().slerp(q1, q2, 1);   // Return q2
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
     * @returns {Vec3} The input vector v transformed by the current instance.
     * @example
     * // Create a 3-dimensional vector
     * const v = new pc.Vec3(1, 2, 3);
     *
     * // Create a 4x4 rotation matrix
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
     * Converts the quaternion to string form.
     *
     * @returns {string} The quaternion in string form.
     * @example
     * const v = new pc.Quat(0, 0, 0, 1);
     * // Outputs [0, 0, 0, 1]
     * console.log(v.toString());
     */
    toString() {
        return `[${this.x}, ${this.y}, ${this.z}, ${this.w}]`;
    }

    /**
     * A constant quaternion set to [0, 0, 0, 1] (the identity).
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

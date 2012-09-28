/**
 * @namespace
 * @name pc.math.quat
 */
pc.math.quat = function () {

    // Public functions
    return {
        /**
         * @function
         * @name pc.math.quat.clone
         * @description Returns an identical copy of the specified quaternion.
         * @param {Array} v0 A quaternion that will to be cloned and returned.
         * @returns {Array} A quaternion containing the result of the cloning.
         * @example
         * var q = pc.math.quat.create(-0.11,-0.15,-0.46,0.87);
         * var qclone = pc.math.quat.clone(q);
         * console.log("The result of the cloning is: " +
         *                  qclone[0] + ", " + qclone[1] + ", " +
         *                  qclone[2] + ", " + qclone[3]);
         * @author Will Eastcott
         */
        clone: function (q) {
            return new Float32Array(q);
        },

        conjugate: function (q, r) {
            if (r === undefined) {
                r = pc.math.quat.create();
            }

            r[0] = -q[0];
            r[1] = -q[1];
            r[2] = -q[2];
            r[3] = q[3];

            return r;
        },

        /**
         * @function
         * @name pc.math.quat.copy
         * @description Copies the contents of a source quaternion to a destination quaternion.
         * @param {Array} src The quaternion to be copied.
         * @param {Array} dst The quaternion that will receive a copy of the source vector.
         * @example
         * var src = pc.math.quat.create(0, 0, 0, 1);
         * var dst = pc.math.quat.create();
         * pc.math.quat.copy(src, dst);
         * var same = ((src[0] === dst[0]) && (src[1] === dst[1]) && (src[2] === dst[2]) && (src[3] === dst[3]));
         * console.log("The two quaternions are " + (same ? "equal" : "different"));
         * @author Will Eastcott
         */
        copy: function (src, dst) {
            dst[0] = src[0];
            dst[1] = src[1];
            dst[2] = src[2];
            dst[3] = src[3];
        },

        /**
         * @function
         * @name pc.math.quat.create
         * @description Creates a new quaternion set to the specified values.
         * @param {number} x The value of the x component of the quaternion.
         * @param {number} y The value of the y component of the quaternion.
         * @param {number} z The value of the x component of the quaternion.
         * @param {number} w The value of the w component of the quaternion.
         * @returns {Array} A new quaternion.
         * @example
         * // Create a quaternion with all components set to 'undefined'
         * var q1 = pc.math.quat.create();
         * // Create a quaternion set to valid values
         * var q2 = pc.math.quat.create(-0.11,-0.15,-0.46,0.87);
         * @author Will Eastcott
         */
        create: function (x, y, z, w) {
            var q = new Float32Array(4);
            q[0] = x;
            q[1] = y;
            q[2] = z;
            q[3] = w;
            return q;
        },

        multiply: function (q1, q2, qr) {
            var xx = q1[3] * q2[0] +
                     q1[0] * q2[3] +
                     q1[1] * q2[2] -
                     q1[2] * q2[1];

            var yy = q1[3] * q2[1] +
                     q1[1] * q2[3] +
                     q1[2] * q2[0] -
                     q1[0] * q2[2];

            var zz = q1[3] * q2[2] +
                     q1[2] * q2[3] +
                     q1[0] * q2[1] -
                     q1[1] * q2[0];

            var ww = q1[3] * q2[3] -
                     q1[0] * q2[0] -
                     q1[1] * q2[1] -
                     q1[2] * q2[2];

            qr[0] = xx;
            qr[1] = yy;
            qr[2] = zz;
            qr[3] = ww;
        },

        transformVector: function (q, v, r) {
            if (r === undefined) {
                r = pc.math.vec3.create();
            }

            var vecQuat = pc.math.quat.create(v[0], v[1], v[2], 0);         
            var resQuat = pc.math.quat.create();

            var conj = pc.math.quat.conjugate(q);
            pc.math.quat.multiply(vecQuat, conj, resQuat);
            pc.math.quat.multiply(q, resQuat, resQuat);
         
            r[0] = resQuat[0];
            r[1] = resQuat[1];
            r[2] = resQuat[2];

            return r;
        },

        setFromEulers: function (q, ex, ey, ez) {
            ex = ex * Math.PI / 180.0;
            ey = ey * Math.PI / 180.0;
            ez = ez * Math.PI / 180.0;

            var sx = Math.sin(ex * -0.5);
            var cx = Math.cos(ex * -0.5);
            var sy = Math.sin(ey * -0.5);
            var cy = Math.cos(ey * -0.5);
            var sz = Math.sin(ez * -0.5);
            var cz = Math.cos(ez * -0.5);

            /* qx * qy */
            var tx = sx * cy;
            var ty = cx * sy;
            var tz = sx * sy;
            var tw = cx * cy;

            /* qt * qz */
            q[0] = tx * cz + ty * sz;
            q[1] = ty * cz - tx * sz;
            q[2] = tw * sz + tz * cz;
            q[3] = tw * cz - tz * sz;
        },

        toMat3: function (q, r) {
            if (r === undefined) {
                r = pc.math.mat4.create();
            }
            var norm = q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3];
            var s = (norm == 0.0) ? 0.0 : (2.0 / norm);

            var xs = q[0] * s;
            var ys = q[1] * s;
            var zs = q[2] * s;

            var wx = q[3] * xs;
            var wy = q[3] * ys;
            var wz = q[3] * zs;

            var xx = q[0] * xs;
            var yy = q[1] * ys;
            var zz = q[2] * zs;

            var yz = q[1] * zs; //crossx
            var xz = q[2] * xs; //crossy
            var xy = q[0] * ys; //crossz

            r[0] = 1.0 - (yy + zz);
            r[1] = xy - wz;
            r[2] = xz + wy;
            
            r[3] = xy + wz;
            r[4] = 1.0 - (xx + zz);
            r[5] = yz - wx;

            r[6] = xz - wy;
            r[7] = yz + wx;
            r[8] = 1.0 - (xx + yy);
            
            return r;
        },

        /**
         * @function
         * @name pc.math.quat.toMat4
         * @description Converts the specified quaternion to a 4x4 matrix. Note that since
         * a quaternion is purely a representation for orientation, only the rotational part
         * of the matrix is set.
         * @param {Array} q The quaternion to convert.
         * @param {Array} r An optional 4x4 matrix that will receive the result of the conversion. If
         * this parameter is omitted, the function will create a new 4x4 matrix internally and return it.
         * @returns {Array} A 4x4 matrix corresponding to the specified quaternion. If the r parameter is
         * specified, the return value will be equal to r. Otherwise, it will be a newly created matrix.
         * @example
         * var q = pc.math.quat.create(-0.11,-0.15,-0.46,0.87);
         *
         * // Allow toMat4 to create a new matrix internally
         * var m = pc.math.quat.toMat4(q);
         *
         * // Supply a 4x4 matrix to receive the result of the conversion
         * var m = pc.math.mat4.create();
         * pc.math.quat.toMat4(q, m);
         * @author Will Eastcott
         */
        toMat4: function (q, r) {
            if (r === undefined) {
                r = pc.math.mat4.create();
            }
            var norm = q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3];
            var s = (norm == 0.0) ? 0.0 : (2.0 / norm);

            var xs = q[0] * s;
            var ys = q[1] * s;
            var zs = q[2] * s;

            var wx = q[3] * xs;
            var wy = q[3] * ys;
            var wz = q[3] * zs;

            var xx = q[0] * xs;
            var yy = q[1] * ys;
            var zz = q[2] * zs;

            var yz = q[1] * zs; //crossx
            var xz = q[2] * xs; //crossy
            var xy = q[0] * ys; //crossz

            r[0] = 1.0 - (yy + zz);
            r[1] = xy - wz;
            r[2] = xz + wy;
            
            r[4] = xy + wz;
            r[5] = 1.0 - (xx + zz);
            r[6] = yz - wx;

            r[8] = xz - wy;
            r[9] = yz + wx;
            r[10] = 1.0 - (xx + yy);

            r[12] = r[13] = r[14] = r[3] = r[7] = r[11] = 0.0;
            r[15] = 1.0;
            
            return r;
        },

        /**
         * @function
         * @name pc.math.quat.slerp
         * @description Performs a spherical interpolation between two quaternions.
         * @param {Array} q1 The quaternion to interpolate from.
         * @param {Array} q2 The quaternion to interpolate to.
         * @param {number} alpha The value controlling the interpolation in relation to the two input
         * quaternions. The value is in the range 0 to 1, 0 generating q1, 1 generating q2 and anything
         * in between generating a spherical interpolation between the two.
         * @param {Array} r An optional quaternion that will receive the result of the interpolation. If
         * this parameter is omitted, the function will create a new quaternion internally and return it.
         * @returns {Array} A quaterion holding the result of the interpolation. If the r parameter is
         * specified, the return value will be equal to r. Otherwise, it will be a newly created quaternion.
         * @example
         * var q1 = pc.math.quat.create(-0.11,-0.15,-0.46,0.87);
         * var q2 = pc.math.quat.create(-0.21,-0.21,-0.67,0.68);
         *
         * var result;
         * result = pc.math.quat.slerp(q1, q2, 0); // Return q1
         * result = pc.math.quat.slerp(q1, q2, 0.5); // Return the midpoint interpolant 
         * result = pc.math.quat.slerp(q1, q2, 1); // Return q2
         *
         * // Supply a quaternion to receive the result of the interpolation
         * result = pc.math.quat.create();
         * pc.math.quat.slerp(q1, q2, 0.5, result);
         * @author Will Eastcott
         */
        slerp: function (q1, q2, alpha, r) {
            if (r === undefined) {
                r = pc.math.quat.create();
            }
            var cos_omega = q1[0] * q2[0] + q1[1] * q2[1] + q1[2] * q2[2] + q1[3] * q2[3];

            // If B is on opposite hemisphere from A, use -B instead
            var bflip = (cos_omega < 0.0);
            if (bflip) {
                cos_omega = -cos_omega;
            }

            // Complementary interpolation parameter
            var beta = 1.0 - alpha;     

            if (cos_omega >= 1.0) {
                r[0] = beta * q1[0] + alpha * q2[0];
                r[1] = beta * q1[1] + alpha * q2[1];
                r[2] = beta * q1[2] + alpha * q2[2];
                r[3] = beta * q1[3] + alpha * q2[3];
            } else {
                var omega = Math.acos(cos_omega);
                var one_over_sin_omega = 1.0 / Math.sin(omega);

                beta  = Math.sin(omega*beta)  * one_over_sin_omega;
                alpha = Math.sin(omega*alpha) * one_over_sin_omega;

                if (bflip)
                    alpha = -alpha;

                r[0] = beta * q1[0] + alpha * q2[0];
                r[1] = beta * q1[1] + alpha * q2[1];
                r[2] = beta * q1[2] + alpha * q2[2];
                r[3] = beta * q1[3] + alpha * q2[3];
            }
            return r;
        }
    }
} ();
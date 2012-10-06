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
        create: function () {
            var q = new Float32Array(4);

            // x, y, z are imaginary components
            // w is the real component
            if (arguments.length === 0) {
                q[0] = 0;
                q[1] = 0;
                q[2] = 0;
                q[3] = 1;
            } else if (arguments.length === 4) {
                q[0] = arguments[0];
                q[1] = arguments[1];
                q[2] = arguments[2];
                q[3] = arguments[3];
            }
            return q;
        },

        invert: function(q, r) {
            var qx = q[0];
            var qy = q[1];
            var qz = q[2];
            var qw = q[3];

            var dot = qx*qx + qy*qy + qz*qz + qw*qw;
            var invDot = dot ? 1.0/dot : 0;

            if (!r || q === r) {
                q[0] *= -invDot;
                q[1] *= -invDot;
                q[2] *= -invDot;
                q[3] *= invDot;
                return q;
            }
            r[0] = -q[0]*invDot;
            r[1] = -q[1]*invDot;
            r[2] = -q[2]*invDot;
            r[3] = q[3]*invDot;
            return r;
        },

        transformVector: function (q, v, r) {
            if (r === undefined) {
                r = pc.math.vec3.create();
            }

            var x = v[0], y = v[1], z = v[2];
            var qx = q[0], qy = q[1], qz = q[2], qw = q[3];

            // calculate quat * vec
            var ix = qw * x + qy * z - qz * y;
            var iy = qw * y + qz * x - qx * z;
            var iz = qw * z + qx * y - qy * x;
            var iw = -qx * x - qy * y - qz * z;

            // calculate result * inverse quat
            r[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
            r[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
            r[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;

            return r;
        },

        multiply: function (q1, q2, r) {

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

            r[0] = xx;
            r[1] = yy;
            r[2] = zz;
            r[3] = ww;
        },

        setFromAxisAngle: function (q, v, angle) {
            var halfAngle = 0.5 * angle * (Math.PI / 180.0);

            var sa = Math.sin(halfAngle);
            var ca = Math.cos(halfAngle);

            q[0] = sa * v[0];
            q[1] = sa * v[1];
            q[2] = sa * v[2];
            q[3] = ca;
        },

        setFromEulers: function (q, ex, ey, ez) {
/*
            ex = 0.5 * ex * Math.PI / 180.0;
            ey = 0.5 * ey * Math.PI / 180.0;
            ez = 0.5 * ez * Math.PI / 180.0;

            var sx = Math.sin(ex);
            var cx = Math.cos(ex);
            var sy = Math.sin(ey);
            var cy = Math.cos(ey);
            var sz = Math.sin(ez);
            var cz = Math.cos(ez);

            q[0] = sx * cy * cz + cx * sy * sz;
            q[1] = cx * sy * cz - sx * cy * sz;
            q[2] = cx * cy * sz + sx * sy * cz;
            q[3] = cx * cy * cz - sx * sy * sz;
*/

/*
            var rx = pc.math.mat4.makeRotate(ex*(Math.PI/180.0), [1, 0, 0]);
            var ry = pc.math.mat4.makeRotate(ey*(Math.PI/180.0), [0, 1, 0]);
            var rz = pc.math.mat4.makeRotate(ez*(Math.PI/180.0), [0, 0, 1]);
            var r = pc.math.mat4.multiply(rz, ry);
            pc.math.mat4.multiply(r, rx, r);
            pc.math.mat4.toQuat(r, q);
*/
            var qx = pc.math.quat.create();
            var qy = pc.math.quat.create();
            var qz = pc.math.quat.create();
            pc.math.quat.setFromAxisAngle(qx, [1, 0, 0], ex);
            pc.math.quat.setFromAxisAngle(qy, [0, 1, 0], ey);
            pc.math.quat.setFromAxisAngle(qz, [0, 0, 1], ez);
            pc.math.quat.multiply(qz, qy, q);
            pc.math.quat.multiply(q, qx, q);
        },

        fromEulerXYZ: function (q, r) {
            if (r === undefined) {
                r = pc.math.vec3.create();
            }

            r[0] = Math.asin(2 * ( q[0] * q[2] - q[3] * q[1] ) );
            r[1] = Math.atan2(2 * q[0] * q[3] + 2 * q[1] * q[3], 1 - 2 * (sqz  + sqw));
            r[2] = Math.atan2(2 * q[0] * q[1] + 2 * q[2] * q[3], 1 - 2 * (sqy + sqz));

            return r;
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

            // http://www.cs.ucr.edu/~vbz/resources/quatut.pdf
            var Nq = q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3];
            var s = (Nq > 0.0) ? (2.0 / Nq) : 0.0 ;

            var xs = q[0] * s;
            var ys = q[1] * s;
            var zs = q[2] * s;

            var wx = q[3] * xs;
            var wy = q[3] * ys;
            var wz = q[3] * zs;

            var xx = q[0] * xs;
            var yy = q[1] * ys;
            var zz = q[2] * zs;

            var yz = q[1] * zs;
            var xz = q[2] * xs;
            var xy = q[0] * ys;

            r[0] = 1.0 - (yy + zz);
            r[1] = xy + wz;
            r[2] = xz - wy;
            r[3] = 0.0;
            r[4] = xy - wz;
            r[5] = 1.0 - (xx + zz);
            r[6] = yz + wx;
            r[7] = 0.0;
            r[8] = xz + wy;
            r[9] = yz - wx;
            r[10] = 1.0 - (xx + yy);
            r[11] = 0.0;
            r[12] = 0.0;
            r[13] = 0.0;
            r[14] = 0.0;
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
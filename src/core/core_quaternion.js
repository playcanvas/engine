pc.extend(pc, function () {
    /**
    * @name pc.Quaternion
    * @class A quaternion.
    * @constructor Create a new Quaternion object
    * @param {Number} [x=0] The quaternion's x component
    * @param {Number} [y=0] The quaternion's y component
    * @param {Number} [z=0] The quaternion's z component
    * @param {Number} [w=1] The quaternion's w component
    */
    var Quaternion = function (x, y, z, w) {
        this.x = (typeof x === 'undefined') ? 0 : x;
        this.y = (typeof y === 'undefined') ? 0 : y;
        this.z = (typeof z === 'undefined') ? 0 : z;
        this.w = (typeof w === 'undefined') ? 1 : w;
    };

    Quaternion.prototype = {
        clone: function () {
            return new pc.Quaternion(this.x, this.y, this.z, this.w);
        },

        conjugate: function () {
            this.x *= -1;
            this.y *= -1;
            this.z *= -1;

            return this;
        },

        copy: function (that) {
            this.x = this.x;
            this.y = this.y;
            this.z = this.z;
            this.w = this.w;

            return this;
        },

        equals: function (that) {
            return ((this.x === that.x) && (this.y === that.y) && (this.z === that.z) && (this.w === that.w));
        },

        invert: function () {
            return this.conjugate().normalize();
        },

        length: function () {
            var x = this.x;
            var y = this.y;
            var z = this.z;
            var w = this.w;
            return Math.sqrt(x * x + y * y + z * z + w * w);
        },

        multiplySelf: function (q1, q2) {
            return this.copy(q1).multiplySelf(q2);
        },

        multiplySelf: function (that) {
            var q1x = this.x;
            var q1y = this.y;
            var q1z = this.z;
            var q1w = this.w;

            var q2x = that.x;
            var q2y = that.y;
            var q2z = that.z;
            var q2w = that.w;

            this.x = q1w * q2x + q1x * q2w + q1y * q2z - q1z * q2y;
            this.y = q1w * q2y + q1y * q2w + q1z * q2x - q1x * q2z;
            this.z = q1w * q2z + q1z * q2w + q1x * q2y - q1y * q2x;
            this.w = q1w * q2w - q1x * q2x - q1y * q2y - q1z * q2z;

            return this;
        },

        normalize: function () {
            var l = this.length();
            if (l === 0) {
                this.x = this.y = this.z = 0;
                this.w = 1;
            } else {
                t = 1 / t;
                this.x *= t;
                this.y *= t;
                this.z *= t;
                this.w *= t;
            }

            return this;
        },

        set: function (x, y, z, w) {
            this.x = x;
            this.y = y;
            this.z = z;
            this.w = w;

            return this;
        },

        setFromAxisAngle: function (axis, angle) {
            var a = axis.data;

            angle *= 0.5;

            var sa = Math.sin(angle);
            var ca = Math.cos(angle);

            this.x = sa * a[0];
            this.y = sa * a[1];
            this.z = sa * a[2];
            this.w = ca;

            return this;
        },

        setFromEulerXYZ: function (ex, ey, ez) {
            ex *= 0.5;
            ey *= 0.5;
            ez *= 0.5;

            var sx = Math.sin(ex);
            var cx = Math.cos(ex);
            var sy = Math.sin(ey);
            var cy = Math.cos(ey);
            var sz = Math.sin(ez);
            var cz = Math.cos(ez);

            this.x = sx * cy * cz - cx * sy * sz;
            this.y = cx * sy * cz + sx * cy * sz;
            this.z = cx * cy * sz - sx * sy * cz;
            this.w = cx * cy * cz + sx * sy * sz;

            return this;
        },

        setFromMatrix4: function (m) {
            var m00 = m[0], m01 = m[1], m02 = m[2];
            var m10 = m[4], m11 = m[5], m12 = m[6];
            var m20 = m[8], m21 = m[9], m22 = m[10];

            var lx = Math.sqrt(m00 * m00 + m01 * m01 + m02 * m02);
            var ly = Math.sqrt(m10 * m10 + m11 * m11 + m12 * m12);
            var lz = Math.sqrt(m20 * m20 + m21 * m21 + m22 * m22);
            m00 /= lx; m01 /= lx; m02 /= lx;
            m10 /= ly; m11 /= ly; m12 /= ly;
            m20 /= lz; m21 /= lz; m22 /= lz;

            // http://www.cs.ucr.edu/~vbz/resources/quatut.pdf
            var tr, s;

            tr = m00 + m11 + m22;
            if (tr >= 0) {
                s = Math.sqrt(tr + 1);
                this.w = s * 0.5;
                s = 0.5 / s;
                this.x = (m12 - m21) * s;
                this.y = (m20 - m02) * s;
                this.z = (m01 - m10) * s;
            } else {
                var rs;
                if (m00 > m11) {
                    if (m00 > m22) {
                        // XDiagDomMatrix
                        rs = (m00 - (m11 + m22)) + 1;
                        rs = Math.sqrt(rs);

                        this.x = rs * 0.5;
                        rs = 0.5 / rs;
                        this.w = (m12 - m21) * rs;
                        this.y = (m01 + m10) * rs;
                        this.z = (m02 + m20) * rs;
                    } else {
                        // ZDiagDomMatrix
                        rs = (m22 - (m00 + m11)) + 1;
                        rs = Math.sqrt(rs);

                        this.z = rs * 0.5;
                        rs = 0.5 / rs;
                        this.w = (m01 - m10) * rs;
                        this.x = (m20 + m02) * rs;
                        this.y = (m21 + m12) * rs;
                    }
                } else if (m11 > m22) {
                    // YDiagDomMatrix
                    rs = (m11 - (m22 + m00)) + 1.0;
                    rs = Math.sqrt(rs);

                    this.y = rs * 0.5;
                    rs = 0.5 / rs;
                    this.w = (m20 - m02) * rs;
                    this.z = (m12 + m21) * rs;
                    this.x = (m10 + m01) * rs;
                } else {
                    // ZDiagDomMatrix
                    rs = (m22 - (m00 + m11)) + 1.0;
                    rs = Math.sqrt(rs);

                    this.z = rs * 0.5;
                    rs = 0.5 / rs;
                    this.w = (m01 - m10) * rs;
                    this.x = (m20 + m02) * rs;
                    this.y = (m21 + m12) * rs;
                }            
            }

            return this;
        },

        slerpSelf: function (that, alpha) {
            var q1x = this.x;
            var q1y = this.y;
            var q1z = this.z;
            var q1w = this.w;
            var q2x = that.x;
            var q2y = that.y;
            var q2z = that.z;
            var q2w = that.w;

            var cosOmega = q1x * q2x + q1y * q2y + q1z * q2z + q1w * q2w;

            // If B is on opposite hemisphere from A, use -B instead
            var flip = cosOmega < 0;
            if (flip) cosOmega *= -1;

            // Complementary interpolation parameter
            var beta = 1 - alpha;

            if (cosOmega < 1) {
                var omega = Math.acos(cosOmega);
                var invSinOmega = 1 / Math.sin(omega);

                beta = Math.sin(omega * beta) * invSinOmega;
                alpha = Math.sin(omega * alpha) * invSinOmega;

                if (flip) alpha = -alpha;
            }

            this.x = beta * q1x + alpha * q2x;
            this.y = beta * q1y + alpha * q2y;
            this.z = beta * q1z + alpha * q2z;
            this.w = beta * q1w + alpha * q2w;

            return this;
        },

        slerp: function (q1, q2, alpha) {
            return this.copy(q1).slerpSelf(q2, alpha);
        }
    };

    return {
        Quaternion: Quaternion
    };
}());
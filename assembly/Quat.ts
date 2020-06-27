import {Vec3} from "./Vec3";
import {Mat4} from "./Mat4";
import {pc_math} from "./Math"

export class Quat {
	x: f32;
	y: f32;
	z: f32;
	w: f32;

	constructor(x: f32, y: f32, z: f32, w: f32) {
		this.x = x;
		this.y = y;
		this.z = z;
		this.w = w;
	}

	clone(): Quat {
		return new Quat(this.x, this.y, this.z, this.w);
	}

	conjugate(): Quat {
		this.x *= -1;
		this.y *= -1;
		this.z *= -1;
		return this;
	}

	copy(rhs: Quat): Quat {
		this.x = rhs.x;
		this.y = rhs.y;
		this.z = rhs.z;
		this.w = rhs.w;
		return this;
	}

	equals(rhs: Quat): boolean {
		return ((this.x === rhs.x) && (this.y === rhs.y) && (this.z === rhs.z) && (this.w === rhs.w));
	}

	getAxisAngle(axis: Vec3): f32 {
		var rad = Mathf.acos(this.w) * 2;
		var s = Mathf.sin(rad / 2);
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
		return rad * pc_math.RAD_TO_DEG;
	}

	getEulerAngles(eulers: Vec3): Vec3 {
		var x: f32;
		var y: f32;
		var z: f32;

		var qx = this.x;
		var qy = this.y;
		var qz = this.z;
		var qw = this.w;

		var a2: f32 = 2.0 * (qw * qy - qx * qz);
		if (a2 <= -0.99999) {
			x = 2 * Mathf.atan2(qx, qw);
			y = -Mathf.PI / 2;
			z = 0;
		} else if (a2 >= 0.99999) {
			x = 2 * Mathf.atan2(qx, qw);
			y = Mathf.PI / 2;
			z = 0;
		} else {
			x = Mathf.atan2(2 * (qw * qx + qy * qz), 1 - 2 * (qx * qx + qy * qy));
			y = Mathf.asin(a2);
			z = Mathf.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz));
		}

		return eulers.set(x, y, z).scale(pc_math.RAD_TO_DEG);
	}

	invert(): Quat {
		return this.conjugate().normalize();
	}

	length(): f32 {
		return Mathf.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
	}

	lengthSq(): f32 {
		return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
	}

	mul(rhs: Quat): Quat {
		var q1x = this.x;
		var q1y = this.y;
		var q1z = this.z;
		var q1w = this.w;

		var q2x = rhs.x;
		var q2y = rhs.y;
		var q2z = rhs.z;
		var q2w = rhs.w;

		this.x = q1w * q2x + q1x * q2w + q1y * q2z - q1z * q2y;
		this.y = q1w * q2y + q1y * q2w + q1z * q2x - q1x * q2z;
		this.z = q1w * q2z + q1z * q2w + q1x * q2y - q1y * q2x;
		this.w = q1w * q2w - q1x * q2x - q1y * q2y - q1z * q2z;

		return this;
	}

	mul2(lhs: Quat, rhs: Quat): Quat {
		var q1x = lhs.x;
		var q1y = lhs.y;
		var q1z = lhs.z;
		var q1w = lhs.w;

		var q2x = rhs.x;
		var q2y = rhs.y;
		var q2z = rhs.z;
		var q2w = rhs.w;

		this.x = q1w * q2x + q1x * q2w + q1y * q2z - q1z * q2y;
		this.y = q1w * q2y + q1y * q2w + q1z * q2x - q1x * q2z;
		this.z = q1w * q2z + q1z * q2w + q1x * q2y - q1y * q2x;
		this.w = q1w * q2w - q1x * q2x - q1y * q2y - q1z * q2z;

		return this;
	}

	normalize(): Quat {
		var len = this.length();
		if (len === 0) {
			this.x = this.y = this.z = 0;
			this.w = 1;
		} else {
			len = 1 / len;
			this.x *= len;
			this.y *= len;
			this.z *= len;
			this.w *= len;
		}
		return this;
	}

	set(x: f32, y: f32, z: f32, w: f32): Quat {
		this.x = x;
		this.y = y;
		this.z = z;
		this.w = w;
		return this;
	}

	setFromAxisAngle(axis: Vec3, angle: f32): Quat {
		angle *= 0.5 * pc_math.DEG_TO_RAD;

		var sa = Mathf.sin(angle);
		var ca = Mathf.cos(angle);

		this.x = sa * axis.x;
		this.y = sa * axis.y;
		this.z = sa * axis.z;
		this.w = ca;

		return this;
	}

	setFromEulerAngles(ex: f32, ey: f32, ez: f32): Quat {
		var halfToRad: f32 = 0.5 * pc_math.DEG_TO_RAD;
		ex *= halfToRad;
		ey *= halfToRad;
		ez *= halfToRad;

		var sx = Mathf.sin(ex);
		var cx = Mathf.cos(ex);
		var sy = Mathf.sin(ey);
		var cy = Mathf.cos(ey);
		var sz = Mathf.sin(ez);
		var cz = Mathf.cos(ez);

		this.x = sx * cy * cz - cx * sy * sz;
		this.y = cx * sy * cz + sx * cy * sz;
		this.z = cx * cy * sz - sx * sy * cz;
		this.w = cx * cy * cz + sx * sy * sz;

		return this;
	}

	setFromMat4(m_: Mat4): Quat {
		var s: f32;
		var rs: f32;
		
		// Cache matrix values for super-speed (comment from original JS code lol)
		var m00 = m_.m0;
		var m01 = m_.m1;
		var m02 = m_.m2;
		var m10 = m_.m4;
		var m11 = m_.m5;
		var m12 = m_.m6;
		var m20 = m_.m8;
		var m21 = m_.m9;
		var m22 = m_.m10;

		// Remove the scale from the matrix
		var lx: f32 = 1.0 / Mathf.sqrt(m00 * m00 + m01 * m01 + m02 * m02);
		var ly: f32 = 1.0 / Mathf.sqrt(m10 * m10 + m11 * m11 + m12 * m12);
		var lz: f32 = 1.0 / Mathf.sqrt(m20 * m20 + m21 * m21 + m22 * m22);

		m00 *= lx;
		m01 *= lx;
		m02 *= lx;
		m10 *= ly;
		m11 *= ly;
		m12 *= ly;
		m20 *= lz;
		m21 *= lz;
		m22 *= lz;

		// http://www.cs.ucr.edu/~vbz/resources/quatut.pdf

		var tr = m00 + m11 + m22;
		if (tr >= 0.0) {
			s = Mathf.sqrt(tr + 1.0);
			this.w = s * 0.5;
			s = 0.5 / s;
			this.x = (m12 - m21) * s;
			this.y = (m20 - m02) * s;
			this.z = (m01 - m10) * s;
		} else {
			if (m00 > m11) {
				if (m00 > m22) {
					// XDiagDomMatrix
					rs = (m00 - (m11 + m22)) + 1.0;
					rs = Mathf.sqrt(rs);

					this.x = rs * 0.5;
					rs = 0.5 / rs;
					this.w = (m12 - m21) * rs;
					this.y = (m01 + m10) * rs;
					this.z = (m02 + m20) * rs;
				} else {
					// ZDiagDomMatrix
					rs = (m22 - (m00 + m11)) + 1.0;
					rs = Mathf.sqrt(rs);

					this.z = rs * 0.5;
					rs = 0.5 / rs;
					this.w = (m01 - m10) * rs;
					this.x = (m20 + m02) * rs;
					this.y = (m21 + m12) * rs;
				}
			} else if (m11 > m22) {
				// YDiagDomMatrix
				rs = (m11 - (m22 + m00)) + 1.0;
				rs = Mathf.sqrt(rs);

				this.y = rs * 0.5;
				rs = 0.5 / rs;
				this.w = (m20 - m02) * rs;
				this.z = (m12 + m21) * rs;
				this.x = (m10 + m01) * rs;
			} else {
				// ZDiagDomMatrix
				rs = (m22 - (m00 + m11)) + 1.0;
				rs = Mathf.sqrt(rs);

				this.z = rs * 0.5;
				rs = 0.5 / rs;
				this.w = (m01 - m10) * rs;
				this.x = (m20 + m02) * rs;
				this.y = (m21 + m12) * rs;
			}
		}

		return this;
	}

	slerp(lhs: Quat, rhs: Quat, alpha: f32): Quat {
		// Algorithm sourced from:
		// http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/slerp/

		var lx = lhs.x;
		var ly = lhs.y;
		var lz = lhs.z;
		var lw = lhs.w;
		var rx = rhs.x;
		var ry = rhs.y;
		var rz = rhs.z;
		var rw = rhs.w;

		// Calculate angle between them.
		var cosHalfTheta = lw * rw + lx * rx + ly * ry + lz * rz;

		if (cosHalfTheta < 0.0) {
			rw = -rw;
			rx = -rx;
			ry = -ry;
			rz = -rz;
			cosHalfTheta = -cosHalfTheta;
		}

		// If lhs == rhs or lhs == -rhs then theta == 0 and we can return lhs
		if (Mathf.abs(cosHalfTheta) >= 1.0) {
			this.w = lw;
			this.x = lx;
			this.y = ly;
			this.z = lz;
			return this;
		}

		// Calculate temporary values.
		var halfTheta = Mathf.acos(cosHalfTheta);
		var sinHalfTheta = Mathf.sqrt(1.0 - cosHalfTheta * cosHalfTheta);

		// If theta = 180 degrees then result is not fully defined
		// we could rotate around any axis normal to qa or qb
		if (Mathf.abs(sinHalfTheta) < 0.001) {
			this.w = (lw * 0.5 + rw * 0.5);
			this.x = (lx * 0.5 + rx * 0.5);
			this.y = (ly * 0.5 + ry * 0.5);
			this.z = (lz * 0.5 + rz * 0.5);
			return this;
		}

		var ratioA = Mathf.sin((1.0 - alpha) * halfTheta) / sinHalfTheta;
		var ratioB = Mathf.sin(alpha * halfTheta) / sinHalfTheta;

		// Calculate Quaternion.
		this.w = (lw * ratioA + rw * ratioB);
		this.x = (lx * ratioA + rx * ratioB);
		this.y = (ly * ratioA + ry * ratioB);
		this.z = (lz * ratioA + rz * ratioB);
		return this;
	}

	transformVector(vec: Vec3, res: Vec3): Vec3 {
		var x = vec.x, y = vec.y, z = vec.z;
		var qx = this.x, qy = this.y, qz = this.z, qw = this.w;

		// calculate quat * vec
		var ix = qw * x + qy * z - qz * y;
		var iy = qw * y + qz * x - qx * z;
		var iz = qw * z + qx * y - qy * x;
		var iw = -qx * x - qy * y - qz * z;

		// calculate result * inverse quat
		res.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
		res.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
		res.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;

		return res;
	}
}

import {Vec3, PreallocatedVec3} from "./Vec3";
import {Vec4} from "./Vec4";
import {Mat3} from "./Mat3";
import {Quat} from "./Quat";
import {pc_math} from "./Math"

export class Mat4 {
	m0: f32;
	m1: f32;
	m2: f32;
	m3: f32;
	m4: f32;
	m5: f32;
	m6: f32;
	m7: f32;
	m8: f32;
	m9: f32;
	m10: f32;
	m11: f32;
	m12: f32;
	m13: f32;
	m14: f32;
	m15: f32;	

	constructor() {
		this.m0 = 1;

		this.m1 = 0;
		this.m2 = 0;
		this.m3 = 0;
		this.m4 = 0;

		this.m5 = 1;
		
		this.m6 = 0;
		this.m7 = 0;
		this.m8 = 0;
		this.m9 = 0;

		this.m10 = 1;
		
		this.m11 = 0;
		this.m12 = 0;
		this.m13 = 0;
		this.m14 = 0;

		this.m15 = 1;
	}
	
	add(rhs: Mat4): Mat4 {
		return this.add2(this, rhs);
	}
	
	add2(lhs: Mat4, rhs: Mat4): Mat4 {
		this.m0  = lhs.m0  + rhs.m0;
		this.m1  = lhs.m1  + rhs.m1;
		this.m2  = lhs.m2  + rhs.m2;
		this.m3  = lhs.m3  + rhs.m3;
		this.m4  = lhs.m4  + rhs.m4;
		this.m5  = lhs.m5  + rhs.m5;
		this.m6  = lhs.m6  + rhs.m6;
		this.m7  = lhs.m7  + rhs.m7;
		this.m8  = lhs.m8  + rhs.m8;
		this.m9  = lhs.m9  + rhs.m9;
		this.m10 = lhs.m10 + rhs.m10;
		this.m11 = lhs.m11 + rhs.m11;
		this.m12 = lhs.m12 + rhs.m12;
		this.m13 = lhs.m13 + rhs.m13;
		this.m14 = lhs.m14 + rhs.m14;
		this.m15 = lhs.m15 + rhs.m15;
		return this;
	}

	clone(): Mat4 {
		// AS doesn't support this yet: return new pc.Mat4().copy(this);
		var tmp = new Mat4();
		tmp.copy(this);
		return tmp;
	}

	copy(rhs: Mat4): Mat4 {
		this.m0  = rhs.m0;
		this.m1  = rhs.m1;
		this.m2  = rhs.m2;
		this.m3  = rhs.m3;
		this.m4  = rhs.m4;
		this.m5  = rhs.m5;
		this.m6  = rhs.m6;
		this.m7  = rhs.m7;
		this.m8  = rhs.m8;
		this.m9  = rhs.m9;
		this.m10 = rhs.m10;
		this.m11 = rhs.m11;
		this.m12 = rhs.m12;
		this.m13 = rhs.m13;
		this.m14 = rhs.m14;
		this.m15 = rhs.m15;
		return this;
	}

	equals(rhs: Mat4): boolean {
		return (
			(this.m0  === rhs.m0 ) &&
			(this.m1  === rhs.m1 ) &&
			(this.m2  === rhs.m2 ) &&
			(this.m3  === rhs.m3 ) &&
			(this.m4  === rhs.m4 ) &&
			(this.m5  === rhs.m5 ) &&
			(this.m6  === rhs.m6 ) &&
			(this.m7  === rhs.m7 ) &&
			(this.m8  === rhs.m8 ) &&
			(this.m9  === rhs.m9 ) &&
			(this.m10 === rhs.m10) &&
			(this.m11 === rhs.m11) &&
			(this.m12 === rhs.m12) &&
			(this.m13 === rhs.m13) &&
			(this.m14 === rhs.m14) &&
			(this.m15 === rhs.m15)
		);
	}

	getEulerAngles(eulers: Vec3): Vec3 {
		var x: f32;
		var z: f32;

		var scale = PreallocatedVec3.getEulerAngles_scale;

		this.getScale(scale);
		var sx = scale.x;
		var sy = scale.y;
		var sz = scale.z;

		var y = Mathf.asin(-this.m2 / sx);
		var halfPi = Mathf.PI * 0.5;

		if (y < halfPi) {
			if (y > -halfPi) {
				x = Mathf.atan2(this.m6 / sy, this.m10 / sz);
				z = Mathf.atan2(this.m1 / sx, this.m0 / sx);
			} else {
				// Not a unique solution
				z = 0;
				x = -Mathf.atan2(this.m4 / sy, this.m5 / sy);
			}
		} else {
			// Not a unique solution
			z = 0;
			x = Mathf.atan2(this.m4 / sy, this.m5 / sy);
		}

		return eulers.set(x, y, z).scale(pc_math.RAD_TO_DEG);
	}

	getScale(scale: Vec3): Vec3 {
		var x = PreallocatedVec3.getScale_x;
		var y = PreallocatedVec3.getScale_y;
		var z = PreallocatedVec3.getScale_z;

		this.getX(x);
		this.getY(y);
		this.getZ(z);
		scale.set(x.length(), y.length(), z.length());

		return scale;
	}
	
	getTranslation(t: Vec3): Vec3 {
		return t.set(this.m12, this.m13, this.m14);
	}

	getX(x: Vec3): Vec3 {
		return x.set(this.m0, this.m1, this.m2);
	}

	getY(y: Vec3): Vec3 {
		return y.set(this.m4, this.m5, this.m6);
	}

	getZ(z: Vec3): Vec3 {
		return z.set(this.m8, this.m9, this.m10);
	}

	invert(): Mat4 {
		var a00 = this.m0;
		var a01 = this.m1;
		var a02 = this.m2;
		var a03 = this.m3;
		var a10 = this.m4;
		var a11 = this.m5;
		var a12 = this.m6;
		var a13 = this.m7;
		var a20 = this.m8;
		var a21 = this.m9;
		var a22 = this.m10;
		var a23 = this.m11;
		var a30 = this.m12;
		var a31 = this.m13;
		var a32 = this.m14;
		var a33 = this.m15;

		var b00: f32 = a00 * a11 - a01 * a10;
		var b01: f32 = a00 * a12 - a02 * a10;
		var b02: f32 = a00 * a13 - a03 * a10;
		var b03: f32 = a01 * a12 - a02 * a11;
		var b04: f32 = a01 * a13 - a03 * a11;
		var b05: f32 = a02 * a13 - a03 * a12;
		var b06: f32 = a20 * a31 - a21 * a30;
		var b07: f32 = a20 * a32 - a22 * a30;
		var b08: f32 = a20 * a33 - a23 * a30;
		var b09: f32 = a21 * a32 - a22 * a31;
		var b10: f32 = a21 * a33 - a23 * a31;
		var b11: f32 = a22 * a33 - a23 * a32;

		var det: f32 = (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
		if (det === 0) {
			this.setIdentity();
		} else {
			var invDet: f32 = 1.0 / det;
			this.m0  = ( a11 * b11 - a12 * b10 + a13 * b09) * invDet;
			this.m1  = (-a01 * b11 + a02 * b10 - a03 * b09) * invDet;
			this.m2  = ( a31 * b05 - a32 * b04 + a33 * b03) * invDet;
			this.m3  = (-a21 * b05 + a22 * b04 - a23 * b03) * invDet;
			this.m4  = (-a10 * b11 + a12 * b08 - a13 * b07) * invDet;
			this.m5  = ( a00 * b11 - a02 * b08 + a03 * b07) * invDet;
			this.m6  = (-a30 * b05 + a32 * b02 - a33 * b01) * invDet;
			this.m7  = ( a20 * b05 - a22 * b02 + a23 * b01) * invDet;
			this.m8  = ( a10 * b10 - a11 * b08 + a13 * b06) * invDet;
			this.m9  = (-a00 * b10 + a01 * b08 - a03 * b06) * invDet;
			this.m10 = ( a30 * b04 - a31 * b02 + a33 * b00) * invDet;
			this.m11 = (-a20 * b04 + a21 * b02 - a23 * b00) * invDet;
			this.m12 = (-a10 * b09 + a11 * b07 - a12 * b06) * invDet;
			this.m13 = ( a00 * b09 - a01 * b07 + a02 * b06) * invDet;
			this.m14 = (-a30 * b03 + a31 * b01 - a32 * b00) * invDet;
			this.m15 = ( a20 * b03 - a21 * b01 + a22 * b00) * invDet;
		}
		return this;
	}



	invertTo3x3(res: Mat3): Mat4 {
		var m0 = this.m0;
		var m1 = this.m1;
		var m2 = this.m2;

		var m4 = this.m4;
		var m5 = this.m5;
		var m6 = this.m6;

		var m8  = this.m8;
		var m9  = this.m9;
		var m10 = this.m10;

		var a11 =  m10 * m5 - m6 * m9;
		var a21 = -m10 * m1 + m2 * m9;
		var a31 =  m6  * m1 - m2 * m5;
		var a12 = -m10 * m4 + m6 * m8;
		var a22 =  m10 * m0 - m2 * m8;
		var a32 = -m6  * m0 + m2 * m4;
		var a13 =  m9  * m4 - m5 * m8;
		var a23 = -m9  * m0 + m1 * m8;
		var a33 =  m5  * m0 - m1 * m4;

		var det: f32 = m0 * a11 + m1 * a12 + m2 * a13;
		if (det === 0) { // no inverse
			return this;
		}

		var idet: f32 = 1 / det;

		res.m0 = idet * a11;
		res.m1 = idet * a21;
		res.m2 = idet * a31;
		res.m3 = idet * a12;
		res.m4 = idet * a22;
		res.m5 = idet * a32;
		res.m6 = idet * a13;
		res.m7 = idet * a23;
		res.m8 = idet * a33;

		return this;
	}

	isIdentity(): boolean {
		return (
			(this.m0 === 1) &&
			(this.m1 === 0) &&
			(this.m2 === 0) &&
			(this.m3 === 0) &&
			(this.m4 === 0) &&
			(this.m5 === 1) &&
			(this.m6 === 0) &&
			(this.m7 === 0) &&
			(this.m8 === 0) &&
			(this.m9 === 0) &&
			(this.m10 === 1) &&
			(this.m11 === 0) &&
			(this.m12 === 0) &&
			(this.m13 === 0) &&
			(this.m14 === 0) &&
			(this.m15 === 1)
		);
	}

	mul(rhs: Mat4): Mat4 {
		return this.mul2(this, rhs);
	}
	
	mul2(lhs: Mat4, rhs: Mat4): Mat4 {
		var a00 = lhs.m0;
		var a01 = lhs.m1;
		var a02 = lhs.m2;
		var a03 = lhs.m3;
		var a10 = lhs.m4;
		var a11 = lhs.m5;
		var a12 = lhs.m6;
		var a13 = lhs.m7;
		var a20 = lhs.m8;
		var a21 = lhs.m9;
		var a22 = lhs.m10;
		var a23 = lhs.m11;
		var a30 = lhs.m12;
		var a31 = lhs.m13;
		var a32 = lhs.m14;
		var a33 = lhs.m15;

		var b0 = rhs.m0;
		var b1 = rhs.m1;
		var b2 = rhs.m2;
		var b3 = rhs.m3;
		this.m0  = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
		this.m1  = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
		this.m2  = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
		this.m3  = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;

		b0 = rhs.m4;
		b1 = rhs.m5;
		b2 = rhs.m6;
		b3 = rhs.m7;
		this.m4  = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
		this.m5  = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
		this.m6  = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
		this.m7  = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;

		b0 = rhs.m8;
		b1 = rhs.m9;
		b2 = rhs.m10;
		b3 = rhs.m11;
		this.m8  = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
		this.m9  = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
		this.m10 = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
		this.m11 = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;

		b0 = rhs.m12;
		b1 = rhs.m13;
		b2 = rhs.m14;
		b3 = rhs.m15;
		this.m12 = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
		this.m13 = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
		this.m14 = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
		this.m15 = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;

		return this;
	}

	setFromAxisAngle(axis: Vec3, angle: f32): Mat4 {
		angle *= pc_math.DEG_TO_RAD;

		var x: f32 = axis.x;
		var y: f32 = axis.y;
		var z: f32 = axis.z;
		var c: f32 = Mathf.cos(angle);
		var s: f32 = Mathf.sin(angle);
		var t: f32 = 1.0 - c;
		var tx: f32 = t * x;
		var ty: f32 = t * y;

		this.m0 = tx * x + c;
		this.m1 = tx * y + s * z;
		this.m2 = tx * z - s * y;
		this.m3 = 0;
		this.m4 = tx * y - s * z;
		this.m5 = ty * y + c;
		this.m6 = ty * z + s * x;
		this.m7 = 0;
		this.m8 = tx * z + s * y;
		this.m9 = ty * z - x * s;
		this.m10 = t * z * z + c;
		this.m11 = 0;
		this.m12 = 0;
		this.m13 = 0;
		this.m14 = 0;
		this.m15 = 1;

		return this;
	}


	// http://en.wikipedia.org/wiki/Rotation_matrix#Conversion_from_and_to_axis-angle
	// The 3D space is right-handed, so the rotation around each axis will be counterclockwise
	// for an observer placed so that the axis goes in his or her direction (Right-hand rule).
	setFromEulerAngles(ex: f32, ey: f32, ez: f32): Mat4 {
		ex *= pc_math.DEG_TO_RAD;
		ey *= pc_math.DEG_TO_RAD;
		ez *= pc_math.DEG_TO_RAD;

		// Solution taken from http://en.wikipedia.org/wiki/Euler_angles#Matrix_orientation
		var s1 = Mathf.sin(-ex);
		var c1 = Mathf.cos(-ex);
		var s2 = Mathf.sin(-ey);
		var c2 = Mathf.cos(-ey);
		var s3 = Mathf.sin(-ez);
		var c3 = Mathf.cos(-ez);

		// Set rotation elements
		this.m0 = c2 * c3;
		this.m1 = -c2 * s3;
		this.m2 = s2;
		this.m3 = 0;

		this.m4 = c1 * s3 + c3 * s1 * s2;
		this.m5 = c1 * c3 - s1 * s2 * s3;
		this.m6 = -c2 * s1;
		this.m7 = 0;

		this.m8 = s1 * s3 - c1 * c3 * s2;
		this.m9 = c3 * s1 + c1 * s2 * s3;
		this.m10 = c1 * c2;
		this.m11 = 0;

		this.m12 = 0;
		this.m13 = 0;
		this.m14 = 0;
		this.m15 = 1;

		return this;
	}

	setFrustum(left: f32, right: f32, bottom: f32, top: f32, znear: f32, zfar: f32): Mat4 {
		var temp1: f32 = 2 * znear;
		var temp2: f32 = right - left;
		var temp3: f32 = top - bottom;
		var temp4: f32 = zfar - znear;

		this.m0 = temp1 / temp2;
		this.m1 = 0;
		this.m2 = 0;
		this.m3 = 0;
		this.m4 = 0;
		this.m5 = temp1 / temp3;
		this.m6 = 0;
		this.m7 = 0;
		this.m8 = (right + left) / temp2;
		this.m9 = (top + bottom) / temp3;
		this.m10 = (-zfar - znear) / temp4;
		this.m11 = -1;
		this.m12 = 0;
		this.m13 = 0;
		this.m14 = (-temp1 * zfar) / temp4;
		this.m15 = 0;

		return this;
	}

	setIdentity(): Mat4 {
		this.m0 = 1;
		this.m1 = 0;
		this.m2 = 0;
		this.m3 = 0;
		this.m4 = 0;
		this.m5 = 1;
		this.m6 = 0;
		this.m7 = 0;
		this.m8 = 0;
		this.m9 = 0;
		this.m10 = 1;
		this.m11 = 0;
		this.m12 = 0;
		this.m13 = 0;
		this.m14 = 0;
		this.m15 = 1;
		return this;
	}

	setLookAt(position: Vec3, target: Vec3, up: Vec3): Mat4 {
		var x = PreallocatedVec3.setLookAt_x;
		var y = PreallocatedVec3.setLookAt_y;
		var z = PreallocatedVec3.setLookAt_z;

		z.sub2(position, target).normalize();
		y.copy(up).normalize();
		x.cross(y, z).normalize();
		y.cross(z, x);

		this.m0  = x.x;
		this.m1  = x.y;
		this.m2  = x.z;
		this.m3  = 0;
		this.m4  = y.x;
		this.m5  = y.y;
		this.m6  = y.z;
		this.m7  = 0;
		this.m8  = z.x;
		this.m9  = z.y;
		this.m10 = z.z;
		this.m11 = 0;
		this.m12 = position.x;
		this.m13 = position.y;
		this.m14 = position.z;
		this.m15 = 1;

		return this;
	}

	setOrtho(left: f32, right: f32, bottom: f32, top: f32, near: f32, far: f32): Mat4 {
		this.m0 = 2 / (right - left);
		this.m1 = 0;
		this.m2 = 0;
		this.m3 = 0;
		this.m4 = 0;
		this.m5 = 2 / (top - bottom);
		this.m6 = 0;
		this.m7 = 0;
		this.m8 = 0;
		this.m9 = 0;
		this.m10 = -2 / (far - near);
		this.m11 = 0;
		this.m12 = -(right + left) / (right - left);
		this.m13 = -(top + bottom) / (top - bottom);
		this.m14 = -(far + near) / (far - near);
		this.m15 = 1;
		return this;
	}

	setPerspective(fov: f32, aspect: f32, znear: f32, zfar: f32, fovIsHorizontal: boolean): Mat4 {
		var xmax: f32;
		var ymax: f32;

		if (!fovIsHorizontal) {
			ymax = znear * Mathf.tan(fov * Mathf.PI / 360);
			xmax = ymax * aspect;
		} else {
			xmax = znear * Mathf.tan(fov * Mathf.PI / 360);
			ymax = xmax / aspect;
		}

		return this.setFrustum(-xmax, xmax, -ymax, ymax, znear, zfar);
	}

	setScale(x: f32, y: f32, z: f32): Mat4 {
		this.m0 = x;
		this.m1 = 0;
		this.m2 = 0;
		this.m3 = 0;
		this.m4 = 0;
		this.m5 = y;
		this.m6 = 0;
		this.m7 = 0;
		this.m8 = 0;
		this.m9 = 0;
		this.m10 = z;
		this.m11 = 0;
		this.m12 = 0;
		this.m13 = 0;
		this.m14 = 0;
		this.m15 = 1;
		return this;
	}

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
	 * m.setTRS(t, r, s);
	 */
	setTRS(t: Vec3, r: Quat, s: Vec3): Mat4 {
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

		this.m0 = (1 - (yy + zz)) * sx;
		this.m1 = (xy + wz) * sx;
		this.m2 = (xz - wy) * sx;
		this.m3 = 0;

		this.m4 = (xy - wz) * sy;
		this.m5 = (1 - (xx + zz)) * sy;
		this.m6 = (yz + wx) * sy;
		this.m7 = 0;

		this.m8 = (xz + wy) * sz;
		this.m9 = (yz - wx) * sz;
		this.m10 = (1 - (xx + yy)) * sz;
		this.m11 = 0;

		this.m12 = tx;
		this.m13 = ty;
		this.m14 = tz;
		this.m15 = 1;

		return this;
	}
	
	setTranslate(x: f32, y: f32, z: f32): Mat4 {
		this.m0 = 1;
		this.m1 = 0;
		this.m2 = 0;
		this.m3 = 0;
		this.m4 = 0;
		this.m5 = 1;
		this.m6 = 0;
		this.m7 = 0;
		this.m8 = 0;
		this.m9 = 0;
		this.m10 = 1;
		this.m11 = 0;
		this.m12 = x;
		this.m13 = y;
		this.m14 = z;
		this.m15 = 1;
		return this;
	}

	transformPoint(vec: Vec3, res: Vec3): Vec3 {
		var x = vec.x;
		var y = vec.y;
		var z = vec.z;
		res.x = x * this.m0 + y * this.m4 + z * this.m8  + this.m12;
		res.y = x * this.m1 + y * this.m5 + z * this.m9  + this.m13;
		res.z = x * this.m2 + y * this.m6 + z * this.m10 + this.m14;
		return res;
	}

	transformVec4(vec: Vec4, res: Vec4): Vec4 {
		var x = vec.x;
		var y = vec.y;
		var z = vec.z;
		var w = vec.w;
		res.x = x * this.m0 + y * this.m4 + z * this.m8  + w * this.m12;
		res.y = x * this.m1 + y * this.m5 + z * this.m9  + w * this.m13;
		res.z = x * this.m2 + y * this.m6 + z * this.m10 + w * this.m14;
		res.w = x * this.m3 + y * this.m7 + z * this.m11 + w * this.m15;
		return res;
	}

	transformVector(vec: Vec3, res: Vec3): Vec3 {
		var x = vec.x;
		var y = vec.y;
		var z = vec.z;
		res.x = x * this.m0 + y * this.m4 + z * this.m8;
		res.y = x * this.m1 + y * this.m5 + z * this.m9;
		res.z = x * this.m2 + y * this.m6 + z * this.m10;
		return res;
	}

	transpose(): Mat4 {

		var tmp = this.m1;
		this.m1 = this.m4;
		this.m4 = tmp;

		tmp = this.m2;
		this.m2 = this.m8;
		this.m8 = tmp;

		tmp = this.m3;
		this.m3 = this.m12;
		this.m12 = tmp;

		tmp = this.m6;
		this.m6 = this.m9;
		this.m9 = tmp;

		tmp = this.m7;
		this.m7 = this.m13;
		this.m13 = tmp;

		tmp = this.m11;
		this.m11 = this.m14;
		this.m14 = tmp;

		return this;
	}
}

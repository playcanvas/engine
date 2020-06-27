export class Vec3 {
	x: f32;
	y: f32;
	z: f32;

	constructor(x: f32, y: f32, z: f32) {
		this.x = x;
		this.y = y;
		this.z = z;
	}

	add(rhs: Vec3): Vec3 {
		this.x += rhs.x;
		this.y += rhs.y;
		this.z += rhs.z;
		return this;
	}

	add2(lhs: Vec3, rhs: Vec3): Vec3 {
		this.x = lhs.x + rhs.x;
		this.y = lhs.y + rhs.y;
		this.z = lhs.z + rhs.z;
		return this;
	}

	clone(): Vec3 {
		var tmp = new Vec3(0, 0, 0);
		tmp.copy(this);
		return tmp;
	}

	copy(rhs: Vec3): Vec3 {
		this.x = rhs.x;
		this.y = rhs.y;
		this.z = rhs.z;
		return this;
	}

	cross(lhs: Vec3, rhs: Vec3): Vec3 {
		// Create temporary variables in case lhs or rhs are 'this'
		var lx = lhs.x;
		var ly = lhs.y;
		var lz = lhs.z;
		var rx = rhs.x;
		var ry = rhs.y;
		var rz = rhs.z;
		this.x = ly * rz - ry * lz;
		this.y = lz * rx - rz * lx;
		this.z = lx * ry - rx * ly;
		return this;
	}

	dot(rhs: Vec3): f32 {
		return this.x * rhs.x + this.y * rhs.y + this.z * rhs.z;
	}

	equals(rhs: Vec3): boolean {
		return this.x === rhs.x && this.y === rhs.y && this.z === rhs.z;
	}

	length(): f32 {
		return Mathf.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
	}

	lengthSq(): f32 {
		return this.x * this.x + this.y * this.y + this.z * this.z;
	}

	lerp(lhs: Vec3, rhs: Vec3, alpha: f32): Vec3 {
		this.x = lhs.x + alpha * (rhs.x - lhs.x);
		this.y = lhs.y + alpha * (rhs.y - lhs.y);
		this.z = lhs.z + alpha * (rhs.z - lhs.z);

		return this;
	}

	mul(rhs: Vec3): Vec3 {
		this.x *= rhs.x;
		this.y *= rhs.y;
		this.z *= rhs.z;

		return this;
	}

	mul2(lhs: Vec3, rhs: Vec3): Vec3 {
		this.x = lhs.x * rhs.x;
		this.y = lhs.y * rhs.y;
		this.z = lhs.z * rhs.z;

		return this;
	}

	normalize(): Vec3 {
		var lengthSq = this.x * this.x + this.y * this.y + this.z * this.z;
		if (lengthSq > 0.0) {
			var invLength: f32 = 1.0 / Mathf.sqrt(lengthSq);
			this.x *= invLength;
			this.y *= invLength;
			this.z *= invLength;
		}
		return this;
	}

	project(rhs: Vec3): Vec3 {
		var a_dot_b = this.x * rhs.x + this.y * rhs.y + this.z * rhs.z;
		var b_dot_b = rhs.x * rhs.x + rhs.y * rhs.y + rhs.z * rhs.z;
		var s = a_dot_b / b_dot_b;
		this.x = rhs.x * s;
		this.y = rhs.y * s;
		this.z = rhs.z * s;
		return this;
	}

	scale(scalar: f32): Vec3 {
		this.x *= scalar;
		this.y *= scalar;
		this.z *= scalar;
		return this;
	}

	set(x: f32, y: f32, z: f32): Vec3 {
		this.x = x;
		this.y = y;
		this.z = z;
		return this;
	}

	sub(rhs: Vec3): Vec3 {
		this.x -= rhs.x;
		this.y -= rhs.y;
		this.z -= rhs.z;
		return this;
	}

	sub2(lhs: Vec3, rhs: Vec3): Vec3 {
		this.x = lhs.x - rhs.x;
		this.y = lhs.y - rhs.y;
		this.z = lhs.z - rhs.z;
		return this;
	}
}

export class PreallocatedVec3 {
	// for user code
	public static a: Vec3                    = new Vec3(0, 0, 0);
	public static b: Vec3                    = new Vec3(0, 0, 0);
	public static c: Vec3                    = new Vec3(0, 0, 0);
	// each function its own, so they don't collide
	public static setLookAt_x: Vec3          = new Vec3(0, 0, 0);
	public static setLookAt_y: Vec3          = new Vec3(0, 0, 0);
	public static setLookAt_z: Vec3          = new Vec3(0, 0, 0);
	public static getScale_x: Vec3           = new Vec3(0, 0, 0);
	public static getScale_y: Vec3           = new Vec3(0, 0, 0);
	public static getScale_z: Vec3           = new Vec3(0, 0, 0);
	public static getEulerAngles_scale: Vec3 = new Vec3(0, 0, 0);
}

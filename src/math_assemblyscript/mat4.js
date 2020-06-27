mat4_constructor        = instance.exports["Mat4#constructor"];

mat4_add                = instance.exports["Mat4#add"];
mat4_add2               = instance.exports["Mat4#add2"];
mat4_clone              = instance.exports["Mat4#clone"];
mat4_copy               = instance.exports["Mat4#copy"];
mat4_equals             = instance.exports["Mat4#equals"];
mat4_getEulerAngles     = instance.exports["Mat4#getEulerAngles"];
mat4_getScale           = instance.exports["Mat4#getScale"];
mat4_getTranslation     = instance.exports["Mat4#getTranslation"];
mat4_getX               = instance.exports["Mat4#getX"];
mat4_getY               = instance.exports["Mat4#getY"];
mat4_getZ               = instance.exports["Mat4#getZ"];
mat4_invert             = instance.exports["Mat4#invert"];
mat4_invertTo3x3        = instance.exports["Mat4#invertTo3x3"];
mat4_isIdentity         = instance.exports["Mat4#isIdentity"];
mat4_mul                = instance.exports["Mat4#mul"];
mat4_mul2               = instance.exports["Mat4#mul2"];
mat4_setFromAxisAngle   = instance.exports["Mat4#setFromAxisAngle"];
mat4_setFromEulerAngles = instance.exports["Mat4#setFromEulerAngles"];
mat4_setFrustum         = instance.exports["Mat4#setFrustum"];
mat4_setIdentity        = instance.exports["Mat4#setIdentity"];
mat4_setLookAt          = instance.exports["Mat4#setLookAt"];
mat4_setOrtho           = instance.exports["Mat4#setOrtho"];
mat4_setPerspective     = instance.exports["Mat4#setPerspective"];
mat4_setScale           = instance.exports["Mat4#setScale"];
mat4_setTRS             = instance.exports["Mat4#setTRS"];
mat4_setTranslate       = instance.exports["Mat4#setTranslate"];
mat4_transformPoint     = instance.exports["Mat4#transformPoint"];
mat4_transformVec4      = instance.exports["Mat4#transformVec4"];
mat4_transformVector    = instance.exports["Mat4#transformVector"];
mat4_transpose          = instance.exports["Mat4#transpose"];

pc.Mat4 = function() {
	this.ptr = mat4_constructor(0);
	// if (module.tlfs) {
	//	this.bufferByteLength = 0;
	// } else {
		this.assignDataView();
	// }
}

pc.Mat4.wrap = function(ptr) {
	var tmp = Object.create(pc.Mat4.prototype);
	tmp.ptr = ptr;
	// if (tlfs) {
	//	tmp.bufferByteLength = 0;
	// } else {
		tmp.assignDataView();
	// }
	return tmp;
}

pc.Mat4.prototype.assignDataView = function() {
	//this.wrap = module.Mat4.wrap(this.ptr)
	this.data = new Float32Array(module.memory.buffer, this.ptr, 16);
	//this.data.ptr = this.ptr;
}

pc.Mat4.prototype.add = function(rhs) {
	mat4_add(this.ptr, rhs.ptr);
	return this;
}

pc.Mat4.prototype.add2 = function(lhs, rhs) {
	mat4_add2(this.ptr, lhs.ptr, rhs.ptr);
	return this;
}

pc.Mat4.prototype.clone = function() {
	var ptr = mat4_clone(this.ptr);
	var tmp = pc.Mat4.wrap(ptr);
	return tmp;
}

pc.Mat4.prototype.copy = function(rhs) {
	mat4_copy(this.ptr, rhs.ptr);
	return this;
}

pc.Mat4.prototype.equals = function(rhs) {
	return !!mat4_equals(this.ptr, rhs.ptr);
}

pc.Mat4.prototype.getEulerAngles = function(eulers) {
	if (eulers === undefined) {
		eulers = new pc.Vec3();
	}
	mat4_getEulerAngles(this.ptr, eulers.ptr);
	return eulers;
}

pc.Mat4.prototype.getScale = function(scale) {
	if (scale === undefined) {
		scale = new pc.Vec3();
	}
	mat4_getScale(this.ptr, scale.ptr);
	return scale;
}

pc.Mat4.prototype.getTranslation = function(t) {
	if (t === undefined) {
		t = new pc.Vec3();
	}
	mat4_getTranslation(this.ptr, t.ptr);
	return t;
}

pc.Mat4.prototype.getX = function(x) {
	if (x === undefined) {
		x = new pc.Vec3();
	}
	mat4_getX(this.ptr, x.ptr);
	return x;
}

pc.Mat4.prototype.getY = function(y) {
	if (y === undefined) {
		y = new pc.Vec3();
	}
	mat4_getY(this.ptr, y.ptr);
	return y;
}

pc.Mat4.prototype.getZ = function(z) {
	if (z === undefined) {
		z = new pc.Vec3();
	}
	mat4_getZ(this.ptr, z.ptr);
	return z;
}

pc.Mat4.prototype.invert = function() {
	mat4_invert(this.ptr);
	return this;
}

pc.Mat4.prototype.invertTo3x3 = function(mat3) {
	mat4_invertTo3x3(this.ptr, mat3.ptr);
	return this;
}

pc.Mat4.prototype.isIdentity = function() {
	return !!mat4_isIdentity(this.ptr);
}

pc.Mat4.prototype.mul = function(rhs) {
	mat4_mul(this.ptr, rhs.ptr);
	return this;
}

pc.Mat4.prototype.mul2 = function(lhs, rhs) {
	mat4_mul2(this.ptr, lhs.ptr, rhs.ptr);
	return this;
}

pc.Mat4.prototype.setFromAxisAngle = function(axis, angle) {
	mat4_setFromAxisAngle(this.ptr, axis.ptr, angle);
	return this;
}

pc.Mat4.prototype.setFromEulerAngles = function(ex, ey, ez) {
	mat4_setFromEulerAngles(this.ptr, ex, ey, ez);
	return this;
}

pc.Mat4.prototype.setFrustum = function(left, right, bottom, top, znear, zfar) {
	mat4_setFrustum(this.ptr, left, right, bottom, top, znear, zfar);
	return this;
}

pc.Mat4.prototype.setIdentity = function() {
	mat4_setIdentity(this.ptr);
	return this;
}

pc.Mat4.prototype.setLookAt = function(position, target, up) {
	mat4_setLookAt(this.ptr, position.ptr, target.ptr, up.ptr);
	return this;
}

pc.Mat4.prototype.setOrtho = function(left, right, bottom, top, near, far) {
	mat4_setOrtho(this.ptr, left, right, bottom, top, near, far);
	return this;
}

pc.Mat4.prototype.setPerspective = function(fov, aspect, znear, zfar, fovIsHorizontal) {
	mat4_setPerspective(this.ptr, fov, aspect, znear, zfar, fovIsHorizontal);
	return this;
}

pc.Mat4.prototype.setScale = function(x, y, z) {
	mat4_setScale(this.ptr, x, y, z);
	return this;
}

pc.Mat4.prototype.setTRS = function(t, r, s) {
	mat4_setTRS(this.ptr, t.ptr, r.ptr, s.ptr);
	return this;
}

pc.Mat4.prototype.setTranslate = function(x, y, z) {
	mat4_setTranslate(this.ptr, x, y, z);
	return this;
}

pc.Mat4.prototype.transformPoint = function(vec, res) {
	if (res === undefined) {
		res = new pc.Vec3();
	}
	mat4_transformPoint(this.ptr, vec.ptr, res.ptr);
	return res;
}

pc.Mat4.prototype.transformVec4 = function(vec, res) {
	if (res === undefined) {
		res = new pc.Vec3();
	}
	mat4_transformVec4(this.ptr, vec.ptr, res.ptr);
	return res;
}

pc.Mat4.prototype.transformVector = function(vec, res) {
	if (res === undefined) {
		res = new pc.Vec3();
	}
	mat4_transformVector(this.ptr, vec.ptr, res.ptr);
	return res;
}

pc.Mat4.prototype.transpose = function() {
	mat4_transpose(this.ptr);
	return this;
}

pc.Mat4.prototype.set = function(src) {
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
}

pc.Mat4.prototype.toString = function() {
	var i, t;
	t = '[';
	for (i = 0; i < 16; i += 1) {
		t += this.data[i];
		t += (i !== 15) ? ', ' : '';
	}
	t += ']';
	return t;
}

pc.Mat4.prototype.toStringFixed = function(n) {
	var i, t;
	t = '[';
	for (i = 0; i < 16; i += 1) {
		t += this.data[i].toFixed(n);
		t += (i !== 15) ? ', ' : '';
	}
	t += ']';
	return t;
}

/*
Useful for: TLSF allocator.
But currently I use the Arena allocator, because it's faster.
I simply preallocate 300mb and update the dataviews *never*.

Object.defineProperty(pc.Mat4.prototype, 'data', {
	get: function() {
		if (this.bufferByteLength != module.memory.buffer.byteLength) {
			// Recreate dataview when the wasm arraybuffer changed size.
			// Needed because dataviews become invalid when original arraybuffer resizes.
			// I cache them because recreating dataviews for 64 animated models costs like 5ms per frame.
			this.cachedDataView = new Float32Array(module.memory.buffer, this.ptr, 16);
			this.bufferByteLength = module.memory.buffer.byteLength;
			console.log("recreate dataview for ", this);
		}
		return this.cachedDataView;
	}
});
*/

Object.defineProperty(pc.Mat4, 'IDENTITY', {
	get: (function () {
		var identity = new pc.Mat4();
		return function () {
			return identity;
		};
	}())
});

Object.defineProperty(pc.Mat4, 'ONE', {
	get: (function () {
		var zero = new pc.Mat4().set([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
		return function () {
			return zero;
		};
	}())
});

Object.defineProperty(pc.Mat4, 'ZERO', {
	get: (function () {
		var zero = new pc.Mat4().set([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
		return function () {
			return zero;
		};
	}())
});

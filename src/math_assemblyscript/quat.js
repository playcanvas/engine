quat_constructor        = instance.exports["Quat#constructor"];

quat_clone              = instance.exports["Quat#clone"];
quat_conjugate          = instance.exports["Quat#conjugate"];
quat_copy               = instance.exports["Quat#copy"];
quat_equals             = instance.exports["Quat#equals"];
quat_getAxisAngle       = instance.exports["Quat#getAxisAngle"];
quat_getEulerAngles     = instance.exports["Quat#getEulerAngles"];
quat_invert             = instance.exports["Quat#invert"];
quat_length             = instance.exports["Quat#length"];
quat_lengthSq           = instance.exports["Quat#lengthSq"];
quat_mul                = instance.exports["Quat#mul"];
quat_mul2               = instance.exports["Quat#mul2"];
quat_normalize          = instance.exports["Quat#normalize"];
quat_set                = instance.exports["Quat#set"];
quat_setFromAxisAngle   = instance.exports["Quat#setFromAxisAngle"];
quat_setFromEulerAngles = instance.exports["Quat#setFromEulerAngles"];
quat_setFromMat4        = instance.exports["Quat#setFromMat4"];
quat_slerp              = instance.exports["Quat#slerp"];
quat_transformVector    = instance.exports["Quat#transformVector"];

/**
 * @constructor
 */

pc.Quat = function(x, y, z, w) {
	if (x && x.length === 4) {
		this.ptr = quat_constructor(0, x[0], x[1], x[2], x[3]);
	} else {
		this.ptr = quat_constructor(0, x || 0, y || 0, z || 0, w || 1);
	}
}

pc.Quat.wrap = function(ptr) {
	var tmp = Object.create(pc.Quat.prototype);
	tmp.ptr = ptr;
	return tmp;
}

pc.Quat.prototype.clone = function() {
	var tmp = quat_clone(this.ptr);
	return pc.Quat.wrap(tmp);
}

pc.Quat.prototype.conjugate = function() {
	quat_conjugate(this.ptr);
	return this;
}

pc.Quat.prototype.copy = function(rhs) {
	quat_copy(this.ptr, rhs.ptr);
	return this;
}

pc.Quat.prototype.equals = function(rhs) {
	return !!quat_equals(this.ptr, rhs.ptr);
}

/**
 * @param {pc.Vec3} axis output vector
 */

pc.Quat.prototype.getAxisAngle = function(axis) {
	return quat_getAxisAngle(this.ptr, axis.ptr);
}

pc.Quat.prototype.getEulerAngles = function(eulers) {
	eulers = (eulers === undefined) ? new pc.Vec3() : eulers;
	quat_getEulerAngles(this.ptr, eulers.ptr);
	return this;
}

pc.Quat.prototype.invert = function() {
	quat_invert(this.ptr);
	return this;
}

pc.Quat.prototype.length = function() {
	return quat_length(this.ptr);
}

pc.Quat.prototype.lengthSq = function() {
	return quat_lengthSq(this.ptr);
}

pc.Quat.prototype.mul = function(rhs) {
	quat_mul(this.ptr, rhs.ptr);
	return this;
}

pc.Quat.prototype.mul2 = function(lhs, rhs) {
	quat_mul2(this.ptr, lhs.ptr, rhs.ptr);
	return this;
}

pc.Quat.prototype.normalize = function() {
	quat_normalize(this.ptr);
	return this;
}

pc.Quat.prototype.set = function(x, y, z, w) {
	quat_set(this.ptr, x, y, z, w);
	return this;
}

pc.Quat.prototype.setFromAxisAngle = function(axis, angle) {
	quat_setFromAxisAngle(this.ptr, axis.ptr, angle);
	return this;
}

pc.Quat.prototype.setFromEulerAngles = function(ex, ey, ez) {
	quat_setFromEulerAngles(this.ptr, ex, ey, ez);
	return this;
}

pc.Quat.prototype.setFromMat4 = function(mat4) {
	quat_setFromMat4(this.ptr, mat4.ptr);
	return this;
}

pc.Quat.prototype.slerp = function(lhs, rhs, alpha) {
	quat_slerp(this.ptr, lhs.ptr, rhs.ptr, alpha);
	return this;
}

pc.Quat.prototype.transformVector = function(vec, res) {
	if (res === undefined) {
		res = new pc.Vec3();
	}
	quat_transformVector(this.ptr, vec.ptr, res.ptr);
	return res;
}

pc.Quat.prototype.toString = function() {
	return '[' + this.x + ', ' + this.y + ', ' + this.z + ', ' + this.w + ']';
}

pc.Quat.prototype.toStringFixed = function(n) {
	return '[' + this.x.toFixed(n) + ', ' + this.y.toFixed(n) + ', ' + this.z.toFixed(n) + ', ' + this.w.toFixed(n) + ']';
}

Object.defineProperty(pc.Quat.prototype, 'x', {
	get: function() {
		return module.F32[this.ptr >> 2]; // the shifting is same as dividing by 4, used to quickly lookup the value in module.F32
	},
	set: function(newValue) {
		module.F32[this.ptr >> 2] = newValue;
	}
});

Object.defineProperty(pc.Quat.prototype, 'y', {
	get: function() {
		return module.F32[(this.ptr >> 2) + 1];
	},
	set: function(newValue) {
		module.F32[(this.ptr >> 2) + 1] = newValue;
	}
});

Object.defineProperty(pc.Quat.prototype, 'z', {
	get: function() {
		return module.F32[(this.ptr >> 2) + 2];
	},
	set: function(newValue) {
		module.F32[(this.ptr >> 2) + 2] = newValue;
	}
});

Object.defineProperty(pc.Quat.prototype, 'w', {
	get: function() {
		return module.F32[(this.ptr >> 2) + 3];
	},
	set: function(newValue) {
		module.F32[(this.ptr >> 2) + 3] = newValue;
	}
});

Object.defineProperty(pc.Quat, 'IDENTITY', {
	get: (function () {
		var identity = new pc.Quat();
		return function () {
			return identity;
		};
	}())
});

Object.defineProperty(pc.Quat, 'ZERO', {
	get: (function () {
		var zero = new pc.Quat(0, 0, 0, 0);
		return function () {
			return zero;
		};
	}())
});

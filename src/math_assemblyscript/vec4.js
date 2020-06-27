vec4_add          = instance.exports["Vec4#add"];
vec4_add2         = instance.exports["Vec4#add2"];
vec4_clone        = instance.exports["Vec4#clone"];
vec4_constructor  = instance.exports["Vec4#constructor"];
vec4_copy         = instance.exports["Vec4#copy"];
//vec4_cross        = instance.exports["Vec4#cross"];
vec4_dot          = instance.exports["Vec4#dot"];
vec4_equals       = instance.exports["Vec4#equals"];
vec4_length       = instance.exports["Vec4#length"];
vec4_lengthSq     = instance.exports["Vec4#lengthSq"];
vec4_lerp         = instance.exports["Vec4#lerp"];
vec4_mul          = instance.exports["Vec4#mul"];
vec4_mul2         = instance.exports["Vec4#mul2"];
vec4_normalize    = instance.exports["Vec4#normalize"];
//vec4_project      = instance.exports["Vec4#project"];
vec4_scale        = instance.exports["Vec4#scale"];
vec4_set          = instance.exports["Vec4#set"];
vec4_sub          = instance.exports["Vec4#sub"];
vec4_sub2         = instance.exports["Vec4#sub2"];

/**
 * @constructor
 */

pc.Vec4 = function(x, y, z, w) {
	if (x && x.length === 4) {
		this.ptr = vec4_constructor(0, x[0], x[1], x[2], x[3]);
	} else {
		this.ptr = vec4_constructor(0, x || 0, y || 0, z || 0, w || 0);
	}
}

pc.Vec4.wrap = function(ptr) {
	var tmp = Object.create(pc.Vec4.prototype);
	tmp.ptr = ptr;
	return tmp;
}

pc.Vec4.prototype.add = function(rhs) {
	vec4_add(this.ptr, rhs.ptr);
	return this;
}

pc.Vec4.prototype.add2 = function(lhs, rhs) {
	vec4_add2(this.ptr, lhs.ptr, rhs.ptr);
	return this;
}

pc.Vec4.prototype.clone = function() {
	var tmp = vec4_clone(this.ptr);
	return pc.Vec4.wrap(tmp);
}

pc.Vec4.prototype.copy = function(rhs) {
	vec4_copy(this.ptr, rhs.ptr);
	return this;
}

pc.Vec4.prototype.dot = function(rhs) {
	return vec4_dot(this.ptr, rhs.ptr);
}

pc.Vec4.prototype.equals = function(rhs) {
	return !!vec4_equals(this.ptr, rhs.ptr);
}

pc.Vec4.prototype.length = function() {
	return vec4_length(this.ptr);
}

pc.Vec4.prototype.lengthSq = function() {
	return vec4_lengthSq(this.ptr);
}

pc.Vec4.prototype.lerp = function(lhs, rhs, alpha) {
	vec4_lerp(this.ptr, lhs.ptr, rhs.ptr, alpha);
	return this;
}

pc.Vec4.prototype.mul = function(rhs) {
	vec4_mul(this.ptr, rhs.ptr);
	return this;
}

pc.Vec4.prototype.mul2 = function(lhs, rhs) {
	vec4_mul2(this.ptr, lhs.ptr, rhs.ptr);
	return this;
}

pc.Vec4.prototype.normalize = function() {
	vec4_normalize(this.ptr);
	return this;
}

pc.Vec4.prototype.scale = function(scalar) {
	vec4_scale(this.ptr, scalar);
	return this;
}

pc.Vec4.prototype.set = function(x, y, z, w) {
	vec4_set(this.ptr, x, y, z, w);
	return this;
}

pc.Vec4.prototype.sub = function(rhs) {
	vec4_sub(this.ptr, rhs.ptr);
	return this;
}

pc.Vec4.prototype.sub2 = function(lhs, rhs) {
	vec4_sub2(this.ptr, lhs.ptr, rhs.ptr);
	return this;
}

pc.Vec4.prototype.toString = function() {
	return '[' + this.x + ', ' + this.y + ', ' + this.z + ', ' + this.w + ']';
}

pc.Vec4.prototype.toStringFixed = function(n) {
	return '[' + this.x.toFixed(n) + ', ' + this.y.toFixed(n) + ', ' + this.z.toFixed(n) + ', ' + this.w.toFixed(n) + ']';
}

Object.defineProperty(pc.Vec4.prototype, 'x', {
	get: function() {
		return module.F32[this.ptr >> 2]; // the shifting is same as dividing by 4, used to quickly lookup the value in module.F32
	},
	set: function(newValue) {
		module.F32[this.ptr >> 2] = newValue;
	}
});

Object.defineProperty(pc.Vec4.prototype, 'y', {
	get: function() {
		return module.F32[(this.ptr >> 2) + 1];
	},
	set: function(newValue) {
		module.F32[(this.ptr >> 2) + 1] = newValue;
	}
});

Object.defineProperty(pc.Vec4.prototype, 'z', {
	get: function() {
		return module.F32[(this.ptr >> 2) + 2];
	},
	set: function(newValue) {
		module.F32[(this.ptr >> 2) + 2] = newValue;
	}
});

Object.defineProperty(pc.Vec4.prototype, 'w', {
	get: function() {
		return module.F32[(this.ptr >> 2) + 3];
	},
	set: function(newValue) {
		module.F32[(this.ptr >> 2) + 3] = newValue;
	}
});


/**
 * @field
 * @static
 * @readonly
 * @type pc.Vec4
 * @name pc.Vec4.ONE
 * @description A constant vector set to [1, 1, 1, 1].
 */
Object.defineProperty(pc.Vec4, 'ONE', {
	get: (function () {
		var one = new pc.Vec4(1, 1, 1, 1);
		return function () {
			return one;
		};
	}())
});

/**
 * @field
 * @static
 * @readonly
 * @type pc.Vec4
 * @name pc.Vec4.ZERO
 * @description A constant vector set to [0, 0, 0, 0].
 */
Object.defineProperty(pc.Vec4, 'ZERO', {
	get: (function () {
		var zero = new pc.Vec4(0, 0, 0, 0);
		return function () {
			return zero;
		};
	}())
});

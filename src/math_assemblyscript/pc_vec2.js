vec2_constructor  = instance.exports["Vec2#constructor"];

vec2_add          = instance.exports["Vec2#add"];
vec2_add2         = instance.exports["Vec2#add2"];
vec2_clone        = instance.exports["Vec2#clone"];
vec2_copy         = instance.exports["Vec2#copy"];
vec2_dot          = instance.exports["Vec2#dot"];
vec2_equals       = instance.exports["Vec2#equals"];
vec2_length       = instance.exports["Vec2#length"];
vec2_lengthSq     = instance.exports["Vec2#lengthSq"];
vec2_lerp         = instance.exports["Vec2#lerp"];
vec2_mul          = instance.exports["Vec2#mul"];
vec2_mul2         = instance.exports["Vec2#mul2"];
vec2_normalize    = instance.exports["Vec2#normalize"];
vec2_scale        = instance.exports["Vec2#scale"];
vec2_set          = instance.exports["Vec2#set"];
vec2_sub          = instance.exports["Vec2#sub"];
vec2_sub2         = instance.exports["Vec2#sub2"];

pc.Vec2 = function(x, y) {
	if (x && x.length === 2) {
		this.ptr = vec2_constructor(0, x[0], x[1]);
	} else {
		this.ptr = vec2_constructor(0, x || 0, y || 0);
	}
}

pc.Vec2.wrap = function(ptr) {
	var tmp = Object.create(pc.Vec2.prototype);
	tmp.ptr = ptr;
	return tmp;
}

pc.Vec2.prototype.add = function(rhs) {
	vec2_add(this.ptr, rhs.ptr);
	return this;
}

pc.Vec2.prototype.add2 = function(lhs, rhs) {
	vec2_add2(this.ptr, lhs.ptr, rhs.ptr);
	return this;
}

pc.Vec2.prototype.clone = function() {
	var tmp = vec2_clone(this.ptr);
	return pc.Vec2.wrap(tmp);
}

pc.Vec2.prototype.copy = function(rhs) {
	vec2_copy(this.ptr, rhs.ptr);
	return this;
}

pc.Vec2.prototype.dot = function(rhs) {
	return vec2_dot(this.ptr, rhs.ptr);
}

pc.Vec2.prototype.equals = function(rhs) {
	return !!vec2_equals(this.ptr, rhs.ptr);
}

pc.Vec2.prototype.length = function() {
	return vec2_length(this.ptr);
}

pc.Vec2.prototype.lengthSq = function() {
	return vec2_lengthSq(this.ptr);
}

pc.Vec2.prototype.lerp = function(lhs, rhs, alpha) {
	vec2_lerp(this.ptr, lhs.ptr, rhs.ptr, alpha);
	return this;
}

pc.Vec2.prototype.mul = function(rhs) {
	vec2_mul(this.ptr, rhs.ptr);
	return this;
}

pc.Vec2.prototype.mul2 = function(lhs, rhs) {
	vec2_mul2(this.ptr, lhs.ptr, rhs.ptr);
	return this;
}

pc.Vec2.prototype.normalize = function() {
	vec2_normalize(this.ptr);
	return this;
}

pc.Vec2.prototype.scale = function(scalar) {
	vec2_scale(this.ptr, scalar);
	return this;
}

pc.Vec2.prototype.set = function(x, y) {
	vec2_set(this.ptr, x, y);
	return this;
}

pc.Vec2.prototype.sub = function(rhs) {
	vec2_sub(this.ptr, rhs.ptr);
	return this;
}

pc.Vec2.prototype.sub2 = function(lhs, rhs) {
	vec2_sub2(this.ptr, lhs.ptr, rhs.ptr);
	return this;
}

pc.Vec2.prototype.toString = function() {
	return '[' + this.x + ', ' + this.y + ']';
}

pc.Vec2.prototype.toStringFixed = function(n) {
	return '[' + this.x.toFixed(n) + ', ' + this.y.toFixed(n) + ']';
}

Object.defineProperty(pc.Vec2.prototype, 'x', {
	get: function() {
		return module.F32[this.ptr >> 2]; // the shifting is same as dividing by 4, used to quickly lookup the value in module.F32
	},
	set: function(newValue) {
		module.F32[this.ptr >> 2] = newValue;
	}
});

Object.defineProperty(pc.Vec2.prototype, 'y', {
	get: function() {
		return module.F32[(this.ptr >> 2) + 1];
	},
	set: function(newValue) {
		module.F32[(this.ptr >> 2) + 1] = newValue;
	}
});

Object.defineProperty(pc.Vec2, 'ONE', {
	get: (function () {
		var tmp = new pc.Vec2(1, 1);
		return function () {
			return tmp;
		};
	}())
});

Object.defineProperty(pc.Vec2, 'LEFT', {
	get: (function () {
		var tmp = new pc.Vec2(-1, 0);
		return function () {
			return tmp;
		};
	}())
});

Object.defineProperty(pc.Vec2, 'RIGHT', {
	get: (function () {
		var tmp = new pc.Vec2(1, 0);
		return function () {
			return tmp;
		};
	}())
});

Object.defineProperty(pc.Vec2, 'UP', {
	get: (function () {
		var tmp = new pc.Vec2(0, 1);
		return function () {
			return tmp;
		};
	}())
});

Object.defineProperty(pc.Vec2, 'DOWN', {
	get: (function () {
		var tmp = new pc.Vec2(0, -1);
		return function () {
			return tmp;
		};
	}())
});

Object.defineProperty(pc.Vec2, 'ZERO', {
	get: (function () {
		var tmp = new pc.Vec2(0, 0);
		return function () {
			return tmp;
		};
	}())
});

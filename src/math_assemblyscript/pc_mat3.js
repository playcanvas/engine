mat3_constructor  = instance.exports["Mat3#constructor"];

mat3_add          = instance.exports["Mat3#add"];
mat3_add2         = instance.exports["Mat3#add2"];
mat3_clone        = instance.exports["Mat3#clone"];
mat3_copy         = instance.exports["Mat3#copy"];
mat3_equals       = instance.exports["Mat3#equals"];
mat3_isIdentity   = instance.exports["Mat3#isIdentity"];
mat3_setIdentity  = instance.exports["Mat3#setIdentity"];
mat3_transpose    = instance.exports["Mat3#transpose"];
mat3_mul2         = instance.exports["Mat3#mul2"];
mat3_mul          = instance.exports["Mat3#mul"];

pc.Mat3 = function() {
	this.ptr = mat3_constructor(0);
	// if (module.tlfs) {
	//	this.bufferByteLength = 0;
	// } else {
		this.assignDataView();
	// }
}

pc.Mat3.wrap = function(ptr) {
	var tmp = Object.create(pc.Mat3.prototype);
	tmp.ptr = ptr;
	// if (module.tlfs) {
	//	tmp.bufferByteLength = 0;
	// } else {
		this.assignDataView();
	// }
	return tmp;
}

pc.Mat3.prototype.assignDataView = function() {
	//this.wrap = module.Mat3.wrap(this.ptr)
	this.data = new Float32Array(module.memory.buffer, this.ptr, 9);
}

pc.Mat3.prototype.add = function(rhs) {
	mat3_add(this.ptr, rhs.ptr);
	return this;
}

pc.Mat3.prototype.add2 = function(lhs, rhs) {
	mat3_add(this.ptr, lhs.ptr, rhs.ptr);
	return this;
}

pc.Mat3.prototype.clone = function() {
	var ptr = mat3_clone(this.ptr);
	var tmp = pc.Mat3.wrap(ptr);
	return tmp;
}

pc.Mat3.prototype.copy = function(rhs) {
	mat3_copy(this.ptr, rhs.ptr);
	return this;
}

pc.Mat3.prototype.set = function(src) {
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

	return this;
}

pc.Mat3.prototype.equals = function(rhs) {
	return !!mat3_equals(this.ptr, rhs.ptr);
}

pc.Mat3.prototype.isIdentity = function() {
	return !!mat3_isIdentity(this.ptr);
}

pc.Mat3.prototype.setIdentity = function() {
	mat3_setIdentity(this.ptr);
	return this;
}

pc.Mat3.prototype.transpose = function() {
	mat3_transpose(this.ptr);
	return this;
}

pc.Mat3.prototype.toString = function() {
	var t = '[';
	for (var i = 0; i < 9; i++) {
		t += this.data[i];
		t += (i !== 8) ? ', ' : '';
	}
	t += ']';
	return t;
}

pc.Mat3.prototype.toStringFixed = function(n) {
	var t = '[';
	for (var i = 0; i < 9; i++) {
		t += this.data[i].toFixed(n);
		t += (i !== 8) ? ', ' : '';
	}
	t += ']';
	return t;
}

Object.defineProperty(pc.Mat3, 'IDENTITY', {
	get: function () {
		var identity = new pc.Mat3();
		return function () {
			return identity;
		};
	}()
});

Object.defineProperty(pc.Mat3, 'ZERO', {
	get: function () {
		var zero = new pc.Mat3().set([0, 0, 0, 0, 0, 0, 0, 0, 0]);
		return function () {
			return zero;
		};
	}()
});

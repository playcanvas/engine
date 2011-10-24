module("pc.math.Mat3");
	
function approx(actual, expected, message) {
    var epsilon = 0.00001;
    var x = actual - expected;
    ok( x > -epsilon && x < epsilon, message);
}

test("identity", function() {
	var m = pc.math.mat4.identity;
	
	var identity = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
	
	for(var i=0 ; i<16; ++i) {
		same(m[i], identity[i]);
	}
});
	
test("create", function() {
	var m = pc.math.mat4.create();
    
    ok(m);	
});

test("clone", function() {
	var m = pc.math.mat4.create(1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16);
	var c = pc.math.mat4.clone(m);
	
	for(var i=0;i<16;++i) {
       same(m[i], c[i]);	
	}		
});
	
test("multiply", function() {});

test("multplyVec3", function() {
    var t = pc.math.mat4.create();
    var v = pc.math.vec3.create(1,0,0);
    var r = pc.math.vec3.create();
    
    pc.math.mat4.makeRotate(Math.PI / 2, pc.math.vec3.create(0,0,1), t);
    pc.math.mat4.multiplyVec3(v, 1, t, r);
    
    approx(r[0], 0);
    approx(r[1], 1);
    approx(r[2], 0);
});
	
test("multplyVec3: src and result same", function() {
    var t = pc.math.mat4.create();
    var v = pc.math.vec3.create(1,0,0);
    
    pc.math.mat4.makeRotate(Math.PI / 2, pc.math.vec3.create(0, 0, 1), t);
    pc.math.mat4.multiplyVec3(v, 1, t, v);
    
    approx(v[0], 0);
    approx(v[1], 1);
    approx(v[2], 0);    
});
	
test("makeLookAt", function() {
    var position = pc.math.vec3.create(0, 0, 10);
    var target   = pc.math.vec3.create(0, 0, 0);
    var up       = pc.math.vec3.create(0, 1, 0);

    var lookAt = pc.math.mat4.makeLookAt(position, target, up);

    same(lookAt[0], 1);
    same(lookAt[1], 0);
    same(lookAt[2], 0);
    same(lookAt[3], 0);

    same(lookAt[4], 0);
    same(lookAt[5], 1);
    same(lookAt[6], 0);
    same(lookAt[7], 0);

    same(lookAt[8], 0);
    same(lookAt[9], 0);
    same(lookAt[10], 1);
    same(lookAt[11], 0);

    same(lookAt[12], 0);
    same(lookAt[13], 0);
    same(lookAt[14], 10);
    same(lookAt[15], 1);
});

test("makeLookAt: 90deg", function () {
    var m = pc.math.mat4.clone(pc.math.mat4.identity);
    pc.math.mat4.makeRotate(Math.PI * 0.5, pc.math.vec3.create(0,1,0), m);
    var r = pc.math.mat4.create();
    var heading = pc.math.vec3.create(-m[8], -m[9], -m[10]);
    var left    = pc.math.vec3.create(m[0], m[1], m[2]);
    var up      = pc.math.vec3.create(m[4], m[5], m[6]);
    
    pc.math.mat4.makeLookAt(pc.math.vec3.create(0,0,0), heading, up, r);
    
    for(var index = 0; index < 16; index++) {
        equal(r[index], m[index]);
    }
});

test("makeLookAt: 180deg", function () {
    var m = pc.math.mat4.clone(pc.math.mat4.identity);
    pc.math.mat4.makeRotate(Math.PI, pc.math.vec3.create(0,1,0), m);
    var r = pc.math.mat4.create();
    var heading = pc.math.vec3.create(-m[8], -m[9], -m[10]);
    var left    = pc.math.vec3.create(m[0], m[1], m[2]);
    var up      = pc.math.vec3.create(m[4], m[5], m[6]);
    
    pc.math.mat4.makeLookAt(pc.math.vec3.create(0, 0, 0), heading, up, r);
    
    for(var index = 0; index < 16; index++) {
        equal(r[index], m[index]);
    }
});
	
test("MakeRotate", function() {});
	
test("makeTranslate", function() {
    var x = 10;
    var y = 20;
    var z = 30;
    
    // Test 1: create matrix internally
    var t = pc.math.mat4.makeTranslate(x, y, z);
    same(t[12], x);
    same(t[13], y);
    same(t[14], z);
    
    // Test 2: generate result in supplied matrix
    var r = pc.math.mat4.create();
    pc.math.mat4.makeTranslate(x, y, z, r);
    same(r[12], x);
    same(r[13], y);
    same(r[14], z);
});
	
test("makeFrustum", function() {

});
	
test("MakePerspective", function() {});
	
test("transpose", function() {
    var x = 10;
    var y = 20;
    var z = 30;
    var m = pc.math.mat4.makeTranslate(x, y, z);

    var mTrans = pc.math.mat4.transpose(m);
    var mTransTrans = pc.math.mat4.transpose(mTrans);
    
    deepEqual(m, mTransTrans);
});

test("transpose: same matrix for both arguments", function() {
    var x = 10;
    var y = 20;
    var z = 30;
    var m = pc.math.mat4.makeTranslate(x, y, z);
    var original = pc.math.mat4.clone(m);
    
    pc.math.mat4.transpose(m, m);
    pc.math.mat4.transpose(m, m);
    deepEqual(m, original);
});
	
test("invert", function() {
    var x = 10;
    var y = 20;
    var z = 30;
    var m = pc.math.mat4.makeTranslate(x, y, z);
    var original = pc.math.mat4.clone(m);
    
    var mInvert = pc.math.mat4.invert(m);
    var result = pc.math.mat4.multiply(m, mInvert, result);
    
    deepEqual(result, pc.math.mat4.identity);
});

test("invert: same matrix for both arguments", function() {
    var x = 10;
    var y = 20;
    var z = 30;
    var m = pc.math.mat4.makeTranslate(x, y, z);
    var original = pc.math.mat4.clone(m);
    
    pc.math.mat4.invert(m, m);
    var result = pc.math.mat4.multiply(m, original, result);
    
    deepEqual(result, pc.math.mat4.identity);
});

test("getTranslation", function() {
    var m = pc.math.mat4.create(1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16);
    var t = pc.math.mat4.getTranslation(m);
    
    same(t[0], 13);
    same(t[1], 14);
    same(t[2], 15);
});

test("toEulerXYZ", function () {
    var m, e;
    
    m = pc.math.mat4.create(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1);
    e = pc.math.mat4.toEulerXYZ(m);
    
    equal(e[0], 0);
    equal(e[1], 0);
    equal(e[2], 0);

    m = pc.math.mat4.create(1,0,0,0, 0,0,1,0, 0,-1,0,0, 0,0,0,1);
    e = pc.math.mat4.toEulerXYZ(m);
    
    approx(e[0], -Math.PI / 2);
    equal(e[1], 0);
    equal(e[2], 0);

    m = pc.math.mat4.create(1,0,0,0 ,0,1,0,0, 0,0,1,0, 0,0,0,1);
    e = pc.math.mat4.toEulerXYZ(m);
    
    equal(e[0], 0);
    equal(e[1], 0);
    equal(e[2], 0);

});

test("fromEulerXYZ", function () {
    var m, x, y, z;
    
    x = y = z = 0;
    m = pc.math.mat4.fromEulerXYZ(x,y,z);
    
    equal(m[0], 1);
    equal(m[1], 0);
    equal(m[2], 0);
    equal(m[3], 0);
    equal(m[5], 1);
    equal(m[10], 1);
    equal(m[15], 1);
    
    x = Math.PI / 2;
    m = pc.math.mat4.fromEulerXYZ(x,y,z);
    
    equal(m[0], 1);
    equal(m[6], -1);
    equal(m[9], 1);
    equal(m[15], 1);
});

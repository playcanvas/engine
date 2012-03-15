module("pc.math.mat4");
	
function approx(actual, expected, message) {
    var epsilon = 0.00001;
    var x = actual - expected;
    ok( x > -epsilon && x < epsilon, message);
}
	
test("create", function() {
	var m = pc.math.mat4.create();
    ok(m);	

    // Check the matrix is identity
	var identity = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
	for(var i=0 ; i<16; ++i) {
		same(m[i], identity[i]);
	}
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
    var m = pc.math.mat4.create();
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
    var m = pc.math.mat4.create();
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
    
    deepEqual(result, pc.math.mat4.create());
});

test("invert: same matrix for both arguments", function() {
    var x = 10;
    var y = 20;
    var z = 30;
    var m = pc.math.mat4.makeTranslate(x, y, z);
    var original = pc.math.mat4.clone(m);
    
    pc.math.mat4.invert(m, m);
    var result = pc.math.mat4.multiply(m, original, result);
    
    deepEqual(result, pc.math.mat4.create());
});

test("getX", function () {
    var m = pc.math.mat4.create(1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16);
    var v1 = pc.math.mat4.getX(m);

    same(v1[0], 1);
    same(v1[1], 2);
    same(v1[2], 3);

    // use existing vector
    var v2 = pc.math.vec3.create();
    pc.math.mat4.getX(m, v2);

    same(v2[0], 1);
    same(v2[1], 2);
    same(v2[2], 3);
});

test("getY", function () {
    var m = pc.math.mat4.create(1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16);
    var v1 = pc.math.mat4.getY(m);

    same(v1[0], 5);
    same(v1[1], 6);
    same(v1[2], 7);

    // use existing vector
    var v2 = pc.math.vec3.create();
    pc.math.mat4.getY(m, v2);

    same(v2[0], 5);
    same(v2[1], 6);
    same(v2[2], 7);
});

test("getZ", function () {
    var m = pc.math.mat4.create(1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16);
    var v1 = pc.math.mat4.getZ(m);

    same(v1[0], 9);
    same(v1[1], 10);
    same(v1[2], 11);

    // use existing vector
    var v2 = pc.math.vec3.create();
    pc.math.mat4.getZ(m, v2);

    same(v2[0], 9);
    same(v2[1], 10);
    same(v2[2], 11);
});

test("getTranslation", function() {
    var m = pc.math.mat4.create(1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16);
    var t = pc.math.mat4.getTranslation(m);
    
    same(t[0], 13);
    same(t[1], 14);
    same(t[2], 15);

    var t2 = pc.math.vec3.create();
    pc.math.mat4.getTranslation(m, t2);
    
    same(t2[0], 13);
    same(t2[1], 14);
    same(t2[2], 15);

});

test("getScale", function() {
    var m = pc.math.mat4.create(2,0,0,1,0,3,0,1,0,0,4,1,0,0,0,1);
    var v = pc.math.mat4.getScale(m);
    
    same(v[0], 2);
    same(v[1], 3);
    same(v[2], 4);

    var v2 = pc.math.vec3.create();
    pc.math.mat4.getScale(m, v2);
    
    same(v2[0], 2);
    same(v2[1], 3);
    same(v2[2], 4);

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
    approx(e[0], Math.PI / 2, e[0].toString() + " ~= " + Math.PI / 2);
    equal(e[1], 0);
    equal(e[2], 0);

    m = pc.math.mat4.create(1,0,0,0 ,0,1,0,0, 0,0,1,0, 0,0,0,1);
    e = pc.math.mat4.toEulerXYZ(m);
    equal(e[0], 0);
    equal(e[1], 0);
    equal(e[2], 0);
    
    m = [0.7071067811865476,0,0.7071067811865476,0,0,1,0,0,-0.7071067811865476,0,0.7071067811865476,0,0,0,0,1]
    e = pc.math.mat4.toEulerXYZ(m);
    equal(e[0], 0);
    approx(e[1], -Math.PI / 4, e[1].toString() + " ~= " + -Math.PI/4);
    equal(e[2], 0);

    m = [1,0,0,0, 0,0.7071067811865476,-0.7071067811865476,0, 0,0.7071067811865476,0.7071067811865476,0, 0,0,0,1]
    e = pc.math.mat4.toEulerXYZ(m);
    approx(e[0], -Math.PI / 4, e[0].toString() + " ~= " + -Math.PI/4);
    equal(e[1], 0);
    equal(e[2], 0);

    m = [0.7071067811865476,-0.7071067811865476,0,0, 0.7071067811865476,0.7071067811865476,0,0, 0,0,1,0, 0,0,0,1]
    e = pc.math.mat4.toEulerXYZ(m);
    equal(e[0], 0);
    equal(e[1], 0);
    approx(e[2], -Math.PI / 4, e[2].toString() + " ~= " + -Math.PI/4);

});

test("fromEulerXYZ", function () {
    var m, x, y, z;
    
    /** clip to 3 decimal places and convert to string for comparison **/
    var clip = function (m) {
        var i,l = m.length;
        var a = [];
        for(i = 0;i < l; i++) {
            a[i] = parseFloat(m[i].toFixed(3));
        }
        
        return a;
    };
    
    // no rotation -> identity
    x = y = z = 0;
    m = pc.math.mat4.fromEulerXYZ(x,y,z);
    deepEqual(m, new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]));

    // Rotate 45 around y
    y = Math.PI / 4;
    x = z = 0;
    m = pc.math.mat4.fromEulerXYZ(x,y,z);
    deepEqual(clip(m), [0.707,0,-0.707,0,0,1,0,0,0.707,0,0.707,0, 0,0,0,1]);

    // Rotate 45 around x
    x = Math.PI / 4;
    y = z = 0;
    m = pc.math.mat4.fromEulerXYZ(x,y,z);
    deepEqual(clip(m), [1,0,0,0, 0,0.707,0.707,0, 0,-0.707,0.707,0, 0,0,0,1]);

    // Rotate 45 around z
    z = Math.PI / 4;
    y = x = 0;
    m = pc.math.mat4.fromEulerXYZ(x,y,z);
    deepEqual(clip(m), [0.707,0.707,0,0, -0.707,0.707,0,0, 0,0,1,0, 0,0,0,1]);

});

test("fromEuler and back", function () {
    var clip = function (m) {
        var i,l = m.length;
        var a = []
        for(i = 0;i < l; i++) {
            a[i] = parseFloat(m[i].toFixed(3));
        }
        
        return a;
    };
    
    var m1 = [0.7071067811865476,0,0.7071067811865476,0,0,1,0,0,-0.7071067811865476,0,0.7071067811865476,0, 0,0,0,1];
    var m2

    var r = pc.math.mat4.toEulerXYZ(m1);
    m2 = pc.math.mat4.fromEulerXYZ(r[0], r[1], r[2]);
    
    deepEqual(clip(m1),clip(m2));
});

/*

test("makeRotate", function() {
    ok(false, "Not written");
});    
    
test("makeFrustum", function() {
    ok(false, "Not written")
});
    
test("makePerspective", function() {
    ok(false, "Not written");
});

*/
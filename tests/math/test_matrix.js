module("pc.math.mat4");

function approx(actual, expected, message) {
    var epsilon = 0.00001;
    var delta = actual - expected;
    QUnit.ok( Math.abs(delta) < epsilon, message);
}

test("create", function() {
	var m = pc.math.mat4.create();
    ok(m);	

    // Check the matrix is identity
	var identity = new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
	for(var i=0 ; i<16; ++i) {
		QUnit.equal(m[i], identity[i]);
	}
});

test("clone", function() {
	var m = pc.math.mat4.create(1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16);
	var c = pc.math.mat4.clone(m);
	
	for(var i=0;i<16;++i) {
       QUnit.equal(m[i], c[i]);	
	}
});
	
test("multiply: I*I = I", function() {
    var m1 = pc.math.mat4.create();
    var m2 = pc.math.mat4.create();
    var m3 = pc.math.mat4.create();

    var r = pc.math.mat4.multiply(m1, m2);
    QUnit.deepEqual(r, m3);
});

test("multiply: I*A = A", function() {
    var m1 = pc.math.mat4.create();
    var m2 = pc.math.mat4.makeRotate(180 / 8, [0, 1, 0]);

    var r = pc.math.mat4.multiply(m1, m2);
    QUnit.deepEqual(r, m2);
});

test("multiply: A*I = A", function() {
    var m1 = pc.math.mat4.makeRotate(180 / 8, [0, 1, 0]);
    var m2 = pc.math.mat4.create();

    var r = pc.math.mat4.multiply(m1, m2);
    QUnit.deepEqual(r, m1);
});

test("multplyVec3", function() {
    var t = pc.math.mat4.create();
    var v = pc.math.vec3.create(1,0,0);
    var r = pc.math.vec3.create();
    
    pc.math.mat4.makeRotate(90, pc.math.vec3.create(0,0,1), t);
    pc.math.mat4.multiplyVec3(v, 1, t, r);
    
    approx(r[0], 0);
    approx(r[1], 1);
    approx(r[2], 0);
});

test("multplyVec3: src and result same", function() {
    var t = pc.math.mat4.create();
    var v = pc.math.vec3.create(1,0,0);
    
    pc.math.mat4.makeRotate(90, pc.math.vec3.create(0, 0, 1), t);
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

    QUnit.equal(lookAt[0], 1);
    QUnit.equal(lookAt[1], 0);
    QUnit.equal(lookAt[2], 0);
    QUnit.equal(lookAt[3], 0);

    QUnit.equal(lookAt[4], 0);
    QUnit.equal(lookAt[5], 1);
    QUnit.equal(lookAt[6], 0);
    QUnit.equal(lookAt[7], 0);

    QUnit.equal(lookAt[8], 0);
    QUnit.equal(lookAt[9], 0);
    QUnit.equal(lookAt[10], 1);
    QUnit.equal(lookAt[11], 0);

    QUnit.equal(lookAt[12], 0);
    QUnit.equal(lookAt[13], 0);
    QUnit.equal(lookAt[14], 10);
    QUnit.equal(lookAt[15], 1);
});

test("makeLookAt: 90deg", function () {
    var m = pc.math.mat4.create();
    pc.math.mat4.makeRotate(90, pc.math.vec3.create(0,1,0), m);
    var r = pc.math.mat4.create();
    var heading = pc.math.vec3.create(-m[8], -m[9], -m[10]);
    var left    = pc.math.vec3.create(m[0], m[1], m[2]);
    var up      = pc.math.vec3.create(m[4], m[5], m[6]);
    
    pc.math.mat4.makeLookAt(pc.math.vec3.create(0,0,0), heading, up, r);
    
    for(var index = 0; index < 16; index++) {
        QUnit.equal(r[index], m[index]);
    }
});

test("makeLookAt: 180deg", function () {
    var m = pc.math.mat4.create();
    pc.math.mat4.makeRotate(90, pc.math.vec3.create(0,1,0), m);
    var r = pc.math.mat4.create();
    var heading = pc.math.vec3.create(-m[8], -m[9], -m[10]);
    var left    = pc.math.vec3.create(m[0], m[1], m[2]);
    var up      = pc.math.vec3.create(m[4], m[5], m[6]);
    
    pc.math.mat4.makeLookAt(pc.math.vec3.create(0, 0, 0), heading, up, r);
    
    for(var index = 0; index < 16; index++) {
        QUnit.equal(r[index], m[index]);
    }
});
	
test("makeTranslate", function() {
    var x = 10;
    var y = 20;
    var z = 30;
    
    // Test 1: create matrix internally
    var t = pc.math.mat4.makeTranslate(x, y, z);
    QUnit.equal(t[12], x);
    QUnit.equal(t[13], y);
    QUnit.equal(t[14], z);
    
    // Test 2: generate result in supplied matrix
    var r = pc.math.mat4.create();
    pc.math.mat4.makeTranslate(x, y, z, r);
    QUnit.equal(r[12], x);
    QUnit.equal(r[13], y);
    QUnit.equal(r[14], z);
});

	
test("transpose", function() {
    var x = 10;
    var y = 20;
    var z = 30;
    var m = pc.math.mat4.makeTranslate(x, y, z);

    var mTrans = pc.math.mat4.transpose(m);
    var mTransTrans = pc.math.mat4.transpose(mTrans);
    
    QUnit.deepEqual(m, mTransTrans);
});

test("transpose: same matrix for both arguments", function() {
    var x = 10;
    var y = 20;
    var z = 30;
    var m = pc.math.mat4.makeTranslate(x, y, z);
    var original = pc.math.mat4.clone(m);
    
    pc.math.mat4.transpose(m, m);
    pc.math.mat4.transpose(m, m);
    QUnit.deepEqual(m, original);
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
    
    QUnit.deepEqual(result, pc.math.mat4.create());
});

test("getX", function () {
    var m = pc.math.mat4.create(1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16);
    var v1 = pc.math.mat4.getX(m);

    QUnit.equal(v1[0], 1);
    QUnit.equal(v1[1], 2);
    QUnit.equal(v1[2], 3);

    // use existing vector
    var v2 = pc.math.vec3.create();
    pc.math.mat4.getX(m, v2);

    QUnit.equal(v2[0], 1);
    QUnit.equal(v2[1], 2);
    QUnit.equal(v2[2], 3);
});

test("getY", function () {
    var m = pc.math.mat4.create(1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16);
    var v1 = pc.math.mat4.getY(m);

    QUnit.equal(v1[0], 5);
    QUnit.equal(v1[1], 6);
    QUnit.equal(v1[2], 7);

    // use existing vector
    var v2 = pc.math.vec3.create();
    pc.math.mat4.getY(m, v2);

    QUnit.equal(v2[0], 5);
    QUnit.equal(v2[1], 6);
    QUnit.equal(v2[2], 7);
});

test("getZ", function () {
    var m = pc.math.mat4.create(1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16);
    var v1 = pc.math.mat4.getZ(m);

    QUnit.equal(v1[0], 9);
    QUnit.equal(v1[1], 10);
    QUnit.equal(v1[2], 11);

    // use existing vector
    var v2 = pc.math.vec3.create();
    pc.math.mat4.getZ(m, v2);

    QUnit.equal(v2[0], 9);
    QUnit.equal(v2[1], 10);
    QUnit.equal(v2[2], 11);
});

test("getTranslation", function() {
    var m = pc.math.mat4.create(1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16);
    var t = pc.math.mat4.getTranslation(m);
    
    QUnit.equal(t[0], 13);
    QUnit.equal(t[1], 14);
    QUnit.equal(t[2], 15);

    var t2 = pc.math.vec3.create();
    pc.math.mat4.getTranslation(m, t2);
    
    QUnit.equal(t2[0], 13);
    QUnit.equal(t2[1], 14);
    QUnit.equal(t2[2], 15);

});

test("getScale", function() {
    var m = pc.math.mat4.create(2,0,0,1,0,3,0,1,0,0,4,1,0,0,0,1);
    var v = pc.math.mat4.getScale(m);
    
    QUnit.equal(v[0], 2);
    QUnit.equal(v[1], 3);
    QUnit.equal(v[2], 4);

    var v2 = pc.math.vec3.create();
    pc.math.mat4.getScale(m, v2);
    
    QUnit.equal(v2[0], 2);
    QUnit.equal(v2[1], 3);
    QUnit.equal(v2[2], 4);

});


test("toEulerXYZ", function () {
    var m, e;
    
    m = pc.math.mat4.create(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1);
    e = pc.math.mat4.toEulerXYZ(m);
    QUnit.equal(e[0], 0);
    QUnit.equal(e[1], 0);
    QUnit.equal(e[2], 0);

    m = pc.math.mat4.create(1,0,0,0, 0,0,1,0, 0,-1,0,0, 0,0,0,1);
    e = pc.math.mat4.toEulerXYZ(m);
    approx(e[0], 90, e[0].toString() + " ~= " + 90);
    QUnit.equal(e[1], 0);
    QUnit.equal(e[2], 0);

    m = pc.math.mat4.create(1,0,0,0 ,0,1,0,0, 0,0,1,0, 0,0,0,1);
    e = pc.math.mat4.toEulerXYZ(m);
    QUnit.equal(e[0], 0);
    QUnit.equal(e[1], 0);
    QUnit.equal(e[2], 0);
    
    m = [0.7071067811865476,0,0.7071067811865476,0,0,1,0,0,-0.7071067811865476,0,0.7071067811865476,0,0,0,0,1]
    e = pc.math.mat4.toEulerXYZ(m);
    QUnit.equal(e[0], 0);
    approx(e[1], -45, e[1].toString() + " ~= " + -45);
    QUnit.equal(e[2], 0);

    m = [1,0,0,0, 0,0.7071067811865476,-0.7071067811865476,0, 0,0.7071067811865476,0.7071067811865476,0, 0,0,0,1]
    e = pc.math.mat4.toEulerXYZ(m);
    approx(e[0], -45, e[0].toString() + " ~= " + -45);
    QUnit.equal(e[1], 0);
    QUnit.equal(e[2], 0);

    m = [0.7071067811865476,-0.7071067811865476,0,0, 0.7071067811865476,0.7071067811865476,0,0, 0,0,1,0, 0,0,0,1]
    e = pc.math.mat4.toEulerXYZ(m);
    QUnit.equal(e[0], 0);
    QUnit.equal(e[1], 0);
    approx(e[2], -45, e[2].toString() + " ~= " + -45);
});

test("fromEulerXYZ", function () {
    var m, mr, mrx, mry, mrz, x, y, z;

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
    QUnit.deepEqual(m, new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]));

    // Rotate 45 around y
    y = 45;
    x = z = 0;
    m = pc.math.mat4.fromEulerXYZ(x,y,z);
    var m1 = pc.math.mat4.makeRotate(y, [0, 1, 0]);
    QUnit.deepEqual(clip(m), [0.707,0,-0.707,0,0,1,0,0,0.707,0,0.707,0, 0,0,0,1]);

    // Rotate 45 around x
    x = 45;
    y = z = 0;
    m = pc.math.mat4.fromEulerXYZ(x,y,z);
    QUnit.deepEqual(clip(m), [1,0,0,0, 0,0.707,0.707,0, 0,-0.707,0.707,0, 0,0,0,1]);

    // Rotate 45 around z
    z = 45;
    y = x = 0;
    m = pc.math.mat4.fromEulerXYZ(x,y,z);
    QUnit.deepEqual(clip(m), [0.707,0.707,0,0, -0.707,0.707,0,0, 0,0,1,0, 0,0,0,1]);

    // Arbitrary rotation
    x = 33;
    y = 44;
    z = 55;
    m = pc.math.mat4.fromEulerXYZ(x,y,z);
    mrx = pc.math.mat4.makeRotate(x, [1, 0, 0]);
    mry = pc.math.mat4.makeRotate(y, [0, 1, 0]);
    mrz = pc.math.mat4.makeRotate(z, [0, 0, 1]);
    mr = pc.math.mat4.multiply(mrz, mry);
    pc.math.mat4.multiply(mr, mrx, mr);
    QUnit.deepEqual(clip(m), clip(mr));
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
    var m2;

    var r = pc.math.mat4.toEulerXYZ(m1);
    m2 = pc.math.mat4.fromEulerXYZ(r[0], r[1], r[2]);
    
    QUnit.deepEqual(clip(m1),clip(m2));
});

test("compose", function() {
    var clip = function (m) {
        var i,l = m.length;
        var a = []
        for(i = 0;i < l; i++) {
            a[i] = parseFloat(m[i].toFixed(3));
        }
        
        return a;
    };

    var tx = 10;
    var ty = 20;
    var tz = 30;

    var t = pc.math.vec3.create(tx, ty, tz);
    var r = pc.math.quat.create(0, 0, Math.sqrt(0.5), Math.sqrt(0.5));
    var s = pc.math.vec3.create(2, 2, 2);
    var m1 = pc.math.mat4.compose(t, r, s);

    var mt = pc.math.mat4.makeTranslate(tx, ty, tz);
    var mr = pc.math.mat4.makeRotate(90, [0, 0, 1]);
    var ms = pc.math.mat4.makeScale(2, 2, 2);
    var temp = pc.math.mat4.multiply(mt, mr);
    var m2 = pc.math.mat4.multiply(temp, ms);

    for (var i = 0; i < m1.length; i++) {
        QUnit.close(m1[i], m2[i], 0.0001);
    }

    t = pc.math.vec3.create(tx, ty, tz);
    r = pc.math.quat.create(0, Math.sqrt(0.5), 0, Math.sqrt(0.5));
    s = pc.math.vec3.create(2, 3, 4);
    m1 = pc.math.mat4.compose(t, r, s);
    m2 = [0, 0, -2, 0, 0, 3, 0, 0, 4, 0, 0, 0, 10, 20, 30, 1];

    QUnit.deepEqual(clip(m1),clip(m2));
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
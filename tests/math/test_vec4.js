module("pc.Vec4");

test("x", function() {
    var v1 = new pc.Vec4(2, 4, 6, 8);
    QUnit.equal(2, v1.x);
});

test("y", function() {
    var v1 = new pc.Vec4(2, 4, 6, 8);
    QUnit.equal(4, v1.y);
});

test("z", function() {
    var v1 = new pc.Vec4(2, 4, 6, 8);
    QUnit.equal(6, v1.z);
});

test("w", function() {
    var v1 = new pc.Vec4(2, 4, 6, 8);
    QUnit.equal(8, v1.w);
});

test("add2", function() {
    var v1 = new pc.Vec4(2, 4, 6, 8);
    var v2 = new pc.Vec4(1, 2, 3, 4);
    var r = new pc.Vec4();

    r.add2(v1, v2);

    QUnit.equal(3, r.x);
    QUnit.equal(6, r.y);
    QUnit.equal(9, r.z);
    QUnit.equal(12, r.w);
});
 
test("clone", function () {
    var v1 = new pc.Vec4();
    var v2 = v1.clone();

    QUnit.ok(typeof v2 === "object");

    QUnit.equal(v1.x, v2.x);
    QUnit.equal(v1.y, v2.y);
    QUnit.equal(v1.z, v2.z);
    QUnit.equal(v1.w, v2.w);
});
    
test("copy", function () {
    var v1 = new pc.Vec4(2, 4, 6, 8);
    var v2 = new pc.Vec4();

    v2.copy(v1);

    QUnit.equal(2, v2.x);
    QUnit.equal(4, v2.y);
    QUnit.equal(6, v2.z);
    QUnit.equal(8, v2.w);
});

test("constructor: no args", function () { 
    var v = new pc.Vec4();

    QUnit.equal(4, v.data.length);
    QUnit.equal(v.x, 0);
    QUnit.equal(v.y, 0);
    QUnit.equal(v.z, 0);
    QUnit.equal(v.w, 0);
});


test("constructor: args", function() {
    var v = new pc.Vec4(1, 2, 3, 4);

    QUnit.equal(4, v.data.length);
    QUnit.equal(1, v.x);
    QUnit.equal(2, v.y);
    QUnit.equal(3, v.z);
    QUnit.equal(4, v.w);
});

test("dot", function() {
    var v1 = new pc.Vec4(1, 2, 3, 4);
    var v2 = new pc.Vec4(5, 6, 7, 8);

    var r = v1.dot(v2);

    QUnit.equal(r, 70);
});

test("equals", function() {
    var v1 = new pc.Vec4(1, 2, 3, 4);
    var v2 = new pc.Vec4(5, 6, 7, 8);

    var e = v1.equals(v2);
    QUnit.equal(false, e);

    var e = v1.equals(v1);
    QUnit.equal(true, e);
});

test("length", function() {
    var v = new pc.Vec4(0, 3, 4, 0);
    var l = v.length();
    QUnit.equal(5, l);
});

test("lengthSq", function() {
    var v = new pc.Vec4(0, 3, 4, 0);
    var l = v.lengthSq();
    QUnit.equal(25, l);
});

test("lerp", function() {
    var v1 = new pc.Vec4(1, 2, 3, 4);
    var v2 = new pc.Vec4(5, 6, 7, 8);
    var r = new pc.Vec4();

    r.lerp(v1, v2, 0);

    QUnit.equal(v1.x, r.x);
    QUnit.equal(v1.y, r.y);
    QUnit.equal(v1.z, r.z);
    QUnit.equal(v1.w, r.w);

    r.lerp(v1, v2, 1);

    QUnit.equal(v2.x, r.x);
    QUnit.equal(v2.y, r.y);
    QUnit.equal(v2.z, r.z);
    QUnit.equal(v2.w, r.w);
});

test("mul", function() {
    var v1 = new pc.Vec4(1, 2, 3, 4);
    var v2 = new pc.Vec4(5, 6, 7, 8);

    v1.mul(v2);

    QUnit.equal(5, v1.x);
    QUnit.equal(12, v1.y);
    QUnit.equal(21, v1.z);
    QUnit.equal(32, v1.w);
});

test("mul2", function() {
    var v1 = new pc.Vec4(1, 2, 3, 4);
    var v2 = new pc.Vec4(5, 6, 7, 8);
    var r = new pc.Vec4();

    r.mul2(v1, v2);

    QUnit.equal(5, r.x);
    QUnit.equal(12, r.y);
    QUnit.equal(21, r.z);
    QUnit.equal(32, r.w);
});

test("normalize", function(){
    var x = new pc.Vec4(10, 0, 0, 0);
    var y = new pc.Vec4(0, 10, 0, 0);
    var z = new pc.Vec4(0, 0, 10, 0);
    var w = new pc.Vec4(0, 0, 0, 10);

    x.normalize()
    QUnit.equal(1, x.x);
    QUnit.equal(0, x.y);
    QUnit.equal(0, x.z);
    QUnit.equal(0, x.w);

    y.normalize()
    QUnit.equal(0, y.x);
    QUnit.equal(1, y.y);
    QUnit.equal(0, y.z);
    QUnit.equal(0, y.w);
    
    z.normalize()
    QUnit.equal(0, z.x);
    QUnit.equal(0, z.y);
    QUnit.equal(1, z.z);
    QUnit.equal(0, z.w);
    
    w.normalize()
    QUnit.equal(0, w.x);
    QUnit.equal(0, w.y);
    QUnit.equal(0, w.z);
    QUnit.equal(1, w.w);
});

test("scale", function() {
    var v = new pc.Vec4(1, 2, 3, 4);
    v.scale(2);

    QUnit.equal(2, v.x);
    QUnit.equal(4, v.y);
    QUnit.equal(6, v.z);
    QUnit.equal(8, v.w);
});

test("set", function() {
    var v1 = new pc.Vec4();

    v1.set(2, 4, 6, 8);

    QUnit.equal(2, v1.x);
    QUnit.equal(4, v1.y);
    QUnit.equal(6, v1.z);
    QUnit.equal(8, v1.w);
});

test("sub", function() {
    var v1 = new pc.Vec4(1, 2, 3, 4);
    var v2 = new pc.Vec4(5, 6, 7, 8);

    v1.sub(v2);

    QUnit.equal(-4, v1.x);
    QUnit.equal(-4, v1.y);
    QUnit.equal(-4, v1.z);
    QUnit.equal(-4, v1.w);
});

test("sub2", function() {
    var v1 = new pc.Vec4(1, 2, 3, 4);
    var v2 = new pc.Vec4(5, 6, 7, 8);
    var r = new pc.Vec4();

    r.sub2(v1, v2);

    QUnit.equal(-4, r.x);
    QUnit.equal(-4, r.y);
    QUnit.equal(-4, r.z);
    QUnit.equal(-4, r.w);
});

test("toString", function() {
    var v1 = new pc.Vec4(2, 4, 6, 8);

    var s = v1.toString();

    QUnit.equal(s, '[2, 4, 6, 8]');
});

module("pc.Vec3");

test("x", function() {
    var v1 = new pc.Vec3(2, 4, 6);
    QUnit.equal(2, v1.x);
});

test("y", function() {
    var v1 = new pc.Vec3(2, 4, 6);
    QUnit.equal(4, v1.y);
});

test("z", function() {
    var v1 = new pc.Vec3(2, 4, 6);
    QUnit.equal(6, v1.z);
});

test("add2", function() {
    var v1 = new pc.Vec3(2, 4, 6);
    var v2 = new pc.Vec3(1, 2, 3);
    var r = new pc.Vec3();

    r.add2(v1, v2);

    QUnit.equal(3, r.x);
    QUnit.equal(6, r.y);
    QUnit.equal(9, r.z);
});

test("clone", function () {
    var v1 = new pc.Vec3();
    var v2 = v1.clone();

    QUnit.ok(typeof v2 === "object");

    QUnit.equal(v1.x, v2.x);
    QUnit.equal(v1.y, v2.y);
    QUnit.equal(v1.z, v2.z);
});

test("copy", function () {
    var v1 = new pc.Vec3(2, 4, 6);
    var v2 = new pc.Vec3();

    v2.copy(v1);

    QUnit.equal(2, v2.x);
    QUnit.equal(4, v2.y);
    QUnit.equal(6, v2.z);
});

test("constructor: no args", function () {
    var v = new pc.Vec3();

    QUnit.equal(3, v.data.length);
    QUnit.equal(v.x, 0);
    QUnit.equal(v.y, 0);
    QUnit.equal(v.z, 0);
});


test("constructor: args", function() {
    var v = new pc.Vec3(1, 2, 3);

    QUnit.equal(3, v.data.length);
    QUnit.equal(1, v.x);
    QUnit.equal(2, v.y);
    QUnit.equal(3, v.z);
});

test("cross", function() {
    var v1 = new pc.Vec3(1, 0, 0);
    var v2 = new pc.Vec3(0, 1, 0);
    var r = new pc.Vec3();

    r.cross(v1, v2);

    QUnit.equal(0, r.x);
    QUnit.equal(0, r.y);
    QUnit.equal(1, r.z);
});

test("dot", function() {
    var v1 = new pc.Vec3(1, 2, 3);
    var v2 = new pc.Vec3(4, 5, 6);

    var r = v1.dot(v2);

    QUnit.equal(r, 32);
});

test("dot: parallel", function() {
    var v1 = new pc.Vec3(0, 1, 0);
    var v2 = new pc.Vec3(0, 1, 0);

    var r = v1.dot(v2);

    QUnit.equal(r, 1);
});

test("dot: perpendicular", function() {
    var v1 = new pc.Vec3(1, 0, 0);
    var v2 = new pc.Vec3(0, 1, 0);

    var r = v1.dot(v2);

    QUnit.equal(r, 0);
});

test("equals", function() {
    var v1 = new pc.Vec3(1, 0, 0);
    var v2 = new pc.Vec3(0, 1, 0);

    var e = v1.equals(v2);
    QUnit.equal(false, e);

    var e = v1.equals(v1);
    QUnit.equal(true, e);
});

test("length", function() {
    var v = new pc.Vec3(0, 3, 4);
    var l = v.length();
    QUnit.equal(5, l);
});

test("lengthSq", function() {
    var v = new pc.Vec3(0, 3, 4);
    var l = v.lengthSq();
    QUnit.equal(25, l);
});

test("lerp", function() {
    var v0 = new pc.Vec3(1, 2, 3);
    var v1 = new pc.Vec3(4, 5, 6);
    var r = new pc.Vec3();

    r.lerp(v0, v1, 0);

    QUnit.equal(v0.x, r.x);
    QUnit.equal(v0.y, r.y);
    QUnit.equal(v0.z, r.z);

    r.lerp(v0, v1, 1);

    QUnit.equal(v1.x, r.x);
    QUnit.equal(v1.y, r.y);
    QUnit.equal(v1.z, r.z);
});

test("mul", function() {
    var v1 = new pc.Vec3(1, 2, 3);
    var v2 = new pc.Vec3(4, 5, 6);
    v1.mul(v2);

    QUnit.equal(4, v1.x);
    QUnit.equal(10, v1.y);
    QUnit.equal(18, v1.z);
});

test("mul2", function() {
    var v1 = new pc.Vec3(1, 2, 3);
    var v2 = new pc.Vec3(1, 2, 3);
    var r = new pc.Vec3();
    r.mul2(v1, v2);

    QUnit.equal(1, r.x);
    QUnit.equal(4, r.y);
    QUnit.equal(9, r.z);
});

test("normalize", function(){
    var x = new pc.Vec3(10, 0, 0);
    var y = new pc.Vec3(0, 10, 0);
    var z = new pc.Vec3(0, 0, 10);

    x.normalize()
    QUnit.equal(1, x.x);
    QUnit.equal(0, x.y);
    QUnit.equal(0, x.z);

    y.normalize()
    QUnit.equal(0, y.x);
    QUnit.equal(1, y.y);
    QUnit.equal(0, y.z);

    z.normalize()
    QUnit.equal(0, z.x);
    QUnit.equal(0, z.y);
    QUnit.equal(1, z.z);
});

test("project", function () {
    var v = new pc.Vec3(1,0,0);
    var p = new pc.Vec3(5,5,5);
    p.project(v);
    QUnit.equal(p.x, 5);
    QUnit.equal(p.y, 0);
    QUnit.equal(p.z, 0);
});

test("project negative", function () {
    var v = new pc.Vec3(-1,0,0);
    var p = new pc.Vec3(5,5,5);
    p.project(v);
    QUnit.equal(p.x, 5);
    QUnit.equal(p.y, 0);
    QUnit.equal(p.z, 0);
});

test("scale", function() {
    var v = new pc.Vec3(1, 2, 3);
    v.scale(2);

    QUnit.equal(2, v.x);
    QUnit.equal(4, v.y);
    QUnit.equal(6, v.z);
});

test("set", function() {
    var v1 = new pc.Vec3();

    v1.set(2, 4, 6);

    QUnit.equal(2, v1.x);
    QUnit.equal(4, v1.y);
    QUnit.equal(6, v1.z);
});

test("sub", function() {
    var v1 = new pc.Vec3(2, 4, 6);
    var v2 = new pc.Vec3(1, 2, 3);

    v1.sub(v2);

    QUnit.equal(1, v1.x);
    QUnit.equal(2, v1.y);
    QUnit.equal(3, v1.z);
});

test("sub2", function() {
    var v1 = new pc.Vec3(2, 4, 6);
    var v2 = new pc.Vec3(1, 2, 3);
    var r = new pc.Vec3();

    r.sub2(v1, v2);

    QUnit.equal(1, r.x);
    QUnit.equal(2, r.y);
    QUnit.equal(3, r.z);
});

test("toString", function() {
    var v1 = new pc.Vec3(2, 4, 6);

    var s = v1.toString();

    QUnit.equal(s, '[2, 4, 6]');
});

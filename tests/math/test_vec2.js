module("pc.Vec2");

test("x", function() {
    var v1 = new pc.Vec2(2, 4);
    QUnit.equal(2, v1.x);
});

test("y", function() {
    var v1 = new pc.Vec2(2, 4);
    QUnit.equal(4, v1.y);
});

test("add2", function() {
    var v1 = new pc.Vec2(2, 4);
    var v2 = new pc.Vec2(1, 2);
    var r = new pc.Vec2();

    r.add2(v1, v2);

    QUnit.equal(3, r.x);
    QUnit.equal(6, r.y);
});
 
test("clone", function () {
    var v1 = new pc.Vec2();
    var v2 = v1.clone();

    QUnit.ok(typeof v2 === "object");

    QUnit.equal(v1.x, v2.x);
    QUnit.equal(v1.y, v2.y);
});
    
test("copy", function () {
    var v1 = new pc.Vec2(2, 4);
    var v2 = new pc.Vec2();

    v2.copy(v1);

    QUnit.equal(2, v2.x);
    QUnit.equal(4, v2.y);
});

test("constructor: no args", function () { 
    var v = new pc.Vec2();

    QUnit.equal(2, v.data.length);
    QUnit.equal(v.x, 0);
    QUnit.equal(v.y, 0);
});


test("constructor: args", function() {
    var v = new pc.Vec2(1, 2);
    
    QUnit.equal(2, v.data.length);
    QUnit.equal(1, v.x);
    QUnit.equal(2, v.y);
});

test("dot", function() {
    var v1 = new pc.Vec2(1, 2);
    var v2 = new pc.Vec2(3, 4);

    var r = v1.dot(v2);

    QUnit.equal(r, 11);
});

test("dot: parallel", function() {
    var v1 = new pc.Vec2(0, 1);
    var v2 = new pc.Vec2(0, 1);
    
    var r = v1.dot(v2);
    
    QUnit.equal(r, 1);
});

test("dot: perpendicular", function() {
    var v1 = new pc.Vec2(1, 0);
    var v2 = new pc.Vec2(0, 1);
    
    var r = v1.dot(v2);

    QUnit.equal(r, 0);
});

test("equals", function() {
    var v1 = new pc.Vec2(1, 0);
    var v2 = new pc.Vec2(0, 1);

    var e = v1.equals(v2);
    QUnit.equal(false, e);

    var e = v1.equals(v1);
    QUnit.equal(true, e);
});

test("length", function() {
    var v = new pc.Vec2(3, 4);
    var l = v.length();
    QUnit.equal(5, l);
});

test("lengthSq", function() {
    var v = new pc.Vec2(3, 4);
    var l = v.lengthSq();
    QUnit.equal(25, l);
});

test("lerp", function() {
    var v0 = new pc.Vec2(1, 2);
    var v1 = new pc.Vec2(3, 4);
    var r = new pc.Vec2();

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
    var v1 = new pc.Vec2(1, 2);
    var v2 = new pc.Vec2(3, 4);

    v1.mul(v2);

    QUnit.equal(3, v1.x);
    QUnit.equal(8, v1.y);
});

test("mul2", function() {
    var v1 = new pc.Vec2(1, 2);
    var v2 = new pc.Vec2(3, 4);
    var r = new pc.Vec2();

    r.mul2(v1, v2);
    
    QUnit.equal(3, r.x);
    QUnit.equal(8, r.y);
});

test("normalize", function(){
    var x = new pc.Vec2(10, 0);
    var y = new pc.Vec2(0, 10);

    x.normalize()
    QUnit.equal(1, x.x);
    QUnit.equal(0, x.y);

    y.normalize()
    QUnit.equal(0, y.x);
    QUnit.equal(1, y.y);
});

test("scale", function() {
    var v = new pc.Vec2(1, 2);
    v.scale(2);

    QUnit.equal(2, v.x);
    QUnit.equal(4, v.y);
});

test("set", function() {
    var v1 = new pc.Vec2();

    v1.set(2, 4);

    QUnit.equal(2, v1.x);
    QUnit.equal(4, v1.y);
});

test("sub", function() {
    var v1 = new pc.Vec2(2, 4);
    var v2 = new pc.Vec2(1, 2);

    v1.sub(v2);

    QUnit.equal(1, v1.x);
    QUnit.equal(2, v1.y);
});

test("sub2", function() {
    var v1 = new pc.Vec2(2, 4);
    var v2 = new pc.Vec2(1, 2);
    var r = new pc.Vec2();

    r.sub2(v1, v2);

    QUnit.equal(1, r.x);
    QUnit.equal(2, r.y);
});

test("toString", function() {
    var v1 = new pc.Vec2(2, 4);

    var s = v1.toString();

    QUnit.equal(s, '[2, 4]');
});

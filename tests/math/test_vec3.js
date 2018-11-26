describe("pc.Vec3", function () {
    it("x", function() {
        var v1 = new pc.Vec3(2, 4, 6);
        equal(2, v1.x);
    });

    it("y", function() {
        var v1 = new pc.Vec3(2, 4, 6);
        equal(4, v1.y);
    });

    it("z", function() {
        var v1 = new pc.Vec3(2, 4, 6);
        equal(6, v1.z);
    });

    it("add2", function() {
        var v1 = new pc.Vec3(2, 4, 6);
        var v2 = new pc.Vec3(1, 2, 3);
        var r = new pc.Vec3();

        r.add2(v1, v2);

        equal(3, r.x);
        equal(6, r.y);
        equal(9, r.z);
    });

    it("clone", function () {
        var v1 = new pc.Vec3();
        var v2 = v1.clone();

        ok(typeof v2 === "object");

        equal(v1.x, v2.x);
        equal(v1.y, v2.y);
        equal(v1.z, v2.z);
    });

    it("copy", function () {
        var v1 = new pc.Vec3(2, 4, 6);
        var v2 = new pc.Vec3();

        v2.copy(v1);

        equal(2, v2.x);
        equal(4, v2.y);
        equal(6, v2.z);
    });

    it("constructor: no args", function () {
        var v = new pc.Vec3();

        equal(v.x, 0);
        equal(v.y, 0);
        equal(v.z, 0);
    });


    it("constructor: args", function() {
        var v = new pc.Vec3(1, 2, 3);

        equal(1, v.x);
        equal(2, v.y);
        equal(3, v.z);
    });

    it("cross", function() {
        var v1 = new pc.Vec3(1, 0, 0);
        var v2 = new pc.Vec3(0, 1, 0);
        var r = new pc.Vec3();

        r.cross(v1, v2);

        equal(0, r.x);
        equal(0, r.y);
        equal(1, r.z);
    });

    it("cross: first arg is also result", function() {
        var r = new pc.Vec3(1, 0, 0);
        var v2 = new pc.Vec3(0, 1, 0);

        r.cross(r, v2);

        equal(0, r.x);
        equal(0, r.y);
        equal(1, r.z);
    });

    it("cross: second arg is also result", function() {
        var v1 = new pc.Vec3(1, 0, 0);
        var r = new pc.Vec3(0, 1, 0);

        r.cross(v1, r);

        equal(0, r.x);
        equal(0, r.y);
        equal(1, r.z);
    });

    it("dot", function() {
        var v1 = new pc.Vec3(1, 2, 3);
        var v2 = new pc.Vec3(4, 5, 6);

        var r = v1.dot(v2);

        equal(r, 32);
    });

    it("dot: parallel", function() {
        var v1 = new pc.Vec3(0, 1, 0);
        var v2 = new pc.Vec3(0, 1, 0);

        var r = v1.dot(v2);

        equal(r, 1);
    });

    it("dot: perpendicular", function() {
        var v1 = new pc.Vec3(1, 0, 0);
        var v2 = new pc.Vec3(0, 1, 0);

        var r = v1.dot(v2);

        equal(r, 0);
    });

    it("equals", function() {
        var v1 = new pc.Vec3(1, 0, 0);
        var v2 = new pc.Vec3(0, 1, 0);

        var e = v1.equals(v2);
        equal(false, e);

        var e = v1.equals(v1);
        equal(true, e);
    });

    it("length", function() {
        var v = new pc.Vec3(0, 3, 4);
        var l = v.length();
        equal(5, l);
    });

    it("lengthSq", function() {
        var v = new pc.Vec3(0, 3, 4);
        var l = v.lengthSq();
        equal(25, l);
    });

    it("lerp", function() {
        var v0 = new pc.Vec3(1, 2, 3);
        var v1 = new pc.Vec3(4, 5, 6);
        var r = new pc.Vec3();

        r.lerp(v0, v1, 0);

        equal(v0.x, r.x);
        equal(v0.y, r.y);
        equal(v0.z, r.z);

        r.lerp(v0, v1, 1);

        equal(v1.x, r.x);
        equal(v1.y, r.y);
        equal(v1.z, r.z);
    });

    it("mul", function() {
        var v1 = new pc.Vec3(1, 2, 3);
        var v2 = new pc.Vec3(4, 5, 6);
        v1.mul(v2);

        equal(4, v1.x);
        equal(10, v1.y);
        equal(18, v1.z);
    });

    it("mul2", function() {
        var v1 = new pc.Vec3(1, 2, 3);
        var v2 = new pc.Vec3(1, 2, 3);
        var r = new pc.Vec3();
        r.mul2(v1, v2);

        equal(1, r.x);
        equal(4, r.y);
        equal(9, r.z);
    });

    it("normalize", function(){
        var x = new pc.Vec3(10, 0, 0);
        var y = new pc.Vec3(0, 10, 0);
        var z = new pc.Vec3(0, 0, 10);

        x.normalize()
        equal(1, x.x);
        equal(0, x.y);
        equal(0, x.z);

        y.normalize()
        equal(0, y.x);
        equal(1, y.y);
        equal(0, y.z);

        z.normalize()
        equal(0, z.x);
        equal(0, z.y);
        equal(1, z.z);
    });

    it("project", function () {
        var v = new pc.Vec3(1,0,0);
        var p = new pc.Vec3(5,5,5);
        p.project(v);
        equal(p.x, 5);
        equal(p.y, 0);
        equal(p.z, 0);
    });

    it("project negative", function () {
        var v = new pc.Vec3(-1,0,0);
        var p = new pc.Vec3(5,5,5);
        p.project(v);
        equal(p.x, 5);
        equal(p.y, 0);
        equal(p.z, 0);
    });

    it("scale", function() {
        var v = new pc.Vec3(1, 2, 3);
        v.scale(2);

        equal(2, v.x);
        equal(4, v.y);
        equal(6, v.z);
    });

    it("set", function() {
        var v1 = new pc.Vec3();

        v1.set(2, 4, 6);

        equal(2, v1.x);
        equal(4, v1.y);
        equal(6, v1.z);
    });

    it("sub", function() {
        var v1 = new pc.Vec3(2, 4, 6);
        var v2 = new pc.Vec3(1, 2, 3);

        v1.sub(v2);

        equal(1, v1.x);
        equal(2, v1.y);
        equal(3, v1.z);
    });

    it("sub2", function() {
        var v1 = new pc.Vec3(2, 4, 6);
        var v2 = new pc.Vec3(1, 2, 3);
        var r = new pc.Vec3();

        r.sub2(v1, v2);

        equal(1, r.x);
        equal(2, r.y);
        equal(3, r.z);
    });

    it("toString", function() {
        var v1 = new pc.Vec3(2, 4, 6);

        var s = v1.toString();

        equal(s, '[2, 4, 6]');
    });

});


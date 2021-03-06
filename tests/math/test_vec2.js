describe("pc.Vec2", function () {
    it("x", function() {
        var v1 = new pc.Vec2(2, 4);
        equal(2, v1.x);
    });

    it("y", function() {
        var v1 = new pc.Vec2(2, 4);
        equal(4, v1.y);
    });

    it("add", function() {
        var v1 = new pc.Vec2(2, 4);
        var v2 = new pc.Vec2(1, 2);

        v1.add(v2);

        equal(3, v1.x);
        equal(6, v1.y);
    });

    it("add2", function() {
        var v1 = new pc.Vec2(2, 4);
        var v2 = new pc.Vec2(1, 2);
        var r = new pc.Vec2();

        r.add2(v1, v2);

        equal(3, r.x);
        equal(6, r.y);
    });

    it("addScalar", function() {
        var v = new pc.Vec2(2, 4);

        v.addScalar(2);

        equal(4, v.x);
        equal(6, v.y);
    });

    it("clone", function () {
        var v1 = new pc.Vec2();
        var v2 = v1.clone();

        ok(typeof v2 === "object");

        equal(v1.x, v2.x);
        equal(v1.y, v2.y);
    });

    it("copy", function () {
        var v1 = new pc.Vec2(2, 4);
        var v2 = new pc.Vec2();

        v2.copy(v1);

        equal(2, v2.x);
        equal(4, v2.y);
    });

    it("constructor: no args", function () {
        var v = new pc.Vec2();

        equal(v.x, 0);
        equal(v.y, 0);
    });


    it("constructor: args", function() {
        var v = new pc.Vec2(1, 2);

        equal(1, v.x);
        equal(2, v.y);
    });

    it("div", function() {
        var v1 = new pc.Vec2(9, 16);
        var v2 = new pc.Vec2(3, 4);
        v1.div(v2);

        equal(3, v1.x);
        equal(4, v1.y);
    });

    it("div2", function() {
        var v1 = new pc.Vec2(9, 16);
        var v2 = new pc.Vec2(3, 4);
        var r = new pc.Vec2();
        r.div2(v1, v2);

        equal(3, r.x);
        equal(4, r.y);
    });

    it("divScalar", function() {
        var v = new pc.Vec2(3, 6);
        v.divScalar(3);

        equal(1, v.x);
        equal(2, v.y);
    });

    it("dot", function() {
        var v1 = new pc.Vec2(1, 2);
        var v2 = new pc.Vec2(3, 4);

        var r = v1.dot(v2);

        equal(r, 11);
    });

    it("dot: parallel", function() {
        var v1 = new pc.Vec2(0, 1);
        var v2 = new pc.Vec2(0, 1);

        var r = v1.dot(v2);

        equal(r, 1);
    });

    it("dot: perpendicular", function() {
        var v1 = new pc.Vec2(1, 0);
        var v2 = new pc.Vec2(0, 1);

        var r = v1.dot(v2);

        equal(r, 0);
    });

    it("equals", function() {
        var v1 = new pc.Vec2(1, 0);
        var v2 = new pc.Vec2(0, 1);

        var e = v1.equals(v2);
        equal(false, e);

        var e = v1.equals(v1);
        equal(true, e);
    });

    it("length", function() {
        var v = new pc.Vec2(3, 4);
        var l = v.length();
        equal(5, l);
    });

    it("lengthSq", function() {
        var v = new pc.Vec2(3, 4);
        var l = v.lengthSq();
        equal(25, l);
    });

    it("lerp", function() {
        var v0 = new pc.Vec2(1, 2);
        var v1 = new pc.Vec2(3, 4);
        var r = new pc.Vec2();

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
        var v1 = new pc.Vec2(1, 2);
        var v2 = new pc.Vec2(3, 4);

        v1.mul(v2);

        equal(3, v1.x);
        equal(8, v1.y);
    });

    it("mul2", function() {
        var v1 = new pc.Vec2(1, 2);
        var v2 = new pc.Vec2(3, 4);
        var r = new pc.Vec2();

        r.mul2(v1, v2);

        equal(3, r.x);
        equal(8, r.y);
    });

    it("mulScalar", function() {
        var v = new pc.Vec2(1, 2);
        v.mulScalar(2);

        equal(2, v.x);
        equal(4, v.y);
    });

    it("normalize", function(){
        var x = new pc.Vec2(10, 0);
        var y = new pc.Vec2(0, 10);

        x.normalize()
        equal(1, x.x);
        equal(0, x.y);

        y.normalize()
        equal(0, y.x);
        equal(1, y.y);
    });

    it("set", function() {
        var v1 = new pc.Vec2();

        v1.set(2, 4);

        equal(2, v1.x);
        equal(4, v1.y);
    });

    it("sub", function() {
        var v1 = new pc.Vec2(2, 4);
        var v2 = new pc.Vec2(1, 2);

        v1.sub(v2);

        equal(1, v1.x);
        equal(2, v1.y);
    });

    it("sub2", function() {
        var v1 = new pc.Vec2(2, 4);
        var v2 = new pc.Vec2(1, 2);
        var r = new pc.Vec2();

        r.sub2(v1, v2);

        equal(1, r.x);
        equal(2, r.y);
    });

    it("subScalar", function() {
        var v = new pc.Vec2(2, 4, 6);

        v.subScalar(2);

        equal(0, v.x);
        equal(2, v.y);
    });

    it("toString", function() {
        var v1 = new pc.Vec2(2, 4);

        var s = v1.toString();

        equal(s, '[2, 4]');
    });

});


describe("pc.Vec4", function () {
    it("x", function() {
        var v1 = new pc.Vec4(2, 4, 6, 8);
        equal(2, v1.x);
    });

    it("y", function() {
        var v1 = new pc.Vec4(2, 4, 6, 8);
        equal(4, v1.y);
    });

    it("z", function() {
        var v1 = new pc.Vec4(2, 4, 6, 8);
        equal(6, v1.z);
    });

    it("w", function() {
        var v1 = new pc.Vec4(2, 4, 6, 8);
        equal(8, v1.w);
    });

    it("add2", function() {
        var v1 = new pc.Vec4(2, 4, 6, 8);
        var v2 = new pc.Vec4(1, 2, 3, 4);
        var r = new pc.Vec4();

        r.add2(v1, v2);

        equal(3, r.x);
        equal(6, r.y);
        equal(9, r.z);
        equal(12, r.w);
    });

    it("clone", function () {
        var v1 = new pc.Vec4();
        var v2 = v1.clone();

        ok(typeof v2 === "object");

        equal(v1.x, v2.x);
        equal(v1.y, v2.y);
        equal(v1.z, v2.z);
        equal(v1.w, v2.w);
    });

    it("copy", function () {
        var v1 = new pc.Vec4(2, 4, 6, 8);
        var v2 = new pc.Vec4();

        v2.copy(v1);

        equal(2, v2.x);
        equal(4, v2.y);
        equal(6, v2.z);
        equal(8, v2.w);
    });

    it("constructor: no args", function () {
        var v = new pc.Vec4();

        equal(v.x, 0);
        equal(v.y, 0);
        equal(v.z, 0);
        equal(v.w, 0);
    });


    it("constructor: args", function() {
        var v = new pc.Vec4(1, 2, 3, 4);

        equal(1, v.x);
        equal(2, v.y);
        equal(3, v.z);
        equal(4, v.w);
    });

    it("dot", function() {
        var v1 = new pc.Vec4(1, 2, 3, 4);
        var v2 = new pc.Vec4(5, 6, 7, 8);

        var r = v1.dot(v2);

        equal(r, 70);
    });

    it("equals", function() {
        var v1 = new pc.Vec4(1, 2, 3, 4);
        var v2 = new pc.Vec4(5, 6, 7, 8);

        var e = v1.equals(v2);
        equal(false, e);

        var e = v1.equals(v1);
        equal(true, e);
    });

    it("length", function() {
        var v = new pc.Vec4(0, 3, 4, 0);
        var l = v.length();
        equal(5, l);
    });

    it("lengthSq", function() {
        var v = new pc.Vec4(0, 3, 4, 0);
        var l = v.lengthSq();
        equal(25, l);
    });

    it("lerp", function() {
        var v1 = new pc.Vec4(1, 2, 3, 4);
        var v2 = new pc.Vec4(5, 6, 7, 8);
        var r = new pc.Vec4();

        r.lerp(v1, v2, 0);

        equal(v1.x, r.x);
        equal(v1.y, r.y);
        equal(v1.z, r.z);
        equal(v1.w, r.w);

        r.lerp(v1, v2, 1);

        equal(v2.x, r.x);
        equal(v2.y, r.y);
        equal(v2.z, r.z);
        equal(v2.w, r.w);
    });

    it("mul", function() {
        var v1 = new pc.Vec4(1, 2, 3, 4);
        var v2 = new pc.Vec4(5, 6, 7, 8);

        v1.mul(v2);

        equal(5, v1.x);
        equal(12, v1.y);
        equal(21, v1.z);
        equal(32, v1.w);
    });

    it("mul2", function() {
        var v1 = new pc.Vec4(1, 2, 3, 4);
        var v2 = new pc.Vec4(5, 6, 7, 8);
        var r = new pc.Vec4();

        r.mul2(v1, v2);

        equal(5, r.x);
        equal(12, r.y);
        equal(21, r.z);
        equal(32, r.w);
    });

    it("normalize", function(){
        var x = new pc.Vec4(10, 0, 0, 0);
        var y = new pc.Vec4(0, 10, 0, 0);
        var z = new pc.Vec4(0, 0, 10, 0);
        var w = new pc.Vec4(0, 0, 0, 10);

        x.normalize()
        equal(1, x.x);
        equal(0, x.y);
        equal(0, x.z);
        equal(0, x.w);

        y.normalize()
        equal(0, y.x);
        equal(1, y.y);
        equal(0, y.z);
        equal(0, y.w);

        z.normalize()
        equal(0, z.x);
        equal(0, z.y);
        equal(1, z.z);
        equal(0, z.w);

        w.normalize()
        equal(0, w.x);
        equal(0, w.y);
        equal(0, w.z);
        equal(1, w.w);
    });

    it("scale", function() {
        var v = new pc.Vec4(1, 2, 3, 4);
        v.scale(2);

        equal(2, v.x);
        equal(4, v.y);
        equal(6, v.z);
        equal(8, v.w);
    });

    it("set", function() {
        var v1 = new pc.Vec4();

        v1.set(2, 4, 6, 8);

        equal(2, v1.x);
        equal(4, v1.y);
        equal(6, v1.z);
        equal(8, v1.w);
    });

    it("sub", function() {
        var v1 = new pc.Vec4(1, 2, 3, 4);
        var v2 = new pc.Vec4(5, 6, 7, 8);

        v1.sub(v2);

        equal(-4, v1.x);
        equal(-4, v1.y);
        equal(-4, v1.z);
        equal(-4, v1.w);
    });

    it("sub2", function() {
        var v1 = new pc.Vec4(1, 2, 3, 4);
        var v2 = new pc.Vec4(5, 6, 7, 8);
        var r = new pc.Vec4();

        r.sub2(v1, v2);

        equal(-4, r.x);
        equal(-4, r.y);
        equal(-4, r.z);
        equal(-4, r.w);
    });

    it("toString", function() {
        var v1 = new pc.Vec4(2, 4, 6, 8);

        var s = v1.toString();

        equal(s, '[2, 4, 6, 8]');
    });

});


describe("pc.Mat4", function () {
    function approx(actual, expected, message) {
        var epsilon = 0.00001;
        var delta = actual - expected;
        ok(Math.abs(delta) < epsilon, message);
    }

    // clip to 3 decimal places and convert to string for comparison
    var clip = function (m) {
        var i, l = m.length;
        var a = [];
        for (i = 0; i < l; i++) {
            a[i] = parseFloat(m[i].toFixed(3));
        }

        return a;
    };

    it("create", function () {
        var m = new pc.Mat4();
        ok(m);

        // Check the matrix is identity
        var identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        for (var i = 0; i < 16; ++i) {
            equal(m.data[i], identity[i]);
        }
    });

    it("clone", function () {
        var m = new pc.Mat4().set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
        var c = m.clone();

        for (var i = 0; i < 16; ++i) {
            equal(m.data[i], c.data[i]);
        }
    });

    it("mul2: I*I = I", function () {
        var m1 = new pc.Mat4();
        var m2 = new pc.Mat4();
        var m3 = new pc.Mat4();
        var m4 = new pc.Mat4();

        m3.mul2(m1, m2);
        deepEqual(m3.data, m4.data);
    });

    it("mul2: I*A = A", function () {
        var m1 = new pc.Mat4();
        var m2 = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 180 / 8);
        var m3 = new pc.Mat4();

        m3.mul2(m1, m2);
        deepEqual(m2.data, m3.data);
    });

    it("mul2: A*I = A", function () {
        var m1 = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 180 / 8);
        var m2 = new pc.Mat4();
        var m3 = new pc.Mat4();

        m3.mul2(m1, m2);
        deepEqual(m1.data, m3.data);
    });

    it("transformPoint", function () {
        var t = new pc.Mat4();
        var v = new pc.Vec3(1, 0, 0);
        var r = new pc.Vec3();

        t.setFromAxisAngle(pc.Vec3.BACK, 90);
        t.transformPoint(v, r);

        expect(r.x).to.be.closeTo(0, 0.00001);
        expect(r.y).to.be.closeTo(1, 0.00001);
        expect(r.z).to.be.closeTo(0, 0.00001);
    });

    it("transformPoint: src and result same", function () {
        var t = new pc.Mat4();
        var v = new pc.Vec3(1, 0, 0);

        t.setFromAxisAngle(pc.Vec3.BACK, 90);
        t.transformPoint(v, v);

        expect(v.x).to.be.closeTo(0, 0.00001);
        expect(v.y).to.be.closeTo(1, 0.00001);
        expect(v.z).to.be.closeTo(0, 0.00001);
    });

    it("setLookAt", function () {
        var position = new pc.Vec3(0, 0, 10);
        var target = new pc.Vec3(0, 0, 0);
        var up = new pc.Vec3(0, 1, 0);

        var lookAt = new pc.Mat4().setLookAt(position, target, up);

        equal(lookAt.data[0], 1);
        equal(lookAt.data[1], 0);
        equal(lookAt.data[2], 0);
        equal(lookAt.data[3], 0);

        equal(lookAt.data[4], 0);
        equal(lookAt.data[5], 1);
        equal(lookAt.data[6], 0);
        equal(lookAt.data[7], 0);

        equal(lookAt.data[8], 0);
        equal(lookAt.data[9], 0);
        equal(lookAt.data[10], 1);
        equal(lookAt.data[11], 0);

        equal(lookAt.data[12], 0);
        equal(lookAt.data[13], 0);
        equal(lookAt.data[14], 10);
        equal(lookAt.data[15], 1);
    });

    it("setLookAt: 90deg", function () {
        var m = new pc.Mat4();
        m.setFromAxisAngle(pc.Vec3.UP, 90);
        var r = new pc.Mat4();
        var heading = new pc.Vec3(-m.data[8], -m.data[9], -m.data[10]);
        var left = new pc.Vec3(m.data[0], m.data[1], m.data[2]);
        var up = new pc.Vec3(m.data[4], m.data[5], m.data[6]);

        r.setLookAt(new pc.Vec3(), heading, up);

        for (var index = 0; index < 16; index++) {
            equal(r.data[index], m.data[index]);
        }
    });

    it("setLookAt: 180deg", function () {
        var m = new pc.Mat4();
        m.setFromAxisAngle(pc.Vec3.UP, 90);
        var r = new pc.Mat4();
        var heading = new pc.Vec3(-m.data[8], -m.data[9], -m.data[10]);
        var left = new pc.Vec3(m.data[0], m.data[1], m.data[2]);
        var up = new pc.Vec3(m.data[4], m.data[5], m.data[6]);

        r.setLookAt(new pc.Vec3(), heading, up);

        for (var index = 0; index < 16; index++) {
            equal(r.data[index], m.data[index]);
        }
    });

    it("setTranslate", function () {
        var x = 10;
        var y = 20;
        var z = 30;

        // Test 1: create matrix internally
        var t = new pc.Mat4().setTranslate(x, y, z);
        equal(t.data[12], x);
        equal(t.data[13], y);
        equal(t.data[14], z);

        // Test 2: generate result in supplied matrix
        var r = new pc.Mat4();
        r.setTranslate(x, y, z);
        equal(r.data[12], x);
        equal(r.data[13], y);
        equal(r.data[14], z);
    });


    it("transpose", function () {
        var x = 10;
        var y = 20;
        var z = 30;
        var m = new pc.Mat4().setTranslate(x, y, z);

        var mTrans = m.transpose();
        var mTransTrans = mTrans.transpose();

        deepEqual(m.data, mTransTrans.data);
    });

    it("invert", function () {
        var x = 10;
        var y = 20;
        var z = 30;
        var m1 = new pc.Mat4().setTranslate(x, y, z);

        var inv = m1.clone().invert();

        var m2 = inv.clone().invert();

        deepEqual(m1.data, m2.data);
    });

    it("getX", function () {
        var m = new pc.Mat4().set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
        var v1 = m.getX();

        equal(v1.x, 1);
        equal(v1.y, 2);
        equal(v1.z, 3);

        // use existing vector
        var v2 = new pc.Vec3();
        m.getX(v2);

        equal(v2.x, 1);
        equal(v2.y, 2);
        equal(v2.z, 3);
    });

    it("getY", function () {
        var m = new pc.Mat4().set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
        var v1 = m.getY();

        equal(v1.x, 5);
        equal(v1.y, 6);
        equal(v1.z, 7);

        // use existing vector
        var v2 = new pc.Vec3();
        m.getY(v2);

        equal(v2.x, 5);
        equal(v2.y, 6);
        equal(v2.z, 7);
    });

    it("getZ", function () {
        var m = new pc.Mat4().set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
        var v1 = m.getZ();

        equal(v1.x, 9);
        equal(v1.y, 10);
        equal(v1.z, 11);

        // use existing vector
        var v2 = new pc.Vec3();
        m.getZ(v2);

        equal(v2.x, 9);
        equal(v2.y, 10);
        equal(v2.z, 11);
    });

    it("getTranslation", function () {
        var m = new pc.Mat4().set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
        var v1 = m.getTranslation();

        equal(v1.x, 13);
        equal(v1.y, 14);
        equal(v1.z, 15);

        // use existing vector
        var v2 = new pc.Vec3();
        m.getTranslation(v2);

        equal(v2.x, 13);
        equal(v2.y, 14);
        equal(v2.z, 15);
    });

    it("getScale", function () {
        var m = new pc.Mat4().set([2, 0, 0, 1, 0, 3, 0, 1, 0, 0, 4, 1, 0, 0, 0, 1]);
        var v1 = m.getScale();

        equal(v1.x, 2);
        equal(v1.y, 3);
        equal(v1.z, 4);

        // use existing vector
        var v2 = new pc.Vec3();
        m.getScale(v2);

        equal(v2.x, 2);
        equal(v2.y, 3);
        equal(v2.z, 4);
    });


    it("getEulerAngles", function () {
        var m, e;

        m = new pc.Mat4().set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        e = new pc.Vec3();
        m.getEulerAngles(e);
        equal(e.x, 0);
        equal(e.y, 0);
        equal(e.z, 0);

        m = new pc.Mat4().set([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1]);
        m.getEulerAngles(e);
        approx(e.x, 90, e.x.toString() + " ~= " + 90);
        equal(e.y, 0);
        equal(e.z, 0);

        m = new pc.Mat4().set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        m.getEulerAngles(e);
        equal(e.x, 0);
        equal(e.y, 0);
        equal(e.z, 0);

        m = new pc.Mat4().set([0.7071067811865476, 0, 0.7071067811865476, 0, 0, 1, 0, 0, -0.7071067811865476, 0, 0.7071067811865476, 0, 0, 0, 0, 1]);
        m.getEulerAngles(e);
        equal(e.x, 0);
        approx(e.y, -45, e.y.toString() + " ~= " + -45);
        equal(e.z, 0);

        m = new pc.Mat4().set([1, 0, 0, 0, 0, 0.7071067811865476, -0.7071067811865476, 0, 0, 0.7071067811865476, 0.7071067811865476, 0, 0, 0, 0, 1]);
        m.getEulerAngles(e);
        approx(e.x, -45, e.x.toString() + " ~= " + -45);
        equal(e.y, 0);
        equal(e.z, 0);

        m = new pc.Mat4().set([0.7071067811865476, -0.7071067811865476, 0, 0, 0.7071067811865476, 0.7071067811865476, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        m.getEulerAngles(e);
        equal(e.x, 0);
        equal(e.y, 0);
        approx(e.z, -45, e.z.toString() + " ~= " + -45);
    });

    it("setFromEulerAngles", function () {
        var m, mr, mrx, mry, mrz, x, y, z;

        // no rotation -> identity
        x = y = z = 0;
        m = new pc.Mat4().setFromEulerAngles(x, y, z);
        deepEqual(clip(m.data), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

        // Rotate 45 around y
        y = 45;
        x = z = 0;
        m = new pc.Mat4().setFromEulerAngles(x, y, z);
        var m1 = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, y);
        deepEqual(clip(m.data), [0.707, 0, -0.707, 0, 0, 1, 0, 0, 0.707, 0, 0.707, 0, 0, 0, 0, 1]);

        // Rotate 45 around x
        x = 45;
        y = z = 0;
        m = new pc.Mat4().setFromEulerAngles(x, y, z);
        deepEqual(clip(m.data), [1, 0, 0, 0, 0, 0.707, 0.707, 0, 0, -0.707, 0.707, 0, 0, 0, 0, 1]);

        // Rotate 45 around z
        z = 45;
        y = x = 0;
        m = new pc.Mat4().setFromEulerAngles(x, y, z);
        deepEqual(clip(m.data), [0.707, 0.707, 0, 0, -0.707, 0.707, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

        // Arbitrary rotation
        x = 33;
        y = 44;
        z = 55;
        m = new pc.Mat4().setFromEulerAngles(x, y, z);
        mrx = new pc.Mat4().setFromAxisAngle(pc.Vec3.RIGHT, x);
        mry = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, y);
        mrz = new pc.Mat4().setFromAxisAngle(pc.Vec3.BACK, z);
        mr = new pc.Mat4().mul2(mrz, mry);
        mr.mul(mrx);
        deepEqual(clip(m.data), clip(mr.data));
    });

    it("fromEuler and back", function () {

        var m1 = new pc.Mat4().set([0.7071067811865476, 0, 0.7071067811865476, 0, 0, 1, 0, 0, -0.7071067811865476, 0, 0.7071067811865476, 0, 0, 0, 0, 1]);
        var m2;

        var r = new pc.Vec3();
        m1.getEulerAngles(r);
        m2 = new pc.Mat4().setFromEulerAngles(r.x, r.y, r.z);

        deepEqual(clip(m1.data), clip(m2.data));
    });

    it("setTRS", function () {

        var tx = 10;
        var ty = 20;
        var tz = 30;

        var t = new pc.Vec3(tx, ty, tz);
        var r = new pc.Quat(0, 0, Math.sqrt(0.5), Math.sqrt(0.5));
        var s = new pc.Vec3(2, 2, 2);
        var m1 = new pc.Mat4().setTRS(t, r, s);

        var mt = new pc.Mat4().setTranslate(tx, ty, tz);
        var mr = new pc.Mat4().setFromAxisAngle(pc.Vec3.BACK, 90);
        var ms = new pc.Mat4().setScale(2, 2, 2);
        var temp = new pc.Mat4().mul2(mt, mr);
        var m2 = new pc.Mat4().mul2(temp, ms);

        var i;
        for (i = 0; i < m1.length; i++) {
            close(m1.data[i], m2.data[i], 0.0001);
        }

        t = new pc.Vec3(tx, ty, tz);
        r = new pc.Quat(0, Math.sqrt(0.5), 0, Math.sqrt(0.5));
        s = new pc.Vec3(2, 3, 4);
        m1 = new pc.Mat4().setTRS(t, r, s);
        m2 = [0, 0, -2, 0, 0, 3, 0, 0, 4, 0, 0, 0, 10, 20, 30, 1];

        for (i = 0; i < m1.length; i++) {
            expect(m1.data[i]).to.equal(m2.data[i]);
        }
    });

    // it("makeRotate", function() {
    //     ok(false, "Not written");
    // });

    // it("makeFrustum", function() {
    //     ok(false, "Not written")
    // });

    // it("makePerspective", function() {
    //     ok(false, "Not written");
    // });
});

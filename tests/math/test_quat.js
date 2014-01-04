module("pc.Quat");

test("constructor: args", function () { 
    var q = new pc.Quat(1, 2, 3, 4);

    QUnit.equal(q.x, 1);
    QUnit.equal(q.y, 2);
    QUnit.equal(q.z, 3);
    QUnit.equal(q.w, 4);
});

test("constructor: no args", function () { 
    var q = new pc.Quat();

    QUnit.equal(q.x, 0);
    QUnit.equal(q.y, 0);
    QUnit.equal(q.z, 0);
    QUnit.equal(q.w, 1);
});

test("mul2", function () { 
    // I*I = I
    var q1 = new pc.Quat();
    var q2 = new pc.Quat();
    var q3 = new pc.Quat();
    var q4 = new pc.Quat();
    var qr = new pc.Quat();

    qr.mul2(q1, q2);
    QUnit.equal(qr.x, 0);
    QUnit.equal(qr.y, 0);
    QUnit.equal(qr.z, 0);
    QUnit.equal(qr.w, 1);

    // R*Rinv=I
    q1.setFromEulers(90, 0, 0);
    q2.setFromEulers(-90, 0, 0);
    qr.mul2(q1, q2);
    QUnit.equal(qr.x, 0);
    QUnit.equal(qr.y, 0);
    QUnit.equal(qr.z, 0);
    QUnit.close(qr.w, 1, 0.0001);

    q1.setFromEulers(25, 0, 0);
    q2.setFromEulers(0, 35, 0);
    q3.setFromEulers(0, 0, 45);
    qr.mul2(q3, q2);
    qr.mul(q1);
    q4.setFromEulers(25, 35, 45);
    QUnit.close(qr.x, q4.x, 0.0001);
    QUnit.close(qr.y, q4.y, 0.0001);
    QUnit.close(qr.z, q4.z, 0.0001);
    QUnit.close(qr.w, q4.w, 0.0001);
});

test("mul2: same order as matrix mult", function () { 
    var q1 = new pc.Quat();
    var q2 = new pc.Quat();
    var q3 = new pc.Quat();
    var q4 = new pc.Quat();

    var m1 = new pc.Mat4();
    var m2 = new pc.Mat4();
    var m3 = new pc.Mat4();

    q1.setFromEulers(10, 20, 0);
    q2.setFromEulers(0, 50, 0);
    q3.mul2(q1, q2);

    m1.setFromEulers(10, 20, 0);
    m2.setFromEulers(0, 50, 0);
    m3.mul2(m1, m2);
    q4.setFromMat4(m3);

    QUnit.close(q3.x, q4.x, 0.0001);
    QUnit.close(q3.y, q4.y, 0.0001);
    QUnit.close(q3.z, q4.z, 0.0001);
    QUnit.close(q3.w, q4.w, 0.0001);
});

test("setFromEulers", function () { 
    function testAngles(x, y, z) {
        var q1 = new pc.Quat();
        var q2 = new pc.Quat();
        var m = new pc.Mat4();

        q1.setFromEulers(x, y, z);
        m.setFromEulers(x, y, z);
        q2.setFromMat4(m);

        QUnit.close(q1.x, q2.x, 0.0001);
        QUnit.close(q1.y, q2.y, 0.0001);
        QUnit.close(q1.z, q2.z, 0.0001);
        QUnit.close(q1.w, q2.w, 0.0001);
    }

    testAngles(0, 0, 0);
    testAngles(90, 0, 0);
    testAngles(0.1, 0, 0);
    testAngles(0, 0.2, 0);
    testAngles(0, 0, 0.3);
    testAngles(1, 2, 3);
    testAngles(10, 10, 0);
});

test("fromEulerXYZ: useful normalized quaternions", function () { 
    var q = new pc.Quat();

    // Identity quaternion, no rotation
    q.setFromEulers(0, 0, 0);
    QUnit.equal(q.x, 0);
    QUnit.equal(q.y, 0);
    QUnit.equal(q.z, 0);
    QUnit.equal(q.w, 1);

    // 180° turn around X axis
    q.setFromEulers(180, 0, 0);
    QUnit.equal(q.x, 1);
    QUnit.equal(q.y, 0);
    QUnit.equal(q.z, 0);
    QUnit.close(q.w, 0, 0.0001);

    // 180° turn around Y axis
    q.setFromEulers(0, 180, 0);
    QUnit.equal(q.x, 0);
    QUnit.close(q.y, 1, 0.0001);
    QUnit.equal(q.z, 0);
    QUnit.close(q.w, 0, 0.0001);

    // 180° turn around Z axis
    q.setFromEulers(0, 0, 180);
    QUnit.equal(q.x, 0);
    QUnit.equal(q.y, 0);
    QUnit.close(q.z, 1, 0.0001);
    QUnit.close(q.w, 0, 0.0001);

    // 90° turn around X axis
    q.setFromEulers(90, 0, 0);
    QUnit.close(q.x, Math.sqrt(0.5), 0.0001);
    QUnit.equal(q.y, 0);
    QUnit.equal(q.z, 0);
    QUnit.close(q.w, Math.sqrt(0.5), 0.0001);

    // 90° turn around Y axis
    q.setFromEulers(0, 90, 0);
    QUnit.equal(q.x, 0);
    QUnit.close(q.y, Math.sqrt(0.5), 0.0001);
    QUnit.equal(q.z, 0);
    QUnit.close(q.w, Math.sqrt(0.5), 0.0001);

    // 90° turn around Z axis
    q.setFromEulers(0, 0, 90);
    QUnit.equal(q.x, 0);
    QUnit.equal(q.y, 0);
    QUnit.close(q.z, Math.sqrt(0.5), 0.0001);
    QUnit.close(q.w, Math.sqrt(0.5), 0.0001);

    // -90° turn around X axis
    q.setFromEulers(-90, 0, 0);
    QUnit.close(q.x, -Math.sqrt(0.5), 0.0001);
    QUnit.equal(q.y, 0);
    QUnit.equal(q.z, 0);
    QUnit.close(q.w, Math.sqrt(0.5), 0.0001);

    // -90° turn around Y axis
    q.setFromEulers(0, -90, 0);
    QUnit.equal(q.x, 0);
    QUnit.close(q.y, -Math.sqrt(0.5), 0.0001);
    QUnit.equal(q.z, 0);
    QUnit.close(q.w, Math.sqrt(0.5), 0.0001);

    // -90° turn around Z axis
    q.setFromEulers(0, 0, -90);
    QUnit.equal(q.x, 0);
    QUnit.equal(q.y, 0);
    QUnit.close(q.z, -Math.sqrt(0.5), 0.0001);
    QUnit.close(q.w, Math.sqrt(0.5), 0.0001);
});

test("setFromMat4", function () { 
    // Indentity matrix to indentity quaternion
    var s;
    var m = new pc.Mat4();
    var q = new pc.Quat().setFromMat4(m);

    QUnit.equal(q.x, 0);
    QUnit.equal(q.y, 0);
    QUnit.equal(q.z, 0);
    QUnit.equal(q.w, 1);

    // 180 degrees around +ve X
    m = new pc.Mat4().rotate(180, pc.Vec3.RIGHT);
    q = new pc.Quat().setFromMat4(m);

    QUnit.equal(q.x, 1);
    QUnit.equal(q.y, 0);
    QUnit.equal(q.z, 0);
    QUnit.close(q.w, 0, 0.0001);

    // -90 degrees around +ve Z
    m = new pc.Mat4().rotate(-90, pc.Vec3.BACK);
    q = new pc.Quat().setFromMat4(m);

    QUnit.equal(q.x, 0);
    QUnit.equal(q.y, 0);
    QUnit.close(q.z, -Math.sqrt(0.5), 0.0001);
    QUnit.close(q.w, Math.sqrt(0.5), 0.0001);

    // 45 degrees around +ve Z, scaled
    s = new pc.Mat4().scale(2, 2, 2);
    m = new pc.Mat4().rotate(-90, pc.Vec3.BACK);
    m.mul(s);
    q = new pc.Quat().setFromMat4(m);
    q.normalize();

    QUnit.equal(q.x, 0);
    QUnit.equal(q.y, 0);
    QUnit.close(q.z, -Math.sqrt(0.5), 0.0001);
    QUnit.close(q.w, Math.sqrt(0.5), 0.0001);
});

test("transformVector", function () {
    var q = pc.math.quat.create();
    var v = pc.math.vec3.create(0, 0, 1);

    // Identity quaternion, no rotation
    var r = pc.math.quat.transformVector(q, v);
    QUnit.equal(r[0], 0);
    QUnit.equal(r[1], 0);
    QUnit.equal(r[2], 1);

    // Identity quaternion, no rotation
    pc.math.quat.fromEulerXYZ(180, 0, 0, q);
    var r = pc.math.quat.transformVector(q, v);
    QUnit.close(r[0], 0, 0.0001);
    QUnit.close(r[1], 0, 0.0001);
    QUnit.close(r[2], -1, 0.0001);
});

test("setFromAxisAngle", function () {
    // Identity
    var qi = new pc.Quat();
    var q = new pc.Quat();
    q.setFromAxisAngle(pc.Vec3.RIGHT, 0);
    QUnit.equal(q.x, qi.x);
    QUnit.equal(q.y, qi.y);
    QUnit.equal(q.z, qi.z);
    QUnit.equal(q.w, qi.w);

    var qx = new pc.Quat();
    var qy = new pc.Quat();
    var qz = new pc.Quat();
    var temp = new pc.Quat();

    qx.setFromAxisAngle(pc.Vec3.RIGHT, 45);
    qy.setFromAxisAngle(pc.Vec3.UP, 55);
    qz.setFromAxisAngle(pc.Vec3.BACK, 65);

    temp.mul2(qz, qy);
    temp.mul(qx);

    var qe = new pc.Quat();
    qe.setFromEulers(45, 55, 65);
});

test("toEulers", function () {
    var q;
    var e = new pc.Vec3();

    // Identity quaternion, no rotation
    q = new pc.Quat(0, 0, 0, 1);
    q.toEulers(e);
    QUnit.equal(e.x, 0);
    QUnit.equal(e.y, 0);
    QUnit.equal(e.z, 0);

    // 180° turn around X axis
    q = new pc.Quat(1, 0, 0, 0);
    q.toEulers(e);
    QUnit.equal(e.x, 180);
    QUnit.equal(e.y, 0);
    QUnit.equal(e.z, 0);

    // 180° turn around Y axis (note that 0, 180, 0 is equivalent to 180, 0, 180)
    q = new pc.Quat(0, 1, 0, 0);
    q.toEulers(e);
    QUnit.equal(e.x, 180);
    QUnit.equal(e.y, 0);
    QUnit.equal(e.z, 180);

    // 180° turn around Z axis
    q = new pc.Quat(0, 0, 1, 0);
    q.toEulers(e);
    QUnit.equal(e.x, 0);
    QUnit.equal(e.y, 0);
    QUnit.equal(e.z, 180);

    // 90° turn around X axis
    q = new pc.Quat(Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
    q.toEulers(e);
    QUnit.equal(e.x, 90);
    QUnit.equal(e.y, 0);
    QUnit.equal(e.z, 0);

    // 90° turn around Y axis
    q = new pc.Quat(0, Math.sqrt(0.5), 0, Math.sqrt(0.5));
    q.toEulers(e);
    QUnit.equal(e.x, 0);
    QUnit.equal(e.y, 90);
    QUnit.equal(e.z, 0);

    // 90° turn around Z axis
    q = new pc.Quat(0, 0, Math.sqrt(0.5), Math.sqrt(0.5));
    q.toEulers(e);
    QUnit.equal(e.x, 0);
    QUnit.equal(e.y, 0);
    QUnit.equal(e.z, 90);

    // -90° turn around X axis
    q = new pc.Quat(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
    q.toEulers(e);
    QUnit.equal(e.x, -90);
    QUnit.equal(e.y, 0);
    QUnit.equal(e.z, 0);

    // -90° turn around Y axis
    q = new pc.Quat(0, -Math.sqrt(0.5), 0, Math.sqrt(0.5));
    q.toEulers(e);
    QUnit.equal(e.x, 0);
    QUnit.equal(e.y, -90);
    QUnit.equal(e.z, 0);

    // -90° turn around Z axis
    q = new pc.Quat(0, 0, -Math.sqrt(0.5), Math.sqrt(0.5));
    q.toEulers(e);
    QUnit.equal(e.x, 0);
    QUnit.equal(e.y, 0);
    QUnit.equal(e.z, -90);
});

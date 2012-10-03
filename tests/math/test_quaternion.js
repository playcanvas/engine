module("pc.math.quat");

test("create: args", function () { 
    var q = pc.math.quat.create(1, 2, 3, 4);
    
    QUnit.equal(4, q.length);
    QUnit.equal(q[0], 1);
    QUnit.equal(q[1], 2);
    QUnit.equal(q[2], 3);
    QUnit.equal(q[3], 4);
});

test("create: no args", function () { 
    var q = pc.math.quat.create();
    
    QUnit.equal(4, q.length);
    QUnit.equal(q[0], 0);
    QUnit.equal(q[1], 0);
    QUnit.equal(q[2], 0);
    QUnit.equal(q[3], 1);
});

test("multiply", function () { 
    // I*I = I
    var q1 = pc.math.quat.create();
    var q2 = pc.math.quat.create();
    var q3 = pc.math.quat.create();
    var q4 = pc.math.quat.create();
    var qr = pc.math.quat.create();
    pc.math.quat.multiply(q1, q2, qr);
    QUnit.equal(qr[0], 0);
    QUnit.equal(qr[1], 0);
    QUnit.equal(qr[2], 0);
    QUnit.equal(qr[3], 1);

    // R*Rinv=I
    pc.math.quat.setFromEulers(q1, 90, 0, 0);
    pc.math.quat.setFromEulers(q2, -90, 0, 0);
    pc.math.quat.multiply(q1, q2, qr);
    QUnit.equal(qr[0], 0);
    QUnit.equal(qr[1], 0);
    QUnit.equal(qr[2], 0);
    QUnit.close(qr[3], 1, 0.0001);

    pc.math.quat.setFromEulers(q1, 25, 0, 0);
    pc.math.quat.setFromEulers(q2, 0, 35, 0);
    pc.math.quat.setFromEulers(q3, 0, 0, 45);
    pc.math.quat.multiply(q3, q2, qr);
    pc.math.quat.multiply(qr, q1, qr);
    pc.math.quat.setFromEulers(q4, 25, 35, 45);
    QUnit.close(qr[0], q4[0], 0.0001);
    QUnit.close(qr[1], q4[1], 0.0001);
    QUnit.close(qr[2], q4[2], 0.0001);
    QUnit.close(qr[3], q4[3], 0.0001);
});

test("setFromEulers", function () { 
    function testAngles(x, y, z) {
        var q1 = pc.math.quat.create();
        var q2 = pc.math.quat.create();
        var m = pc.math.mat4.create();

        pc.math.quat.setFromEulers(q1, x * pc.math.RAD_TO_DEG, y * pc.math.RAD_TO_DEG, z * pc.math.RAD_TO_DEG);
        var mr = pc.math.mat4.makeRotate(x, [1, 0, 0]);
        pc.math.mat4.fromEulerXYZ(x, y, z, m);
        pc.math.mat4.toQuat(m, q2);

        QUnit.close(q1[0], q2[0], 0.0001);
        QUnit.close(q1[1], q2[1], 0.0001);
        QUnit.close(q1[2], q2[2], 0.0001);
        QUnit.close(q1[3], q2[3], 0.0001);
    }

    testAngles(0, 0, 0);
    testAngles(Math.PI / 2.0, 0, 0);
    testAngles(0.1, 0, 0);
    testAngles(0, 0.2, 0);
    testAngles(0, 0, 0.3);
    testAngles(0.1, 0.2, 0.3);
    testAngles(-Math.PI / 2.0, -Math.PI / 2.0, 0);
});

test("setFromEulers: useful normalized quaternions", function () { 
    var q = pc.math.quat.create();

    // Identity quaternion, no rotation
    pc.math.quat.setFromEulers(q, 0, 0, 0);
    QUnit.equal(q[0], 0);
    QUnit.equal(q[1], 0);
    QUnit.equal(q[2], 0);
    QUnit.equal(q[3], 1);

    // 180° turn around X axis
    pc.math.quat.setFromEulers(q, 180, 0, 0);
    QUnit.equal(q[0], 1);
    QUnit.equal(q[1], 0);
    QUnit.equal(q[2], 0);
    QUnit.close(q[3], 0, 0.0001);

    // 180° turn around Y axis
    pc.math.quat.setFromEulers(q, 0, 180, 0);
    QUnit.equal(q[0], 0);
    QUnit.close(q[1], 1, 0.0001);
    QUnit.equal(q[2], 0);
    QUnit.close(q[3], 0, 0.0001);

    // 180° turn around Z axis
    pc.math.quat.setFromEulers(q, 0, 0, 180);
    QUnit.equal(q[0], 0);
    QUnit.equal(q[1], 0);
    QUnit.close(q[2], 1, 0.0001);
    QUnit.close(q[3], 0, 0.0001);

    // 90° turn around X axis
    pc.math.quat.setFromEulers(q, 90, 0, 0);
    QUnit.close(q[0], Math.sqrt(0.5), 0.0001);
    QUnit.equal(q[1], 0);
    QUnit.equal(q[2], 0);
    QUnit.close(q[3], Math.sqrt(0.5), 0.0001);

    // 90° turn around Y axis
    pc.math.quat.setFromEulers(q, 0, 90, 0);
    QUnit.equal(q[0], 0);
    QUnit.close(q[1], Math.sqrt(0.5), 0.0001);
    QUnit.equal(q[2], 0);
    QUnit.close(q[3], Math.sqrt(0.5), 0.0001);

    // 90° turn around Z axis
    pc.math.quat.setFromEulers(q, 0, 0, 90);
    QUnit.equal(q[0], 0);
    QUnit.equal(q[1], 0);
    QUnit.close(q[2], Math.sqrt(0.5), 0.0001);
    QUnit.close(q[3], Math.sqrt(0.5), 0.0001);

    // -90° turn around X axis
    pc.math.quat.setFromEulers(q, -90, 0, 0);
    QUnit.close(q[0], -Math.sqrt(0.5), 0.0001);
    QUnit.equal(q[1], 0);
    QUnit.equal(q[2], 0);
    QUnit.close(q[3], Math.sqrt(0.5), 0.0001);

    // -90° turn around Y axis
    pc.math.quat.setFromEulers(q, 0, -90, 0);
    QUnit.equal(q[0], 0);
    QUnit.close(q[1], -Math.sqrt(0.5), 0.0001);
    QUnit.equal(q[2], 0);
    QUnit.close(q[3], Math.sqrt(0.5), 0.0001);

    // -90° turn around Z axis
    pc.math.quat.setFromEulers(q, 0, 0, -90);
    QUnit.equal(q[0], 0);
    QUnit.equal(q[1], 0);
    QUnit.close(q[2], -Math.sqrt(0.5), 0.0001);
    QUnit.close(q[3], Math.sqrt(0.5), 0.0001);
});

test("setFromAxisAngle", function () {
    // Identity
    var qi = pc.math.quat.create();
    var q = pc.math.quat.create();
    pc.math.quat.setFromAxisAngle(q, [1, 0, 0], 0);
    QUnit.equal(q[0], qi[0]);
    QUnit.equal(q[1], qi[1]);
    QUnit.equal(q[2], qi[2]);
    QUnit.equal(q[3], qi[3]);

    var qx = pc.math.quat.create();
    var qy = pc.math.quat.create();
    var qz = pc.math.quat.create();
    var temp = pc.math.quat.create();

    pc.math.quat.setFromAxisAngle(qx, [1, 0, 0], 45);
    pc.math.quat.setFromAxisAngle(qy, [0, 1, 0], 55);
    pc.math.quat.setFromAxisAngle(qz, [0, 0, 1], 65);

    pc.math.quat.multiply(qz, qy, temp);
    pc.math.quat.multiply(temp, qx, temp);

    var qe = pc.math.quat.create();
    pc.math.quat.setFromEulers(qe, 45, 55, 65);
});
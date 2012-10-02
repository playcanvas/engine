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

test("setFromEulers", function () { 
    function testAngles(x, y, z) {
        var q1 = pc.math.quat.create();
        var q2 = pc.math.quat.create();
        var m = pc.math.mat4.create();

        pc.math.quat.setFromEulers(q1, x * pc.math.RAD_TO_DEG, y * pc.math.RAD_TO_DEG, z * pc.math.RAD_TO_DEG);
        var mr = pc.math.mat4.makeRotate(x, [1, 0, 0]);
        pc.math.mat4.fromEulerXYZ(x, y, z, m);
        pc.math.quat.fromMat4(m, q2);

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

    pc.math.quat.setFromEulers(q, -90, -90, 0);
    var qm = pc.math.quat.toMat4(q);
    var m = pc.math.mat4.fromEulerXYZ(-Math.PI / 2.0, -Math.PI / 2.0, 0);
});


test("fromMat4", function () { 
    var m = pc.math.mat4.create();
    var q = pc.math.quat.fromMat4(m);

    QUnit.equal(q[0], 0);
    QUnit.equal(q[1], 0);
    QUnit.equal(q[2], 0);
    QUnit.equal(q[3], 1);

    m = pc.math.mat4.makeRotate(Math.PI, [1, 0, 0]);
    q = pc.math.quat.fromMat4(m);

    QUnit.equal(q[0], 1);
    QUnit.equal(q[1], 0);
    QUnit.equal(q[2], 0);
    QUnit.close(q[3], 0, 0.0001);

    m = pc.math.mat4.makeRotate(-Math.PI / 2.0, [0, 0, 1]);
    q = pc.math.quat.fromMat4(m);

    QUnit.equal(q[0], 0);
    QUnit.equal(q[1], 0);
    QUnit.close(q[2], -Math.sqrt(0.5), 0.0001);
    QUnit.close(q[3], Math.sqrt(0.5), 0.0001);
});

test("setFromAxisAngle", function () {
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
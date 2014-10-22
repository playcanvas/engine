module("pc.Curve");

test("constructor: with args", function () {
    var c = new pc.Curve([0, 0, 1, 1]);
    QUnit.equal(c.length, 2);
});

test("constructor: no args", function () {
    var c = new pc.Curve();
    QUnit.equal(c.length, 0);
});

test("value", function () {
    var c = new pc.Curve([0, 0, 1, 1]);
    c.type = pc.CURVE_LINEAR;
    QUnit.equal(c.value(0.5), 0.5);
});

test("value - same keys", function () {
    var c = new pc.Curve([0, 1, 1, 1]);
    c.type = pc.CURVE_LINEAR;
    QUnit.equal(c.value(0), 1);
    QUnit.equal(c.value(0.5), 1);
    QUnit.equal(c.value(1), 1);
});

test("value - one key", function () {
    var c = new pc.Curve([0.5, 1]);
    c.type = pc.CURVE_LINEAR;
    QUnit.equal(c.value(0), 1);
    QUnit.equal(c.value(0.5), 1);
    QUnit.equal(c.value(1), 1);
});

test("value - two keys", function () {
    var c = new pc.Curve([0.3, 1, 0.6, -1]);
    c.type = pc.CURVE_LINEAR;
    QUnit.equal(c.value(0), 1);
    QUnit.equal(c.value(0.3), 1);
    QUnit.close(c.value(0.45), 0, 0.001);
    QUnit.equal(c.value(0.6), -1);
});

test("value - smoothstep", function () {
    var c = new pc.Curve([0, 0, 1, 1]);
    QUnit.equal(c.value(0.3), 0.3 * 0.3 * (3 - 2 * 0.3));
});

test("add", function () {
    var c = new pc.Curve();
    c.add(1, 1);

    QUnit.equal(c.length, 1);
    QUnit.equal(c.value(0.5), 1);
});

test("add - with existing value", function () {
    var c = new pc.Curve([0.5, 1]);
    c.add(0, 2);

    QUnit.equal(c.length, 2);
    QUnit.equal(c.value(0.5), 1);
    QUnit.equal(c.value(0), 2);
});

test("get", function () {
    var c = new pc.Curve([0, 1]);

    QUnit.equal(c.get(0)[0], 0);
    QUnit.equal(c.get(0)[1], 1);
});

test("closest", function () {
    var c = new pc.Curve([0,1, 0.5, 2, 1, 4]);

    QUnit.equal(c.closest(0.24)[1], 1);
    QUnit.equal(c.closest(0.25)[1], 2);
    QUnit.equal(c.closest(0.74)[1], 2);
    QUnit.equal(c.closest(0.75)[1], 4);
    QUnit.equal(c.closest(0)[1], 1);
    QUnit.equal(c.closest(1)[1], 4);
});
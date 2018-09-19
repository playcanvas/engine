describe("pc.Curve", function () {
    it("constructor: with args", function () {
        var c = new pc.Curve([0, 0, 1, 1]);
        equal(c.length, 2);
    });

    it("constructor: no args", function () {
        var c = new pc.Curve();
        equal(c.length, 0);
    });

    it("value", function () {
        var c = new pc.Curve([0, 0, 1, 1]);
        c.type = pc.CURVE_LINEAR;
        equal(c.value(0.5), 0.5);
    });

    it("value - same keys", function () {
        var c = new pc.Curve([0, 1, 1, 1]);
        c.type = pc.CURVE_LINEAR;
        equal(c.value(0), 1);
        equal(c.value(0.5), 1);
        equal(c.value(1), 1);
    });

    it("value - one key", function () {
        var c = new pc.Curve([0.5, 1]);
        c.type = pc.CURVE_LINEAR;
        equal(c.value(0), 1);
        equal(c.value(0.5), 1);
        equal(c.value(1), 1);
    });

    it("value - two keys", function () {
        var c = new pc.Curve([0.3, 1, 0.6, -1]);
        c.type = pc.CURVE_LINEAR;
        equal(c.value(0), 1);
        equal(c.value(0.3), 1);
        close(c.value(0.45), 0, 0.001);
        equal(c.value(0.6), -1);
    });

    it("value - smoothstep", function () {
        var c = new pc.Curve([0, 0, 1, 1]);
        equal(c.value(0.3), 0.3 * 0.3 * (3 - 2 * 0.3));
    });

    it("add", function () {
        var c = new pc.Curve();
        c.add(1, 1);

        equal(c.length, 1);
        equal(c.value(0.5), 1);
    });

    it("add - with existing value", function () {
        var c = new pc.Curve([0.5, 1]);
        c.add(0, 2);

        equal(c.length, 2);
        equal(c.value(0.5), 1);
        equal(c.value(0), 2);
    });

    it("get", function () {
        var c = new pc.Curve([0, 1]);

        equal(c.get(0)[0], 0);
        equal(c.get(0)[1], 1);
    });

    it("closest", function () {
        var c = new pc.Curve([0,1, 0.5, 2, 1, 4]);

        equal(c.closest(0.24)[1], 1);
        equal(c.closest(0.25)[1], 2);
        equal(c.closest(0.74)[1], 2);
        equal(c.closest(0.75)[1], 4);
        equal(c.closest(0)[1], 1);
        equal(c.closest(1)[1], 4);
    });

});


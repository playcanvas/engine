describe("pc.CurveSet", function () {
    it("constructor: array of arrays", function () {
        var c = new pc.CurveSet([[0, 0, 1, 1], [0,0]]);
        equal(c.length, 2);
    });

    it("constructor: with number", function () {
        var c = new pc.CurveSet(3);
        equal(c.length, 3);
    });

    it("constructor: no args", function () {
        var c = new pc.CurveSet();
        equal(c.length, 1);
    });

    it("value", function () {
        var c = new pc.CurveSet([0, 0, 1, 1], [0, 0, 1, 1]);
        c.type = pc.CURVE_LINEAR;
        equal(c.value(0.5)[0], 0.5);
        equal(c.value(0.5)[1], 0.5);
    });

    it("get", function () {
        var c = new pc.CurveSet([0, 1], [1, 2]);

        equal(c.get(0).get(0)[1], 1);
        equal(c.get(1).get(0)[1], 2);
    });

});


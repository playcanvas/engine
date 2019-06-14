describe('pc.GraphNode', function () {
    beforeEach(function () {
        this.app = new pc.Application(document.createElement('canvas'));
    });

    afterEach(function () {
        this.app.destroy();
    });

    it('Material: trivial custom parameter support', function () {
        var m1 = new pc.Material();
        m1.addCustomParameter("int-value", 42);

        var m2 = m1.clone();

        m1.setParameter("int-value", 24);

        notEqual(m1.parameters["int-value"].data, m2.parameters["int-value"].data);
        equal(m2.parameters["int-value"].data, 42);
    });

    it('Material: string type custom parameter support', function () {
        var m1 = new pc.Material();
        m1.addCustomParameter("str-value", "42", function (s) {
            return s.slice(0);
        });

        var m2 = m1.clone();

        m1.setParameter("str-value", "24");
        notEqual(m1.parameters["str-value"].data, m2.parameters["str-value"].data);
        equal(m2.parameters["str-value"].data, "42");
    });

    it('Material: vector type custom parameter support', function () {
        var m1 = new pc.Material();
        var vec = new Float32Array([1, 2, 3]);
        m1.addCustomParameter("vec-value", vec, function (v) {
            return new Float32Array(v);
        });

        var m2 = m1.clone();

        notEqual(m1.parameters["vec-value"].data, m2.parameters["vec-value"].data);

        vec[0] = 42;

        equal(m1.parameters["vec-value"].data[0], 42);
        equal(m2.parameters["vec-value"].data[0], 1);
    });
});

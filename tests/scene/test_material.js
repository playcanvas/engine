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
});

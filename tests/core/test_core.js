describe("Core", function () {
    it('type', function() {
        var types = [
            null,
            1,
            "a",
            true,
            {},
            [],
            function() {},
            new Date(),
            new RegExp()
        ];
        var expected = [
            "null",
            "number",
            "string",
            "boolean",
            "object",
            "array",
            "function",
            "date",
            "regexp"
        ];
        var index;

        for (index = 0; index < types.length; index++ ) {
            expect(pc.type(types[index])).to.equal(expected[index]);
        }
    });

    it('extend: object, object', function() {
        var o1 = {
            a:"a",
            b:"b"
        };

        var o2 = {
            c:"c",
            d:"d"
        };

        o1 = pc.extend(o1,o2);

        expect(o1.a).to.equal("a");
        expect(o1.b).to.equal("b");
        expect(o1.c).to.equal("c");
        expect(o1.d).to.equal("d");
    });

    it('extend: array, array', function() {
        var a1 = [1,2,3];
        var a2 = [4,5,6];

        a1 = pc.extend(a1,a2);
        expect(a1.length).to.equal(a2.length);
        expect(a1[0]).to.equal(a2[0]);
        expect(a1[1]).to.equal(a2[1]);
        expect(a1[2]).to.equal(a2[2]);
    });

    it('extend: object, array', function() {
        var o1 = {a: "a"};
        var a1 = [1,2];

        var o1 = pc.extend(o1,a1);

        expect(o1.a).to.equal("a");
        expect(o1[0]).to.equal( 1);
        expect(o1[1]).to.equal( 2);
    });

    it('extend: deep object', function() {
        var o1 = {
            A: "A"
        };

        var o2 = {
            a: {b: "b"},
            c: [1,2]
        };

        o1 = pc.extend(o1,o2);

        expect(o1.a.b).to.equal("b");
        expect(o1.c[0]).to.equal(1);
        expect(o1.c[1]).to.equal(2);
        expect(o1.A).to.equal("A");
    });

    it('extend: deep object not reference', function() {
        var o1 = {
            A: "A"
        };

        var o2 = {
            a: {b: "b"},
            c: [1,2]
        };

        o1 = pc.extend(o1,o2);

        // Change original so if o1 contains a reference test will fail
        o2.a.b = "z";

        expect(o1.a.b).to.equal("b");
        expect(o1.c[0]).to.equal(1);
        expect(o1.c[1]).to.equal(2);
        expect(o1.A).to.equal("A");
    });

    it('isDefined', function () {
        var a;
        var b = 1;
        var c = null;
        var d = 1 / 0;

        expect(pc.isDefined(a)).to.equal(false);
        expect(pc.isDefined(b)).to.equal(true);
        expect(pc.isDefined(c)).to.equal(true);
        expect(pc.isDefined(d)).to.equal(true);
    });
});

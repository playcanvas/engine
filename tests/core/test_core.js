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
            expect(pc.type(types[index])).toBe(expected[index]);
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

        expect(o1.a).toBe("a");
        expect(o1.b).toBe("b");
        expect(o1.c).toBe("c");
        expect(o1.d).toBe("d");
    });

    it('extend: array, array', function() {
        var a1 = [1,2,3];
        var a2 = [4,5,6];

        a1 = pc.extend(a1,a2);
        expect(a1.length).toBe(a2.length);
        expect(a1[0]).toBe(a2[0]);
        expect(a1[1]).toBe(a2[1]);
        expect(a1[2]).toBe(a2[2]);
    });

    it('extend: object, array', function() {
        var o1 = {a: "a"};
        var a1 = [1,2];

        var o1 = pc.extend(o1,a1);

        expect(o1.a).toBe("a");
        expect(o1[0]).toBe( 1);
        expect(o1[1]).toBe( 2);
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

        expect(o1.a.b).toBe("b");
        expect(o1.c[0]).toBe(1);
        expect(o1.c[1]).toBe(2);
        expect(o1.A).toBe("A");
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

        expect(o1.a.b).toBe("b");
        expect(o1.c[0]).toBe(1);
        expect(o1.c[1]).toBe(2);
        expect(o1.A).toBe("A");
    });

    it('isDefined', function () {
        var a;
        var b = 1;
        var c = null;
        var d = 1 / 0;

        expect(pc.isDefined(a)).toBe(false);
        expect(pc.isDefined(b)).toBe(true);
        expect(pc.isDefined(c)).toBe(true);
        expect(pc.isDefined(d)).toBe(true);
    });
});

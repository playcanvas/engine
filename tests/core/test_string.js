
describe('pc.string', function () {

    it("format: No args", function() {
        var src = "a string";
        var expected = src;
        var result = pc.string.format(src);

        expect(result).toBe(expected);
    });

    it("format: one arg", function() {
        var src = "a string {0}";
        var expected = "a string abc";
        var result = pc.string.format(src, "abc");

        expect(result).toBe(expected);
    });

    it("format: two args", function() {
        var src = "{0} a string {1}";
        var expected = "abc a string def";
        var result = pc.string.format(src, "abc", "def");

        expect(result).toBe(expected);
    });


    it("toBool: strict", function () {
        expect(true).toBe(pc.string.toBool("true", true));
        expect(false).toBe(pc.string.toBool("false", true));
        expect(function () {
            pc.string.toBool("abc", true);
        }).toThrow();
    });

    it("toBool: non-strict", function () {
        expect(true).toBe(pc.string.toBool("true"));
        expect(false).toBe(pc.string.toBool("false"));
        expect(false).toBe(pc.string.toBool("abc"));
        expect(false).toBe(pc.string.toBool(undefined));
    });

})

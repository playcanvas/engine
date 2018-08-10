
describe('pc.string', function () {

    it("format: No args", function() {
        var src = "a string";
        var expected = src;
        var result = pc.string.format(src);

        expect(result).to.equal(expected);
    });

    it("format: one arg", function() {
        var src = "a string {0}";
        var expected = "a string abc";
        var result = pc.string.format(src, "abc");

        expect(result).to.equal(expected);
    });

    it("format: two args", function() {
        var src = "{0} a string {1}";
        var expected = "abc a string def";
        var result = pc.string.format(src, "abc", "def");

        expect(result).to.equal(expected);
    });


    it("toBool: strict", function () {
        expect(true).to.equal(pc.string.toBool("true", true));
        expect(false).to.equal(pc.string.toBool("false", true));
        expect(function () {
            pc.string.toBool("abc", true);
        }).to.throw;
    });

    it("toBool: non-strict", function () {
        expect(true).to.equal(pc.string.toBool("true"));
        expect(false).to.equal(pc.string.toBool("false"));
        expect(false).to.equal(pc.string.toBool("abc"));
        expect(false).to.equal(pc.string.toBool(undefined));
    });

})

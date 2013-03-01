module('pc.string');

test("format: No args", function() {
	var src = "a string";
	var expected = src;
	var result = pc.string.format(src);
	
	equal(result, expected);
});

test("format: one arg", function() {
    var src = "a string {0}";
    var expected = "a string abc";
    var result = pc.string.format(src, "abc");
    
    equal(result, expected);
});

test("format: two args", function() {
    var src = "{0} a string {1}";
    var expected = "abc a string def";
    var result = pc.string.format(src, "abc", "def");
    
    equal(result, expected);
});


test("toBool: strict", function () {
    strictEqual(true, pc.string.toBool("true", true));
    strictEqual(false, pc.string.toBool("false", true));
    throws(function () {
        pc.string.toBool("abc", true);
    }, Error);
});

test("toBool: non-strict", function () {
    strictEqual(true, pc.string.toBool("true"));
    strictEqual(false, pc.string.toBool("false"));
    strictEqual(false, pc.string.toBool("abc"));
    strictEqual(false, pc.string.toBool(undefined));
});
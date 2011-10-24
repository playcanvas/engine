module('pc.string');

test("format: No args", function() {
	var src = "a string";
	var expected = src;
	var result = pc.string.format(src);
	
	same(result, expected);
});

test("format: one arg", function() {
    var src = "a string {0}";
    var expected = "a string abc";
    var result = pc.string.format(src, "abc");
    
    same(result, expected);
});

test("format: two args", function() {
    var src = "{0} a string {1}";
    var expected = "abc a string def";
    var result = pc.string.format(src, "abc", "def");
    
    same(result, expected);
});



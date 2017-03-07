module('pc.path');

test("path.getDirectory ", function() {
    equal("folder", pc.path.getDirectory("folder/file.txt"));
    equal("folder", pc.path.getDirectory("folder/another"));
    equal("folder/another", pc.path.getDirectory("folder/another/"));
    equal("", pc.path.getDirectory(""));
    equal("", pc.path.getDirectory("/"));
});

test("path.join", function() {
    equal("a/b", pc.path.join("a", "b"));
    equal("/b", pc.path.join("a", "/b"));
    equal("/a/b", pc.path.join("/a", "b"));
    equal("a/b/c", pc.path.join("a", "b/c"));
    equal("a/b/c", pc.path.join("a/b", "c"));
    equal("a/b/", pc.path.join("a", "b/"));
    equal("/b/", pc.path.join("a", "/b/"));
    equal("a/b/", pc.path.join("a", "b/"));
    equal("http://a.com/b", pc.path.join("http://a.com", "b"));
    equal("a/b", pc.path.join("", "a/b"));
    equal("a/b", pc.path.join("a/b", ""));
});

test("path.join, more than two path sections", function () {
    equal("a/b/c", pc.path.join("a", "b", "c"));
    equal("/b/c", pc.path.join("a", "/b", "c"));
    equal("/a/b/c", pc.path.join("/a", "b", "c"));
    equal("a/b/c/d", pc.path.join("a/b", "c", "d"));
    equal("a/b/c/d", pc.path.join("a", "b/c", "d"));
    equal("a/b/c/d", pc.path.join("a", "b", "c/d"));
    equal("a/b/c/", pc.path.join("a", "b", "c/"));
    equal("/b/c/", pc.path.join("a", "/b", "c/"));
    equal("http://a.com/b/c", pc.path.join("http://a.com", "b", "c"));
    equal("b/c/", pc.path.join("", "b", "c/"));
    equal("b/c/", pc.path.join("b", "c/", ""));
    equal("/", pc.path.join("b", "c/", "/"));
    equal("a/b/c/d", pc.path.join("a", "b", "c", "d"));
});

test("path.join, invalid values", function () {
   raises(function(){
       pc.path.join("a", undefined);
   }, "pc.path.join should raise an exception if there is an undefined argument" );
});

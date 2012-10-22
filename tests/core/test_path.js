module('pc.path');

test("path.getDirectory ", function() {
	equal("folder", pc.path.getDirectory("folder/file.txt"));
	same("folder", pc.path.getDirectory("folder/another"));
	same("folder/another", pc.path.getDirectory("folder/another/"));
	same("", pc.path.getDirectory(""));
	same("", pc.path.getDirectory("/"));	
});

test("path.join", function() {
    same("a/b", pc.path.join("a", "b"));
    same("/b", pc.path.join("a", "/b"));
    same("/a/b", pc.path.join("/a", "b"));
    same("a/b/c", pc.path.join("a", "b/c"));
    same("a/b/c", pc.path.join("a/b", "c"));
    same("a/b/", pc.path.join("a", "b/"));
    same("/b/", pc.path.join("a", "/b/"));
    same("a/b/", pc.path.join("a", "b/"));
    same("http://a.com/b", pc.path.join("http://a.com", "b"));
    same("a/b", pc.path.join("", "a/b"));
    same("a/b", pc.path.join("a/b", ""));
});

test("path.join, more than two path sections", function () {
    same("a/b/c", pc.path.join("a", "b", "c"));
    same("/b/c", pc.path.join("a", "/b", "c"));
    same("/a/b/c", pc.path.join("/a", "b", "c"));
    same("a/b/c/d", pc.path.join("a/b", "c", "d"));
    same("a/b/c/d", pc.path.join("a", "b/c", "d"));
    same("a/b/c/d", pc.path.join("a", "b", "c/d"));
    same("a/b/c/", pc.path.join("a", "b", "c/"));
    same("/b/c/", pc.path.join("a", "/b", "c/"));
    same("http://a.com/b/c", pc.path.join("http://a.com", "b", "c"));
    same("b/c/", pc.path.join("", "b", "c/"));
    same("b/c/", pc.path.join("b", "c/", ""));
    same("/", pc.path.join("b", "c/", "/"));
    same("a/b/c/d", pc.path.join("a", "b", "c", "d"));
});

test("path.join, invalid values", function () {
   raises(function(){
       pc.path.join("a", undefined);
   }, "pc.path.join should raise an exception if there is an undefined argument" ); 
});

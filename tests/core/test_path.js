describe('pc.path', function () {
    it("path.getDirectory ", function() {
        expect("folder").toBe(pc.path.getDirectory("folder/file.txt"));
        expect("folder").toBe(pc.path.getDirectory("folder/another"));
        expect("folder/another").toBe(pc.path.getDirectory("folder/another/"));
        expect("").toBe(pc.path.getDirectory(""));
        expect("").toBe(pc.path.getDirectory("/"));
    });

    it("path.join", function() {
        expect("a/b").toBe(pc.path.join("a", "b"));
        expect("/b").toBe(pc.path.join("a", "/b"));
        expect("/a/b").toBe(pc.path.join("/a", "b"));
        expect("a/b/c").toBe(pc.path.join("a", "b/c"));
        expect("a/b/c").toBe(pc.path.join("a/b", "c"));
        expect("a/b/").toBe(pc.path.join("a", "b/"));
        expect("/b/").toBe(pc.path.join("a", "/b/"));
        expect("a/b/").toBe(pc.path.join("a", "b/"));
        expect("http://a.com/b").toBe(pc.path.join("http://a.com", "b"));
        expect("a/b").toBe(pc.path.join("", "a/b"));
        expect("a/b").toBe(pc.path.join("a/b", ""));
    });

    it("path.join, more than two path sections", function () {
        expect("a/b/c").toBe(pc.path.join("a", "b", "c"));
        expect("/b/c").toBe(pc.path.join("a", "/b", "c"));
        expect("/a/b/c").toBe(pc.path.join("/a", "b", "c"));
        expect("a/b/c/d").toBe(pc.path.join("a/b", "c", "d"));
        expect("a/b/c/d").toBe(pc.path.join("a", "b/c", "d"));
        expect("a/b/c/d").toBe(pc.path.join("a", "b", "c/d"));
        expect("a/b/c/").toBe(pc.path.join("a", "b", "c/"));
        expect("/b/c/").toBe(pc.path.join("a", "/b", "c/"));
        expect("http://a.com/b/c").toBe(pc.path.join("http://a.com", "b", "c"));
        expect("b/c/").toBe(pc.path.join("", "b", "c/"));
        expect("b/c/").toBe(pc.path.join("b", "c/", ""));
        expect("/").toBe(pc.path.join("b", "c/", "/"));
        expect("a/b/c/d").toBe(pc.path.join("a", "b", "c", "d"));
    });

    it("path.join, invalid values", function () {
        expect(function(){
           pc.path.join("a", undefined);
        }).toThrow();
    });

})

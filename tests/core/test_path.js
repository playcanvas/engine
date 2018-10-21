describe('pc.path', function () {
    it("path.getDirectory ", function() {
        expect("folder").to.equal(pc.path.getDirectory("folder/file.txt"));
        expect("folder").to.equal(pc.path.getDirectory("folder/another"));
        expect("folder/another").to.equal(pc.path.getDirectory("folder/another/"));
        expect("").to.equal(pc.path.getDirectory(""));
        expect("").to.equal(pc.path.getDirectory("/"));
    });

    it("path.join", function() {
        expect("a/b").to.equal(pc.path.join("a", "b"));
        expect("/b").to.equal(pc.path.join("a", "/b"));
        expect("/a/b").to.equal(pc.path.join("/a", "b"));
        expect("a/b/c").to.equal(pc.path.join("a", "b/c"));
        expect("a/b/c").to.equal(pc.path.join("a/b", "c"));
        expect("a/b/").to.equal(pc.path.join("a", "b/"));
        expect("/b/").to.equal(pc.path.join("a", "/b/"));
        expect("a/b/").to.equal(pc.path.join("a", "b/"));
        expect("http://a.com/b").to.equal(pc.path.join("http://a.com", "b"));
        expect("a/b").to.equal(pc.path.join("", "a/b"));
        expect("a/b").to.equal(pc.path.join("a/b", ""));
    });

    it("path.join, more than two path sections", function () {
        expect("a/b/c").to.equal(pc.path.join("a", "b", "c"));
        expect("/b/c").to.equal(pc.path.join("a", "/b", "c"));
        expect("/a/b/c").to.equal(pc.path.join("/a", "b", "c"));
        expect("a/b/c/d").to.equal(pc.path.join("a/b", "c", "d"));
        expect("a/b/c/d").to.equal(pc.path.join("a", "b/c", "d"));
        expect("a/b/c/d").to.equal(pc.path.join("a", "b", "c/d"));
        expect("a/b/c/").to.equal(pc.path.join("a", "b", "c/"));
        expect("/b/c/").to.equal(pc.path.join("a", "/b", "c/"));
        expect("http://a.com/b/c").to.equal(pc.path.join("http://a.com", "b", "c"));
        expect("b/c/").to.equal(pc.path.join("", "b", "c/"));
        expect("b/c/").to.equal(pc.path.join("b", "c/", ""));
        expect("/").to.equal(pc.path.join("b", "c/", "/"));
        expect("a/b/c/d").to.equal(pc.path.join("a", "b", "c", "d"));
    });

    it("path.join, invalid values", function () {
        expect(function(){
           pc.path.join("a", undefined);
        }).to.throw();
    });

    it("path.normalize normalizes", function () {
        // equal('a/b/c', pc.path.normalize('a/b/c'));
        // equal('/a/b/c', pc.path.normalize('/a/b/c'));
        // equal('a/b/c', pc.path.normalize('a//b/c'));
        // equal('b/c', pc.path.normalize('a/../b/c'));
        // equal('a/b/c', pc.path.normalize('a/./b/c'));
        // equal('a/b', pc.path.normalize('a/b/c/..'));
        // equal('a/b/c/', pc.path.normalize('a/b/c/'));
        // equal('../a/b/c/', pc.path.normalize('../a/b/c/'));
        // // equal('../../a/b/c', pc.path.normalize('../../a/b/c')); // TODO: fix this
        // equal('/', pc.path.normalize('/'));
        // equal('../', pc.path.normalize('../'));
        // equal('./', pc.path.normalize('./'));
        // equal('./', pc.path.normalize('././'));
        // equal('../../', pc.path.normalize('../../'));
        // equal('.', pc.path.normalize('.'));
        // equal('..', pc.path.normalize('./../.'));
    });

})

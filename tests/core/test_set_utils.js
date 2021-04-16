describe("pc.set-utils", function () {
    it("Equal sets", function () {
        var set1 = new Set([1, 2, 3]);
        var set2 = new Set([2, 1, 3]);
        var set3 = new Set([2, 1, 6]);
        var set4 = new Set([1, 2]);

        expect(pc.set.isEqual(set1, set2)).to.equal(true);
        expect(pc.set.isEqual(set1, set3)).to.equal(false);
        expect(pc.set.isEqual(set1, set4)).to.equal(false);
    });

});

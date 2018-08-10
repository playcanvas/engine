describe('pc.Color', function () {

    it('new Color()', function () {
        var c = new pc.Color();

        expect(c.r).to.equal(0);
        expect(c.g).to.equal(0);
        expect(c.b).to.equal(0);
        expect(c.a).to.equal(1);
    });

    it('new Color(1,2,3,4)', function () {
        var c = new pc.Color(1,2,3,4);

        expect(c.r).to.equal(1);
        expect(c.g).to.equal(2);
        expect(c.b).to.equal(3);
        expect(c.a).to.equal(4);
    });

    it('new Color(1,2,3)', function () {
        var c = new pc.Color(1,2,3);

        expect(c.r).to.equal(1);
        expect(c.g).to.equal(2);
        expect(c.b).to.equal(3);
        expect(c.a).to.equal(1);
    });

    it('Color.toString()', function () {
        var c = new pc.Color(1,1,1);
        expect(c.toString()).to.equal('#ffffff');
        expect(c.toString(true)).to.equal('#ffffffff');

        var c = new pc.Color(1,0,1,0);
        expect(c.toString()).to.equal('#ff00ff');
        expect(c.toString(true)).to.equal('#ff00ff00');

        var c = new pc.Color(0.729411780834198, 0.729411780834198, 0.6941176652908325, 1);
        expect(c.toString(true)).to.equal('#babab1ff');
    });

});


describe('pc.Color', function () {

    it('new Color()', function () {
        var c = new pc.Color();

        expect(c.r).toBe(0);
        expect(c.g).toBe(0);
        expect(c.b).toBe(0);
        expect(c.a).toBe(1);
    });

    it('new Color(1,2,3,4)', function () {
        var c = new pc.Color(1,2,3,4);

        expect(c.r).toBe(1);
        expect(c.g).toBe(2);
        expect(c.b).toBe(3);
        expect(c.a).toBe(4);
    });

    it('new Color(1,2,3)', function () {
        var c = new pc.Color(1,2,3);

        expect(c.r).toBe(1);
        expect(c.g).toBe(2);
        expect(c.b).toBe(3);
        expect(c.a).toBe(1);
    });

    it('Color.toString()', function () {
        var c = new pc.Color(1,1,1);
        expect(c.toString()).toBe('#ffffff');
        expect(c.toString(true)).toBe('#ffffffff');

        var c = new pc.Color(1,0,1,0);
        expect(c.toString()).toBe('#ff00ff');
        expect(c.toString(true)).toBe('#ff00ff00');

        var c = new pc.Color(0.729411780834198, 0.729411780834198, 0.6941176652908325, 1);
        expect(c.toString(true)).toBe('#babab1ff');
    });

});


describe("pc.ElementComponent", function() {
    var app;

    beforeEach(function () {
        app = new pc.Application(document.createElement("canvas"));
    });

    afterEach(function () {
        app.destroy();
    });

    it('screen component unbound on reset', function () {
        var screen = new pc.Entity();
        screen.addComponent('screen');
        app.root.addChild(screen);

        var e = new pc.Entity();
        e.addComponent('element');

        screen.addChild(e);

        expect(screen.screen.hasEvent('set:resolution')).to.be.true;
        expect(screen.screen.hasEvent('set:referenceresolution')).to.be.true;
        expect(screen.screen.hasEvent('set:scaleblend')).to.be.true;
        expect(screen.screen.hasEvent('set:screenspace')).to.be.true;
        expect(screen.screen.hasEvent('remove')).to.be.true;

        e.reparent(app.root);

        expect(screen.screen.hasEvent('set:resolution')).to.be.false;
        expect(screen.screen.hasEvent('set:referenceresolution')).to.be.false;
        expect(screen.screen.hasEvent('set:scaleblend')).to.be.false;
        expect(screen.screen.hasEvent('set:screenspace')).to.be.false;
        expect(screen.screen.hasEvent('remove')).to.be.false;
    });

    it('screen component unbound on destroy', function () {
        var screen = new pc.Entity();
        screen.addComponent('screen');
        app.root.addChild(screen);

        var e = new pc.Entity();
        e.addComponent('element');

        screen.addChild(e);

        expect(screen.screen.hasEvent('set:resolution')).to.be.true;
        expect(screen.screen.hasEvent('set:referenceresolution')).to.be.true;
        expect(screen.screen.hasEvent('set:scaleblend')).to.be.true;
        expect(screen.screen.hasEvent('set:screenspace')).to.be.true;
        expect(screen.screen.hasEvent('remove')).to.be.true;

        e.destroy();

        expect(screen.screen.hasEvent('set:resolution')).to.be.false;
        expect(screen.screen.hasEvent('set:referenceresolution')).to.be.false;
        expect(screen.screen.hasEvent('set:scaleblend')).to.be.false;
        expect(screen.screen.hasEvent('set:screenspace')).to.be.false;
        expect(screen.screen.hasEvent('remove')).to.be.false;
    });
});

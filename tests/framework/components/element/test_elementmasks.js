module("pc.Element: Masks", {
    setup: function () {
        this.app = new pc.Application(document.createElement("canvas"));
    }
});

test("add / remove", function () {
    var e = new pc.Entity();
    e.addComponent('element', {
        type: 'image',
        mask: true
    });

    this.app.root.addChild(e);

    e.destroy();

    ok(!e.element);
});

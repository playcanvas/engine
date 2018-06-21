module("pc.Element: Masks", {
    setup: function () {
        this.app = new pc.Application(document.createElement("canvas"));
    },

    teardown: function () {
        this.app.destroy();
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


test("masked children", function () {
    var m1 = new pc.Entity();
    m1.addComponent('element', {
        type: 'image',
        mask: true
    });

    var c1 = new pc.Entity();
    c1.addComponent('element', {
        type: 'image',
    });

    m1.addChild(c1);
    this.app.root.addChild(m1);

    this.app.fire('prerender');

    equal(c1.element.maskedBy.name, m1.name);
});

test("sub-masked children", function () {
    var m1 = new pc.Entity("m1");
    m1.addComponent('element', {
        type: 'image',
        mask: true
    });

    var c1 = new pc.Entity("c1");
    c1.addComponent('element', {
        type: 'image',
        mask: true
    });

    var c2 = new pc.Entity("c2");
    c2.addComponent('element', {
        type: 'image',
    });

    c1.addChild(c2);
    m1.addChild(c1);
    this.app.root.addChild(m1);

    this.app.fire('prerender');

    equal(c1.element.maskedBy.name, m1.name);
    equal(c2.element.maskedBy.name, c1.name);

    equal(m1.element._image._maskRef, 1);
    equal(c1.element._image._maskRef, 2);
});

test("sibling masks, correct maskref", function () {
    // m1   m2
    // |    |
    // c1   c2
    var m1 = new pc.Entity("m1");
    m1.addComponent('element', {
        type: 'image',
        mask: true
    });

    var m2 = new pc.Entity("m2");
    m2.addComponent('element', {
        type: 'image',
        mask: true
    });

    var c1 = new pc.Entity("c1");
    c1.addComponent('element', {
        type: 'image'
    });

    var c2 = new pc.Entity("c2");
    c2.addComponent('element', {
        type: 'image',
    });

    m1.addChild(c1);
    m2.addChild(c2);
    this.app.root.addChild(m1);
    this.app.root.addChild(m2);

    this.app.fire('prerender');

    equal(c1.element.maskedBy.name, m1.name);
    equal(c2.element.maskedBy.name, m2.name);

    equal(m1.element._image._maskRef, 1);
    equal(m2.element._image._maskRef, 2);

});

test("sub-masked and sibling children", function () {
    //    top
    // /        \
    // m1       m2
    // |        |
    // m3       m4
    // |  \     |
    // c2 c3    d2
    var top = new pc.Entity("top")
    top.addComponent('element', {
        type: 'group'
    });

    var m11 = new pc.Entity("m11");
    m11.addComponent('element', {
        type: 'image',
        mask: true
    });

    var m12 = new pc.Entity("m12");
    m12.addComponent('element', {
        type: 'image',
        mask: true
    });

    var m21 = new pc.Entity("m21");
    m21.addComponent('element', {
        type: 'image',
        mask: true
    });

    var c31 = new pc.Entity("c31");
    c31.addComponent('element', {
        type: 'image',
    });

    var c32 = new pc.Entity("c32");
    c32.addComponent('element', {
        type: 'image',
    });

    var m22 = new pc.Entity("m22");
    m22.addComponent('element', {
        type: 'image',
        mask: true
    });

    var d31 = new pc.Entity("d31");
    d31.addComponent('element', {
        type: 'image',
    });

    m21.addChild(c31);
    m21.addChild(c32);
    m11.addChild(m21);

    m22.addChild(d31);
    m12.addChild(m22);

    top.addChild(m11);
    top.addChild(m12);

    this.app.root.addChild(top);

    this.app.fire('prerender');

    equal(m11.element._image._maskRef, 1);
    equal(m21.element.maskedBy.name, m11.name);
    equal(m21.element._image._maskRef, 2);
    equal(c31.element.maskedBy.name, m21.name);
    equal(c32.element.maskedBy.name, m21.name);
    equal(m12.element._image._maskRef, 3);
    equal(m22.element.maskedBy.name, m12.name);
    equal(m22.element._image._maskRef, 4);
    equal(d31.element.maskedBy.name, m22.name);
});

test("parallel parents - sub-masked and sibling children", function () {
    var m1 = new pc.Entity("m1");
    m1.addComponent('element', {
        type: 'image',
        mask: true
    });

    var m2 = new pc.Entity("m2");
    m2.addComponent('element', {
        type: 'image',
        mask: true
    });

    var c1 = new pc.Entity("c1");
    c1.addComponent('element', {
        type: 'image',
        mask: true
    });

    var c2 = new pc.Entity("c2");
    c2.addComponent('element', {
        type: 'image',
    });

    var d1 = new pc.Entity("d1");
    d1.addComponent('element', {
        type: 'image',
        mask: true
    });

    var d2 = new pc.Entity("d2");
    d2.addComponent('element', {
        type: 'image',
    });

    c1.addChild(c2);
    m1.addChild(c1);

    d1.addChild(d2);
    m2.addChild(d1);

    this.app.root.addChild(m1);
    this.app.root.addChild(m2);

    this.app.fire('prerender');

    equal(m1.element._image._maskRef, 1);
    equal(c1.element.maskedBy.name, m1.name);
    equal(c1.element._image._maskRef, 2);
    equal(c2.element.maskedBy.name, c1.name);
    equal(m2.element._image._maskRef, 3);
    equal(d1.element.maskedBy.name, m2.name);
    equal(d1.element._image._maskRef, 4);
    equal(d2.element.maskedBy.name, d1.name);
});

test("sub-masked and later children", function () {
    var m1 = new pc.Entity("m1");
    m1.addComponent('element', {
        type: 'image',
        mask: true
    });

    var c1 = new pc.Entity("c1");
    c1.addComponent('element', {
        type: 'image',
        mask: true
    });

    var c2 = new pc.Entity("c2");
    c2.addComponent('element', {
        type: 'image',
    });

    var c3 = new pc.Entity("c3");
    c3.addComponent('element', {
        type: 'image',
    });

    c1.addChild(c2);
    m1.addChild(c1);
    m1.addChild(c3);

    this.app.root.addChild(m1);

    this.app.fire('prerender');

    equal(m1.element._image._maskRef, 1);
    equal(c1.element.maskedBy.name, m1.name);
    equal(c1.element._image._maskRef, 2);
    equal(c2.element.maskedBy.name, c1.name);
    equal(c3.element.maskedBy.name, m1.name);
    // equal(c3.element._image._maskRef, m1.name);
});


test("", function () {
    var m1 = new pc.Entity("m1");
    m1.addComponent('element', {
        type: 'image',
        mask: true
    });

    var m2 = new pc.Entity("m2");
    m2.addComponent('element', {
        type: 'image',
        mask: true
    });

    var m3 = new pc.Entity("m3");
    m3.addComponent('element', {
        type: 'image',
        mask: true
    });

    var c1 = new pc.Entity("c1");
    c1.addComponent('element', {
        type: 'image',
    });

    var c2 = new pc.Entity("c2");
    c2.addComponent('element', {
        type: 'image',
    });

    m3.addChild(c1);
    m1.addChild(m3);
    m1.addChild(m2);
    m1.addChild(c2);

    this.app.root.addChild(m1);

    this.app.fire('prerender');

    equal(m1.element._image._maskRef, 1);
    equal(m2.element.maskedBy.name, m1.name);
    equal(m2.element._image._maskRef, 2);
    equal(c1.element.maskedBy.name, m2.name);
    equal(m3.element._image._maskRef, 3);
    equal(c2.element.maskedBy.name, m1.name);
});

describe("pc.Element: Masks", function () {
    var app;
    var canvas;

    beforeEach(function () {
        canvas = document.createElement("canvas")
        app = new pc.Application(canvas);
    });

    afterEach(function () {
        app.destroy();
        app = null;
        canvas = null;
    });

    it("add / remove", function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            mask: true
        });

        app.root.addChild(e);

        e.destroy();

        expect(!e.element).to.exist;
    });


    it("masked children", function () {
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
        app.root.addChild(m1);

        app.fire('prerender');

        expect(c1.element.maskedBy.name).to.equal(m1.name);
    });

    it("sub-masked children", function () {
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
        app.root.addChild(m1);

        app.fire('prerender');

        expect(c1.element.maskedBy.name).to.equal(m1.name);
        expect(c2.element.maskedBy.name).to.equal(c1.name);

        expect(m1.element._image._maskRef).to.equal(1);
        expect(c1.element._image._maskRef).to.equal(2);
    });

    it("sibling masks, correct maskref", function () {
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
        app.root.addChild(m1);
        app.root.addChild(m2);

        app.fire('prerender');

        expect(c1.element.maskedBy.name).to.equal(m1.name);
        expect(c2.element.maskedBy.name).to.equal(m2.name);

        expect(m1.element._image._maskRef).to.equal(1);
        expect(m2.element._image._maskRef).to.equal(1);

    });

    it("sub-masked and sibling children", function () {
        //    top
        // /        \
        // m11       m12
        // |        |
        // m21       m22
        // |  \     |
        // c31 c32  d31
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

        app.root.addChild(top);

        app.fire('prerender');

        expect(m11.element._image._maskRef).to.equal(1);
        expect(m21.element.maskedBy.name).to.equal(m11.name);
        expect(m21.element._image._maskRef).to.equal(2);
        expect(c31.element.maskedBy.name).to.equal(m21.name);
        expect(c32.element.maskedBy.name).to.equal(m21.name);
        expect(m12.element._image._maskRef).to.equal(1);
        expect(m22.element.maskedBy.name).to.equal(m12.name);
        expect(m22.element._image._maskRef).to.equal(2);
        expect(d31.element.maskedBy.name).to.equal(m22.name);
    });

    it("parallel parents - sub-masked and sibling children", function () {

        // m11  m12
        // |    |
        // m21  m22
        // |    |
        // c1   d1
        //


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

        var c1 = new pc.Entity("c1");
        c1.addComponent('element', {
            type: 'image',
        });

        var m22 = new pc.Entity("m22");
        m22.addComponent('element', {
            type: 'image',
            mask: true
        });

        var d1 = new pc.Entity("d1");
        d1.addComponent('element', {
            type: 'image',
        });

        m21.addChild(c1);
        m11.addChild(m21);

        m22.addChild(d1);
        m12.addChild(m22);

        app.root.addChild(m11);
        app.root.addChild(m12);

        app.fire('prerender');

        expect(m11.element._image._maskRef).to.equal(1);
        expect(m21.element.maskedBy.name).to.equal(m11.name);
        expect(m21.element._image._maskRef).to.equal(2);
        expect(c1.element.maskedBy.name).to.equal(m21.name);
        expect(m12.element._image._maskRef).to.equal(1);
        expect(m22.element.maskedBy.name).to.equal(m12.name);
        expect(m22.element._image._maskRef).to.equal(2);
        expect(d1.element.maskedBy.name).to.equal(m22.name);
    });

    it("sub-masked and later children", function () {
        // m1
        // |  \
        // m2 c2
        // |
        // c1


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
        });

        var c2 = new pc.Entity("c2");
        c2.addComponent('element', {
            type: 'image',
        });

        m2.addChild(c1);
        m1.addChild(m2);
        m1.addChild(c2);

        app.root.addChild(m1);

        app.fire('prerender');

        expect(m1.element._image._maskRef).to.equal(1);
        expect(m2.element.maskedBy.name).to.equal(m1.name);
        expect(m2.element._image._maskRef).to.equal(2);
        expect(c1.element.maskedBy.name).to.equal(m2.name);
        expect(c2.element.maskedBy.name).to.equal(m1.name);
    });


    it("multiple child masks and later children", function () {
        //    m1
        // /  |  \
        // m2 m3 c2
        // |
        // c1


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

        m2.addChild(c1);
        m1.addChild(m2);
        m1.addChild(m3);
        m1.addChild(c2);

        app.root.addChild(m1);

        app.fire('prerender');

        expect(m1.element._image._maskRef).to.equal(1);
        expect(m2.element.maskedBy.name).to.equal(m1.name);
        expect(m2.element._image._maskRef).to.equal(2);
        expect(c1.element.maskedBy.name).to.equal(m2.name);
        expect(m3.element._image._maskRef).to.equal(2);
        expect(c2.element.maskedBy.name).to.equal(m1.name);
    });

    it("ImageElement outside a mask is culled", function () {
        var screen = new pc.Entity();
        screen.addComponent('screen', {
            screenSpace: true
        });
        app.root.addChild(screen);

        var mask = new pc.Entity();
        mask.addComponent('element', {
            type: 'image',
            width: 100,
            height: 100,
            pivot: [0.5,0.5],
            mask: true
        });
        screen.addChild(mask);

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            width: 50,
            height: 50,
            anchor: [0.5,0.5,0.5,0.5],
            pivot: [0.5,0.5],
        });
        mask.addChild(e);

        var camera = new pc.Entity();
        camera.addComponent('camera');
        app.root.addChild(camera);

        // move just out of parent
        e.translateLocal(76, 0, 0);

        // update transform
        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.false;

        // move just into parent
        e.translateLocal(-2, 0, 0);

        // update transform
        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.true;

    });

    it("TextElement outside a mask is culled", function () {
        var screen = new pc.Entity();
        screen.addComponent('screen', {
            screenSpace: true
        });
        app.root.addChild(screen);

        var mask = new pc.Entity();
        mask.addComponent('element', {
            type: 'image',
            width: 100,
            height: 100,
            pivot: [0.5,0.5],
            mask: true
        });
        screen.addChild(mask);

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'text',
            width: 50,
            height: 50,
            anchor: [0.5,0.5,0.5,0.5],
            pivot: [0.5,0.5],
        });
        mask.addChild(e);

        var camera = new pc.Entity();
        camera.addComponent('camera');
        app.root.addChild(camera);

        // move just out of parent
        e.translateLocal(76, 0, 0);

        // update transform
        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.false;

        // move just into parent
        e.translateLocal(-2, 0, 0);

        // update transform
        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.true;

    });


});


describe("pc.Entity", function () {
    var app;

    beforeEach(function () {
        app = new pc.Application(document.createElement("canvas"));
        app.systems.add(new pc.DummyComponentSystem(app));
    });

    afterEach(function () {
        app.destroy();
    });

    var createSubtree = function() {
        // Naming indicates path within the tree, with underscores separating levels.
        var a = new pc.Entity('a', app);
        var a_a = new pc.Entity('a_a', app);
        var a_b = new pc.Entity('a_b', app);
        var a_a_a = new pc.Entity('a_a_a', app);
        var a_a_b = new pc.Entity('a_a_b', app);

        a.addChild(a_a);
        a.addChild(a_b);

        a_a.addChild(a_a_a);
        a_a.addChild(a_a_b);

        // Add some components for testing clone behaviour
        a.addComponent('animation', { speed: 0.9, loop: true });
        a.addComponent('camera', { nearClip: 2, farClip: 3 });
        a_a.addComponent('rigidbody', { type: 'static' });
        a_a.addComponent('collision', { type: 'sphere', radius: 4 });
        a_a_b.addComponent('light', { type: 'point', color: pc.Color.YELLOW, intensity: 0.5 });
        a_a_b.addComponent('sound', { volume: 0.5, pitch: 0.75 });

        return {
            a: a,
            a_a: a_a,
            a_b: a_b,
            a_a_a: a_a_a,
            a_a_b: a_a_b,
        };
    };

    var cloneSubtree = function(subtree) {
        var a = subtree.a.clone();
        var a_a = a.children[0];
        var a_b = a.children[1];
        var a_a_a = a_a.children[0];
        var a_a_b = a_a.children[1];

        return {
            a: a,
            a_a: a_a,
            a_b: a_b,
            a_a_a: a_a_a,
            a_a_b: a_a_b,
        };
    };

    it("clone() returns a deep clone of the entity's subtree, including all components", function () {
        var subtree1 = createSubtree();
        var subtree2 = cloneSubtree(subtree1);

        // Ensure structures are identical at every level
        strictEqual(subtree2.a.name, 'a');
        strictEqual(subtree2.a.animation.speed, 0.9);
        strictEqual(subtree2.a.animation.loop, true);
        strictEqual(subtree2.a.camera.nearClip, 2);
        strictEqual(subtree2.a.camera.farClip, 3);

        strictEqual(subtree2.a_a.name, 'a_a');
        strictEqual(subtree2.a_a.collision.radius, 4);
        strictEqual(subtree2.a_a.collision.type, 'sphere');
        strictEqual(subtree2.a_a.rigidbody.type, 'static');

        strictEqual(subtree2.a_a_b.name, 'a_a_b');
        strictEqual(subtree2.a_a_b.light.intensity, 0.5);
        strictEqual(subtree2.a_a_b.light.type, 'point');
        deepEqual(subtree2.a_a_b.light.color, pc.Color.YELLOW);
        strictEqual(subtree2.a_a_b.sound.pitch, 0.75);
        strictEqual(subtree2.a_a_b.sound.volume, 0.5);

        strictEqual(subtree2.a_b.name, 'a_b');

        strictEqual(subtree2.a_a_a.name, 'a_a_a');

        // Ensure we only have the exact number of children that were expected
        strictEqual(subtree2.a.children.length, 2);
        strictEqual(subtree2.a_a.children.length, 2);
        strictEqual(subtree2.a_b.children.length, 0);
        strictEqual(subtree2.a_a_a.children.length, 0);
        strictEqual(subtree2.a_a_b.children.length, 0);

        // Ensure copies were created, not references
        notEqual(subtree1.a, subtree2.a);
        notEqual(subtree1.a.animation, subtree2.a.animation);
        notEqual(subtree1.a.camera, subtree2.a.camera);
        notEqual(subtree1.a_a, subtree2.a_a);
        notEqual(subtree1.a_a.collision, subtree2.a_a.collision);
        notEqual(subtree1.a_a.rigidbody, subtree2.a_a.rigidbody);
        notEqual(subtree1.a_b, subtree2.a_b);
        notEqual(subtree1.a_a_a, subtree2.a_a_a);
        notEqual(subtree1.a_a_b, subtree2.a_a_b);
        notEqual(subtree1.a_a_b.light, subtree2.a_a_b.light);
        notEqual(subtree1.a_a_b.sound, subtree2.a_a_b.sound);

        // Ensure new guids were created
        notEqual(subtree1.a.getGuid(), subtree2.a.getGuid());
        notEqual(subtree1.a_a.getGuid(), subtree2.a_a.getGuid());
        notEqual(subtree1.a_b.getGuid(), subtree2.a_b.getGuid());
        notEqual(subtree1.a_a_a.getGuid(), subtree2.a_a_a.getGuid());
        notEqual(subtree1.a_a_b.getGuid(), subtree2.a_a_b.getGuid());
    });

    it("clone() resolves entity property references that refer to entities within the duplicated subtree", function () {
        var subtree1 = createSubtree();
        subtree1.a.addComponent('dummy', { myEntity1: subtree1.a_a.getGuid(), myEntity2: subtree1.a_a_b.getGuid() });
        subtree1.a_a_a.addComponent('dummy', { myEntity1: subtree1.a.getGuid(), myEntity2: subtree1.a_b.getGuid() });

        var subtree2 = cloneSubtree(subtree1);
        strictEqual(subtree2.a.dummy.myEntity1, subtree2.a_a.getGuid());
        strictEqual(subtree2.a.dummy.myEntity2, subtree2.a_a_b.getGuid());
        strictEqual(subtree2.a_a_a.dummy.myEntity1, subtree2.a.getGuid());
        strictEqual(subtree2.a_a_a.dummy.myEntity2, subtree2.a_b.getGuid());
    });

    it("clone() resolves entity property references that refer to the cloned entity itself", function () {
        var subtree1 = createSubtree();
        subtree1.a.addComponent('dummy', { myEntity1: subtree1.a.getGuid() });
        subtree1.a_a_a.addComponent('dummy', { myEntity1: subtree1.a_a_a.getGuid() });

        var subtree2 = cloneSubtree(subtree1);
        strictEqual(subtree2.a.dummy.myEntity1, subtree2.a.getGuid());
        strictEqual(subtree2.a_a_a.dummy.myEntity1, subtree2.a_a_a.getGuid());
    });

    it("clone() does not attempt to resolve entity property references that refer to entities outside of the duplicated subtree", function () {
        var root = new pc.Entity('root', app);
        var sibling = new pc.Entity('sibling', app);

        var subtree1 = createSubtree();
        root.addChild(subtree1.a);
        root.addChild(sibling);

        subtree1.a.addComponent('dummy', { myEntity1: root.getGuid(), myEntity2: sibling.getGuid() });

        var subtree2 = cloneSubtree(subtree1);
        strictEqual(subtree2.a.dummy.myEntity1, root.getGuid());
        strictEqual(subtree2.a.dummy.myEntity2, sibling.getGuid());
    });

    it("clone() ignores null and undefined entity property references", function () {
        var subtree1 = createSubtree();
        subtree1.a.addComponent('dummy', { myEntity1: null, myEntity2: undefined });

        var subtree2 = cloneSubtree(subtree1);
        strictEqual(subtree2.a.dummy.myEntity1, null);
        strictEqual(subtree2.a.dummy.myEntity2, undefined);
    });

    it("clone() resolves entity script attributes that refer to entities within the duplicated subtree", function () {
        var TestScript = pc.createScript('test');
        TestScript.attributes.add('entityAttr', { type: 'entity' });
        TestScript.attributes.add('entityArrayAttr', { type: 'entity', array: true });

        var subtree1 = createSubtree();
        app.root.addChild(subtree1.a);
        subtree1.a.addComponent('script');
        subtree1.a.script.create('test', {
            attributes: {
                entityAttr: subtree1.a_a.getGuid(),
                entityArrayAttr: [subtree1.a_a.getGuid()]
            }
        });
        expect(subtree1.a.script.test.entityAttr.getGuid()).to.equal(subtree1.a_a.getGuid());
        expect(subtree1.a.script.test.entityArrayAttr).to.be.an('array');
        expect(subtree1.a.script.test.entityArrayAttr.length).to.equal(1);
        expect(subtree1.a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree1.a_a.getGuid());

        subtree1.a_a.addComponent('script');
        subtree1.a_a.script.create('test', {
            attributes: {
                entityAttr: subtree1.a.getGuid(),
                entityArrayAttr: [subtree1.a.getGuid(), subtree1.a_a_a.getGuid()]
            }
        });

        expect(subtree1.a_a.script.test.entityAttr.getGuid()).to.equal(subtree1.a.getGuid());
        expect(subtree1.a_a.script.test.entityArrayAttr).to.be.an('array');
        expect(subtree1.a_a.script.test.entityArrayAttr.length).to.equal(2);
        expect(subtree1.a_a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree1.a.getGuid());
        expect(subtree1.a_a.script.test.entityArrayAttr[1].getGuid()).to.equal(subtree1.a_a_a.getGuid());


        var subtree2 = cloneSubtree(subtree1);
        app.root.addChild(subtree2.a);
        expect(subtree2.a.script.test.entityAttr.getGuid()).to.equal(subtree2.a_a.getGuid());
        expect(subtree2.a.script.test.entityArrayAttr).to.be.an('array');
        expect(subtree2.a.script.test.entityArrayAttr.length).to.equal(1);
        expect(subtree2.a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree2.a_a.getGuid());

        expect(subtree2.a_a.script.test.entityAttr.getGuid()).to.equal(subtree2.a.getGuid());
        expect(subtree2.a_a.script.test.entityArrayAttr).to.be.an('array');
        expect(subtree2.a_a.script.test.entityArrayAttr.length).to.equal(2);
        expect(subtree2.a_a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree2.a.getGuid());
        expect(subtree2.a_a.script.test.entityArrayAttr[1].getGuid()).to.equal(subtree2.a_a_a.getGuid());


    });

    it("clone() resolves entity script attributes that refer to entities within the duplicated subtree after preloading has finished", function () {
        var TestScript = pc.createScript('test');
        TestScript.attributes.add('entityAttr', { type: 'entity' });
        TestScript.attributes.add('entityArrayAttr', { type: 'entity', array: true });

        app.systems.script.preloading = false;

        var subtree1 = createSubtree();
        app.root.addChild(subtree1.a);
        subtree1.a.addComponent('script');
        subtree1.a.script.create('test', {
            attributes: {
                entityAttr: subtree1.a_a.getGuid(),
                entityArrayAttr: [subtree1.a_a.getGuid()]
            }
        });
        expect(subtree1.a.script.test.entityAttr.getGuid()).to.equal(subtree1.a_a.getGuid());
        expect(subtree1.a.script.test.entityArrayAttr).to.be.an('array');
        expect(subtree1.a.script.test.entityArrayAttr.length).to.equal(1);
        expect(subtree1.a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree1.a_a.getGuid());

        subtree1.a_a.addComponent('script');
        subtree1.a_a.script.create('test', {
            attributes: {
                entityAttr: subtree1.a.getGuid(),
                entityArrayAttr: [subtree1.a.getGuid(), subtree1.a_a_a.getGuid()]
            }
        });

        expect(subtree1.a_a.script.test.entityAttr.getGuid()).to.equal(subtree1.a.getGuid());
        expect(subtree1.a_a.script.test.entityArrayAttr).to.be.an('array');
        expect(subtree1.a_a.script.test.entityArrayAttr.length).to.equal(2);
        expect(subtree1.a_a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree1.a.getGuid());
        expect(subtree1.a_a.script.test.entityArrayAttr[1].getGuid()).to.equal(subtree1.a_a_a.getGuid());


        var subtree2 = cloneSubtree(subtree1);
        app.root.addChild(subtree2.a);
        expect(subtree2.a.script.test.entityAttr.getGuid()).to.equal(subtree2.a_a.getGuid());
        expect(subtree2.a.script.test.entityArrayAttr).to.be.an('array');
        expect(subtree2.a.script.test.entityArrayAttr.length).to.equal(1);
        expect(subtree2.a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree2.a_a.getGuid());

        expect(subtree2.a_a.script.test.entityAttr.getGuid()).to.equal(subtree2.a.getGuid());
        expect(subtree2.a_a.script.test.entityArrayAttr).to.be.an('array');
        expect(subtree2.a_a.script.test.entityArrayAttr.length).to.equal(2);
        expect(subtree2.a_a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree2.a.getGuid());
        expect(subtree2.a_a.script.test.entityArrayAttr[1].getGuid()).to.equal(subtree2.a_a_a.getGuid());
    });

    it("clone() does not attempt to resolve entity script attributes that refer to entities outside of the duplicated subtree", function () {
        var TestScript = pc.createScript('test');
        TestScript.attributes.add('entityAttr', { type: 'entity' });
        TestScript.attributes.add('entityArrayAttr', { type: 'entity', array: true });

        var subtree1 = createSubtree();
        app.root.addChild(subtree1.a);

        subtree1.a_a.addComponent('script');
        subtree1.a_a.script.create('test', {
            attributes: {
                entityAttr: app.root.getGuid(),
                entityArrayAttr: [subtree1.a.getGuid(), app.root.getGuid()]
            }
        });

        expect(subtree1.a_a.script.test.entityAttr.getGuid()).to.equal(app.root.getGuid());
        expect(subtree1.a_a.script.test.entityArrayAttr).to.be.an('array');
        expect(subtree1.a_a.script.test.entityArrayAttr.length).to.equal(2);
        expect(subtree1.a_a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree1.a.getGuid());
        expect(subtree1.a_a.script.test.entityArrayAttr[1].getGuid()).to.equal(app.root.getGuid());

        var subtree2 = cloneSubtree(subtree1);
        app.root.addChild(subtree2.a);
        expect(subtree2.a_a.script.test.entityAttr.getGuid()).to.equal(app.root.getGuid());
        expect(subtree2.a_a.script.test.entityArrayAttr).to.be.an('array');
        expect(subtree2.a_a.script.test.entityArrayAttr.length).to.equal(2);
        expect(subtree2.a_a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree2.a.getGuid());
        expect(subtree2.a_a.script.test.entityArrayAttr[1].getGuid()).to.equal(app.root.getGuid());

    });

    it("clone() does not resolve entity script attributes that refer to entities within the duplicated subtree if app.useLegacyScriptAttributeCloning is true", function () {
        var TestScript = pc.createScript('test');
        TestScript.attributes.add('entityAttr', { type: 'entity' });
        TestScript.attributes.add('entityArrayAttr', { type: 'entity', array: true });

        var subtree1 = createSubtree();
        app.root.addChild(subtree1.a);
        subtree1.a.addComponent('script');
        subtree1.a.script.create('test', {
            attributes: {
                entityAttr: subtree1.a_a.getGuid(),
                entityArrayAttr: [subtree1.a_a.getGuid()]
            }
        });
        expect(subtree1.a.script.test.entityAttr.getGuid()).to.equal(subtree1.a_a.getGuid());
        expect(subtree1.a.script.test.entityArrayAttr).to.be.an('array');
        expect(subtree1.a.script.test.entityArrayAttr.length).to.equal(1);
        expect(subtree1.a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree1.a_a.getGuid());

        subtree1.a_a.addComponent('script');
        subtree1.a_a.script.create('test', {
            attributes: {
                entityAttr: subtree1.a.getGuid(),
                entityArrayAttr: [subtree1.a.getGuid(), subtree1.a_a_a.getGuid()]
            }
        });

        expect(subtree1.a_a.script.test.entityAttr.getGuid()).to.equal(subtree1.a.getGuid());
        expect(subtree1.a_a.script.test.entityArrayAttr).to.be.an('array');
        expect(subtree1.a_a.script.test.entityArrayAttr.length).to.equal(2);
        expect(subtree1.a_a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree1.a.getGuid());
        expect(subtree1.a_a.script.test.entityArrayAttr[1].getGuid()).to.equal(subtree1.a_a_a.getGuid());

        app.useLegacyScriptAttributeCloning = true;

        var subtree2 = cloneSubtree(subtree1);
        app.root.addChild(subtree2.a);
        expect(subtree2.a.script.test.entityAttr.getGuid()).to.equal(subtree1.a_a.getGuid());
        expect(subtree2.a.script.test.entityArrayAttr).to.be.an('array');
        expect(subtree2.a.script.test.entityArrayAttr.length).to.equal(1);
        expect(subtree2.a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree1.a_a.getGuid());

        expect(subtree2.a_a.script.test.entityAttr.getGuid()).to.equal(subtree1.a.getGuid());
        expect(subtree2.a_a.script.test.entityArrayAttr).to.be.an('array');
        expect(subtree2.a_a.script.test.entityArrayAttr.length).to.equal(2);
        expect(subtree2.a_a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree1.a.getGuid());
        expect(subtree2.a_a.script.test.entityArrayAttr[1].getGuid()).to.equal(subtree1.a_a_a.getGuid());


    });

    it("findByGuid() returns same entity", function () {
        var e = new pc.Entity();
        expect(e.findByGuid(e.getGuid())).to.equal(e);
    });

    it("findByGuid() returns direct child entity", function () {
        var e = new pc.Entity();
        var c = new pc.Entity();
        e.addChild(c);
        expect(e.findByGuid(c.getGuid())).to.equal(c);
    });

    it("findByGuid() returns child of child entity", function () {
        var e = new pc.Entity();
        var c = new pc.Entity();
        var c2 = new pc.Entity();
        e.addChild(c);
        c.addChild(c2);
        expect(e.findByGuid(c2.getGuid())).to.equal(c2);
    });

    it("findByGuid() does not return parent", function () {
        var e = new pc.Entity();
        var c = new pc.Entity();
        e.addChild(c);
        expect(c.findByGuid(e.getGuid())).to.equal(null);
    });

    it("findByGuid() does not return destroyed entity", function () {
        var e = new pc.Entity();
        var c = new pc.Entity();
        e.addChild(c);
        c.destroy();
        expect(e.findByGuid(c.getGuid())).to.equal(null);
    });

    it("findByGuid() does not return entity that was removed from hierarchy", function () {
        var e = new pc.Entity();
        var c = new pc.Entity();
        e.addChild(c);
        e.removeChild(c);
        expect(e.findByGuid(c.getGuid())).to.equal(null);
    });

    it("findByGuid() does not return entity that does not exist", function () {
        expect(app.root.findByGuid('missing')).to.equal(null);
    });

});

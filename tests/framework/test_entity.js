(function() {
    // ------------------------------------------------------------------------------
    // Dummy component type used for testing the ability of an entity to successfully
    // clone its components.

    var DummyComponent = function DummyComponent() {};
    DummyComponent = pc.inherits(DummyComponent, pc.Component);

    var DummyComponentData = function DummyComponentData() {};
    DummyComponentData = pc.inherits(DummyComponentData, pc.ComponentData);

    var dummySchema = [
        'enabled',
        { name: 'myEntity1', type: 'entity' },
        { name: 'myEntity2', type: 'entity' }
    ];

    var DummyComponentSystem = function DummyComponentSystem(app) {
        this.id = 'dummy';
        this.app = app;
        app.systems.add(this.id, this);

        this.ComponentType = DummyComponent;
        this.DataType = DummyComponentData;
        this.schema = dummySchema;
    };
    DummyComponentSystem = pc.inherits(DummyComponentSystem, pc.ComponentSystem);

    pc.Component._buildAccessors(DummyComponent.prototype, dummySchema);

    DummyComponentSystem.prototype.initializeComponentData = function (component, data, properties) {
        DummyComponentSystem._super.initializeComponentData.call(this, component, data, dummySchema);
    };

    // ------------------------------------------------------------------------------

    module("pc.Entity", {
        setup: function () {
            this.app = new pc.Application(document.createElement("canvas"));

            new DummyComponentSystem(this.app);
        },

        createSubtree: function() {
            // Naming indicates path within the tree, with underscores separating levels.
            var a = new pc.Entity('a', this.app);
            var a_a = new pc.Entity('a_a', this.app);
            var a_b = new pc.Entity('a_b', this.app);
            var a_a_a = new pc.Entity('a_a_a', this.app);
            var a_a_b = new pc.Entity('a_a_b', this.app);

            a.addChild(a_a);
            a.addChild(a_b);

            a_a.addChild(a_a_a);
            a_a.addChild(a_a_b);

            // Add some components for testing clone behaviour
            a.addComponent('animation', { speed: 1, loop: true });
            a.addComponent('camera', { nearClip: 2, farClip: 3 });
            a_a.addComponent('collision', { radius: 4, height: 5 });
            a_a.addComponent('light', { attenuationStart: 6, attenuationEnd: 7 });
            a_a_b.addComponent('rigidbody', { point: new pc.Vec3(1, 2, 3), normal: new pc.Vec3(4, 5, 6) });
            a_a_b.addComponent('sound', { volume: 8, pitch: 9 });

            return {
                a: a,
                a_a: a_a,
                a_b: a_b,
                a_a_a: a_a_a,
                a_a_b: a_a_b,
            };
        },

        cloneSubtree: function(subtree) {
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
        },

        teardown: function () {
            this.app.destroy();
        }
    });

    test("clone() returns a deep clone of the entity's subtree, including all components", function () {
        var subtree1 = this.createSubtree();
        var subtree2 = this.cloneSubtree(subtree1);

        // Ensure structures are identical at every level
        strictEqual(subtree1.a.name, subtree2.a.name);
        strictEqual(subtree1.a.animation.speed, subtree2.a.animation.speed);
        strictEqual(subtree1.a.animation.loop, subtree2.a.animation.loop);
        strictEqual(subtree1.a.camera.nearClip, subtree2.a.camera.nearClip);
        strictEqual(subtree1.a.camera.farClip, subtree2.a.camera.farClip);

        strictEqual(subtree1.a_a.name, subtree2.a_a.name);
        strictEqual(subtree1.a_a.collision.radius, subtree2.a_a.collision.radius);
        strictEqual(subtree1.a_a.collision.height, subtree2.a_a.collision.height);
        strictEqual(subtree1.a_a.light.attenuationStart, subtree2.a_a.light.attenuationStart);
        strictEqual(subtree1.a_a.light.attenuationEnd, subtree2.a_a.light.attenuationEnd);

        strictEqual(subtree1.a_b.name, subtree2.a_b.name);
        strictEqual(subtree1.a_a_a.name, subtree2.a_a_a.name);
        strictEqual(subtree1.a_a_b.name, subtree2.a_a_b.name);
        deepEqual(subtree1.a_a_b.rigidbody.point, subtree2.a_a_b.rigidbody.point);
        deepEqual(subtree1.a_a_b.rigidbody.normal, subtree2.a_a_b.rigidbody.normal);
        strictEqual(subtree1.a_a_b.sound.volume, subtree2.a_a_b.sound.volume);
        strictEqual(subtree1.a_a_b.sound.pitch, subtree2.a_a_b.sound.pitch);

        // Ensure we only have the exact number of children that were expected
        strictEqual(subtree1.a.children.length, subtree2.a.children.length);
        strictEqual(subtree1.a_a.children.length, subtree2.a_a.children.length);
        strictEqual(subtree1.a_b.children.length, subtree2.a_b.children.length);
        strictEqual(subtree1.a_a_a.children.length, subtree2.a_a_a.children.length);
        strictEqual(subtree1.a_a_b.children.length, subtree2.a_a_b.children.length);

        // Ensure copies were created, not references
        notEqual(subtree1.a, subtree2.a);
        notEqual(subtree1.a.animation, subtree2.a.animation);
        notEqual(subtree1.a.camera, subtree2.a.camera);
        notEqual(subtree1.a_a, subtree2.a_a);
        notEqual(subtree1.a_a.collision, subtree2.a_a.collision);
        notEqual(subtree1.a_a.light, subtree2.a_a.light);
        notEqual(subtree1.a_b, subtree2.a_b);
        notEqual(subtree1.a_a_a, subtree2.a_a_a);
        notEqual(subtree1.a_a_b, subtree2.a_a_b);
        notEqual(subtree1.a_a_b.rigidbody, subtree2.a_a_b.rigidbody);
        notEqual(subtree1.a_a_b.sound, subtree2.a_a_b.sound);

        // Ensure new guids were created
        notEqual(subtree1.a.getGuid(), subtree2.a.getGuid());
        notEqual(subtree1.a_a.getGuid(), subtree2.a_a.getGuid());
        notEqual(subtree1.a_b.getGuid(), subtree2.a_b.getGuid());
        notEqual(subtree1.a_a_a.getGuid(), subtree2.a_a_a.getGuid());
        notEqual(subtree1.a_a_b.getGuid(), subtree2.a_a_b.getGuid());
    });

    test("clone() resolves entity property references that refer to entities within the duplicated subtree", function () {
        var subtree1 = this.createSubtree();
        subtree1.a.addComponent('dummy', { myEntity1: subtree1.a_a.getGuid(), myEntity2: subtree1.a_a_b.getGuid() });
        subtree1.a_a_a.addComponent('dummy', { myEntity1: subtree1.a.getGuid(), myEntity2: subtree1.a_b.getGuid() });

        var subtree2 = this.cloneSubtree(subtree1);
        strictEqual(subtree2.a.dummy.myEntity1, subtree2.a_a.getGuid());
        strictEqual(subtree2.a.dummy.myEntity2, subtree2.a_a_b.getGuid());
        strictEqual(subtree2.a_a_a.dummy.myEntity1, subtree2.a.getGuid());
        strictEqual(subtree2.a_a_a.dummy.myEntity2, subtree2.a_b.getGuid());
    });

    test("clone() does not attempt to resolve entity property references that refer to entities outside of the duplicated subtree", function () {
        var root = new pc.Entity('root', this.app);
        var sibling = new pc.Entity('sibling', this.app);

        var subtree1 = this.createSubtree();
        root.addChild(subtree1.a);
        root.addChild(sibling);

        subtree1.a.addComponent('dummy', { myEntity1: root.getGuid(), myEntity2: sibling.getGuid() });

        var subtree2 = this.cloneSubtree(subtree1);
        strictEqual(subtree2.a.dummy.myEntity1, root.getGuid());
        strictEqual(subtree2.a.dummy.myEntity2, sibling.getGuid());
    });

    test("clone() ignores null and undefined entity property references", function () {
        var subtree1 = this.createSubtree();
        subtree1.a.addComponent('dummy', { myEntity1: null, myEntity2: undefined });

        var subtree2 = this.cloneSubtree(subtree1);
        strictEqual(subtree2.a.dummy.myEntity1, null);
        strictEqual(subtree2.a.dummy.myEntity2, undefined);
    });
})();

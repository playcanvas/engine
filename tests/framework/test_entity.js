module('pc.fw.Entity', {
    setup: function () {
        var count = 0;
        var Clonable = function () {
            this.value = count++;
            this.clone = function () {
                return new Clonable();
            }
        };

        DerivedSystem = function () {
            this.id = 'derived';
            this.DataType = DerivedComponentData;
            this.ComponentType = DerivedComponent;
            this.schema = [{
                name: 'enabled',
                type: 'boolean',
                defaultValue: true
            },{
                name: 'one',
                type: 'array'
            }, {
                name: 'two',
                type: 'number'
            }, {
                name: 'clonable',
                exposed: false
            }];
        };
        DerivedSystem = pc.inherits(DerivedSystem, pc.fw.ComponentSystem);
        pc.extend(DerivedSystem.prototype, {
            initializeComponentData: function (component, data, properties) {
                DerivedSystem._super.initializeComponentData.call(this, component, data, ['enabled', 'one', 'two', 'clonable']);

                component.one = [1,2,3];
                component.two = 42;
                component.clonable = new Clonable();
            }
        });

        DerivedComponent = function (entity) {
        };
        DerivedComponent = pc.inherits(DerivedComponent, pc.fw.Component);
        pc.extend(DerivedComponent.prototype, {
            onEnable: function () {
                DerivedComponent._super.onEnable.call(this);
                this.entity.onEnabledCalled = true;
            },

            onDisable: function () {
                DerivedComponent._super.onDisable.call(this);
                this.entity.onDisableCalled = true;
            }
        });

        DerivedComponentData = function () {
            this.one = null;
            this.two = null;
            this.clonable = null;
            this.enabled = true;
        };
        DerivedComponentData = pc.inherits(DerivedComponentData, pc.fw.ComponentData);
    }
});



test("New", function () {
    var e = new pc.fw.Entity();
    ok(e);
});

test("setGuid/getGuid", function () {
    jack(function () {

        var gm = jack.create("gm", ["addNode", "removeNode"]);

        var e = new pc.fw.Entity();

        e.setGuid("123", gm);

        equal(e.getGuid(), "123");

    });
});

test('clone', function () {
    var e = new pc.fw.Entity();

    var c = e.clone();

    notEqual(e.getGuid(), c.getGuid());
    equal(e.getName(), c.getName());
    deepEqual(e.getLocalPosition(), c.getLocalPosition());
    deepEqual(e.getLocalRotation(), c.getLocalRotation());
    deepEqual(e.getLocalScale(), c.getLocalScale());
});

test('clone - component', function () {

    var system = new DerivedSystem();

    var e = new pc.fw.Entity();
    system.addComponent(e);

    var c = e.clone();

    notEqual(e.derived.one, c.derived.one);
    deepEqual(e.derived.one, c.derived.one);

    equal(e.derived.two, c.derived.two);

    notEqual(e.derived.clonable, c.derived.clonable);
    equal(c.derived.clonable.value, 1);

});

test('reparent entity', function () {
    var e = new pc.fw.Entity();
    var child = new pc.fw.Entity();
    e.addChild(child);

    equal(child.getParent(), e);
    var e2 = new pc.fw.Entity();
    child.reparent(e2);
    equal(child.getParent(), e2);
});

test('disable entity', function () {
    var e = new pc.fw.Entity();
    equal(e.enabled, true);
    e.enabled = false;
    equal(e.enabled, false);
});

test('disable entity with child', function () {
    var e = new pc.fw.Entity();
    var child = new pc.fw.Entity();
    e.addChild(child);

    equal(child.enabled, true);

    e.enabled = false;
    equal(child.enabled, false);

    e.enabled = true;
    equal(child.enabled, true);
});

test('reparent disabled', function () {
    var e = new pc.fw.Entity();
    var child = new pc.fw.Entity();
    e.addChild(child);
    e.enabled = false;
    equal(child.enabled, false);

    var e2 = new pc.fw.Entity();
    child.reparent(e2);
    equal(child.enabled, true);
})

test('reparent 2 levels deep - disabled', function () {
    var entity_level0 = new pc.fw.Entity();
    var entity_level1 = new pc.fw.Entity();
    var entity_level2 = new pc.fw.Entity();
    entity_level0.addChild(entity_level1);
    entity_level1.addChild(entity_level2);

    entity_level0.enabled = false;
    equal(entity_level2.enabled, false);

    var entity2_levelRoot = new pc.fw.Entity();
    entity_level1.reparent(entity2_levelRoot);
    equal(entity_level2.enabled, true);
})

test('destroy entity disables components', function () {
    var system = new DerivedSystem();

    var e = new pc.fw.Entity();
    system.addComponent(e);

    notEqual(e.onDisableCalled, true);
    e.destroy();
    equal(e.onDisableCalled, true);
})

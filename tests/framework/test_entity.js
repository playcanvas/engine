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
                DerivedSystem._super.initializeComponentData.call(this, component, data, ['one', 'two', 'clonable']);

                component.one = [1,2,3];
                component.two = 42;
                component.clonable = new Clonable();
            }
        });

        DerivedComponent = function (entity) {
        };
        DerivedComponent = pc.inherits(DerivedComponent, pc.fw.Component);
        pc.extend(DerivedComponent.prototype, {
        });

        DerivedComponentData = function () {
            this.one = null;
            this.two = null;
            this.clonable = null;
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
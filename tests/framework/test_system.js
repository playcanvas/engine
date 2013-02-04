var system;
var DerivedSystem;
var DerivedComponent;
var DerivedComponentData;

module('pc.fw.ComponentSystem', {
    setup: function () {
        DerivedSystem = function () {
            this.id = 'derived';
            this.DataType = DerivedComponentData;
            this.ComponentType = DerivedComponent;
            this.schema = [{
                name: 'one',
                type: 'number'
            }, {
                name: 'two',
                type: 'number'
            }];
        };
        DerivedSystem = pc.inherits(DerivedSystem, pc.fw.ComponentSystem);
        pc.extend(DerivedSystem.prototype, {
            initializeComponentData: function (component, data, properties) {
                DerivedSystem._super.initializeComponentData.call(this, component, data, ['one', 'two']);
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
        };
        DerivedComponentData = pc.inherits(DerivedComponentData, pc.fw.ComponentData);

        // Create new system
        system = new DerivedSystem();
    }, 
    teardown: function () {
        delete DerivedSystem;
        delete DerivedComponent;
        delete DerivedComponentData;

        delete system;
    }
    
});

test("ComponentSystem has correct id", function () {
    var entity = {};

    equal(system.id, 'derived');
});

test("ComponentSystem.addComponent", function () {
    var entity = new pc.fw.Entity();

    var c = system.addComponent(entity, {
        one: 1
    });

    equal(entity.derived, c);
});

test("ComponentSystem.addComponent, multiple systems", function () {
    AnotherDerivedSystem = function (entity) {
        this.id = 'another';
        this.ComponentType = AnotherDerivedComponent;
        this.DataType = AnotherDerivedComponentData;
        this.schema = [{
            name: 'three',
            type: 'number'
        }];

    };
    AnotherDerivedSystem = pc.inherits(AnotherDerivedSystem, pc.fw.ComponentSystem);
    pc.extend(AnotherDerivedSystem.prototype, {
        initializeComponentData: function (componentData, data, properties) {
            AnotherDerivedSystem._super.initializeComponentData.call(this, componentData, data, ['three']);
        }
    });

    AnotherDerivedComponent = function () {
    };
    AnotherDerivedComponent = pc.inherits(AnotherDerivedComponent, pc.fw.Component);

    AnotherDerivedComponentData = function () {
        this.three = null;
    }
    AnotherDerivedComponentData = pc.inherits(AnotherDerivedComponentData, pc.fw.ComponentData);

    var anothersystem = new AnotherDerivedSystem();

    var entity = new pc.fw.Entity();
    
    var c = system.addComponent(entity, {
        one: 1
    });
    
    var anotherc = anothersystem.addComponent(entity, {
        three: 3
    });

    equal(system.id, 'derived');
    equal(anothersystem.id, 'another');

    equal(c.data['one'], 1)
    equal(c.data['three'], undefined)
    
    equal(anotherc.data['three'], 3)
    equal(anotherc.data['one'], undefined)
});

test("Event: 'add'", function () {
    var entity = new pc.fw.Entity();

    system.on('add', function (e, component) {
        equal(e.getGuid(), entity.getGuid());
        equal(component.data.one, 1);
        equal(component.data.two, 2);
    });

    system.addComponent(entity, {
        one: 1,
        two: 2
    });

});

test("ComponentSystem.removeComponent", function () {
    var entity = new pc.fw.Entity();
    var system = new DerivedSystem(entity);

    var c = system.addComponent(entity, {
        one: 1,
        two: 2
    });

    system.removeComponent(entity);

    equal(entity.derived, null);
    equal(system.store[entity.getGuid()], undefined);
})

test("Event: 'remove'", function () {
    var entity = new pc.fw.Entity();
    var system = new DerivedSystem(entity);
    
    system.on('remove', function (e) {
        equal(e.getGuid(), entity.getGuid());
    });

    system.addComponent(entity, {
        one: 1,
        two: 2
    });

    system.removeComponent(entity);
});

test("get value from component", function() {
    var entity = new pc.fw.Entity();
    var system = new DerivedSystem(entity);

    system.addComponent(entity, {
        one: 1,
        two: 2
    });
    
    equal(entity.derived.one, 1);
});

test("set value on component", function() {
    var entity = new pc.fw.Entity();
    var system = new DerivedSystem(entity);

    var c = system.addComponent(entity, {
        one: 1,
        two: 2
    });

    entity.derived.one = 3;
    
    equal(entity.derived.one, 3);
    equal(c.data['one'], 3);
});

test("set events", 2, function () {
    AnotherDerivedSystem = function (entity) {
        this.id = 'another';
        this.ComponentType = AnotherDerivedComponent;
        this.DataType = AnotherDerivedComponentData;
        this.schema = [{
            name: 'one',
            type: 'number'
        }];
    };
    AnotherDerivedSystem = pc.inherits(AnotherDerivedSystem, pc.fw.ComponentSystem);
    pc.extend(AnotherDerivedSystem.prototype, {
        initializeComponentData: function (componentData, data, properties) {
            AnotherDerivedSystem._super.initializeComponentData.call(this, componentData, data, ['one']);
        }
    });

    AnotherDerivedComponent = function () {
        this.bind("set_one", this.onSetOne.bind(this));
    };
    AnotherDerivedComponent = pc.inherits(AnotherDerivedComponent, pc.fw.Component);
    pc.extend(AnotherDerivedComponent.prototype, {
        onSetOne: function (name, oldValue, newValue) {
            equal(newValue, 1);
            equal(oldValue, null);
        }
    });

    AnotherDerivedComponentData = function () {
        this.one = null;
    }
    AnotherDerivedComponentData = pc.inherits(AnotherDerivedComponentData, pc.fw.ComponentData);

    var anothersystem = new AnotherDerivedSystem();
    var entity = new pc.fw.Entity();
    anothersystem.addComponent(entity, {
        one: 1
    });
});
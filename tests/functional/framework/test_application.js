module("pc.fw.Application", {
    setup: function () {
        var canvas = document.getElementById("test-canvas")
        application = new pc.fw.Application(canvas, {});
        
        TestComponent = function (entity) {};
        TestComponent = pc.inherits(TestComponent, pc.fw.ComponentSystem);
        TestComponent.prototype.createComponent = function (entity) {
            var data = new pc.fw.ComponentData(entity);
            
            this.addComponent(entity, data);
            return data;
        }
    },
    teardown: function () {
        delete application;
        delete TestComponent;
        
        pc.script.setLoader(null);
    }
    
});

test("_updateEntity, add a component", function () {
    var entity = new pc.fw.Entity();
    application.context.root.addChild(entity);
    
    application.context.systems.add("abc", new TestComponent());
    application.context.systems.add("def", new TestComponent());
    application.context.systems.add("ghi", new TestComponent());
    
    application.context.systems.abc.createComponent(entity);
    application.context.systems.def.createComponent(entity);
    
    var components = {
        "abc": {},
        "def": {},
        "ghi": {}
    };
    
    application._updateEntity(entity.getGuid(), components);
    
    equal(application.context.systems.abc.hasComponent(entity), true);
    equal(application.context.systems.def.hasComponent(entity), true);
    equal(application.context.systems.ghi.hasComponent(entity), true);
    
});


test("_updateEntity, remove a component", function () {
    var entity = new pc.fw.Entity();
    application.context.root.addChild(entity);
    
    application.context.systems.add("abc", new TestComponent());
    application.context.systems.add("def", new TestComponent());
    application.context.systems.add("ghi", new TestComponent());
    
    application.context.systems.abc.createComponent(entity);
    application.context.systems.def.createComponent(entity);
    application.context.systems.ghi.createComponent(entity);
    
    var components = {
        "abc": {},
        "def": {}
    };
    
    application._updateEntity(entity.getGuid(), components);
    
    equal(application.context.systems.abc.hasComponent(entity), true);
    equal(application.context.systems.def.hasComponent(entity), true);
    equal(application.context.systems.ghi.hasComponent(entity), false);
    
});

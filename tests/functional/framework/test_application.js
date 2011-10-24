module("pc.fw.Application", {
    setup: function () {
        var canvas = document.getElementById("test-canvas")
        application = new pc.fw.Application(canvas, {});
        
        TestComponent = function (entity) {};
        TestComponent = TestComponent.extendsFrom(pc.fw.Component);
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
    
    application.context.components.add("abc", new TestComponent());
    application.context.components.add("def", new TestComponent());
    application.context.components.add("ghi", new TestComponent());
    
    application.context.components.abc.createComponent(entity);
    application.context.components.def.createComponent(entity);
    
    var components = {
        "abc": {},
        "def": {},
        "ghi": {}
    };
    
    application._updateEntity(entity.getGuid(), components);
    
    equal(application.context.components.abc.hasComponent(entity), true);
    equal(application.context.components.def.hasComponent(entity), true);
    equal(application.context.components.ghi.hasComponent(entity), true);
    
});


test("_updateEntity, remove a component", function () {
    var entity = new pc.fw.Entity();
    application.context.root.addChild(entity);
    
    application.context.components.add("abc", new TestComponent());
    application.context.components.add("def", new TestComponent());
    application.context.components.add("ghi", new TestComponent());
    
    application.context.components.abc.createComponent(entity);
    application.context.components.def.createComponent(entity);
    application.context.components.ghi.createComponent(entity);
    
    var components = {
        "abc": {},
        "def": {}
    };
    
    application._updateEntity(entity.getGuid(), components);
    
    equal(application.context.components.abc.hasComponent(entity), true);
    equal(application.context.components.def.hasComponent(entity), true);
    equal(application.context.components.ghi.hasComponent(entity), false);
    
});

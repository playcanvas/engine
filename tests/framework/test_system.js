module('pc.fw.ComponentSystem', {
    setup: function () {
    }, 
    teardown: function () {
    }
    
});

test("get: access component", function() {
    
    var entity = new pc.fw.Entity();
    var scene = new pc.scene.Scene();
    var registry = new pc.fw.ComponentSystemRegistry();
    var loader = new pc.resources.ResourceLoader();
    var context = new pc.fw.ApplicationContext(loader, scene, registry);
    var system = new pc.fw.ComponentSystem(context);
    
    registry.add("test", system);
    
    system.addComponent(entity, {"key":"value"});
    
    equal(context.systems.test.get(entity, "key"), "value");
    
});

test("get: Component accessor", function () {
    var entity = new pc.fw.Entity();
    var scene = new pc.scene.Scene();
    var registry = new pc.fw.ComponentSystemRegistry();
    var loader = new pc.resources.ResourceLoader();
    var context = new pc.fw.ApplicationContext(loader, scene, registry);
    var system = new pc.fw.ComponentSystem(context);
    
    system._key = function (component, k) {
        return "value";
    }
    registry.add("test", system);
    
    system.addComponent(entity, {});
        
    equal(context.systems.test.get(entity, "key"), "value");    
});

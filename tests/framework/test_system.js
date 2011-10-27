module('pc.fw.ComponentSystem', {
    setup: function () {
        pc.graph.JsonLoader = function () {
        };        
    }, 
    teardown: function () {
        delete pc.graph.JsonLoader;
    }
    
});

test("get: access component", function() {
    
    var entity = new pc.fw.Entity();
    var scene = new pc.scene.Scene();
    var registry = new pc.fw.ComponentSystemRegistry();
    var loaders = new pc.resources.LoaderManager();
    var context = new pc.fw.ApplicationContext(loaders, scene, registry);
    var system = new pc.fw.ComponentSystem(context);
    
    registry.add("test", system);
    
    system.addComponent(entity, {"key":"value"});
    
    equal(context.systems.test.get(entity, "key"), "value");
    
});

test("get: Component accessor", function () {
    var entity = new pc.fw.Entity();
    var scene = new pc.scene.Scene();
    var registry = new pc.fw.ComponentSystemRegistry();
    var loaders = new pc.resources.LoaderManager();
    var context = new pc.fw.ApplicationContext(loaders, scene, registry);
    var system = new pc.fw.ComponentSystem(context);
    
    system._key = function (component, k) {
        return "value";
    }
    registry.add("test", system);
    
    system.addComponent(entity, {});
        
    equal(context.systems.test.get(entity, "key"), "value");    
});

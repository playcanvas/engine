module('pc.fw.ScriptComponent', {
    setup: function () {
        var scene = new pc.scene.Scene();
        var registry = new pc.fw.ComponentSystemRegistry();
        var loader = new pc.resources.ResourceLoader();
        context = new pc.fw.ApplicationContext(loader, scene, registry);
        _resources = pc.resources;
    },
    teardown: function () {
        pc.resources = _resources
        delete _resources;
        delete context;
    }
});

test("new", function () {
    jack(function () {
        pc.resources = jack.create("pc.resources", ["ResourceLoader"]);
        var sc = new pc.fw.ScriptComponentSystem(context);
        
        ok(sc);
        ok(context.systems.script);        
    });
});

test("createComponent: no data", function () {
    jack(function() {
        pc.resources = jack.create("pc.resources", ["ResourceLoader"]);
        
        var sc = new pc.fw.ScriptComponentSystem(context);
        var e = new pc.fw.Entity();
        
        var c = sc.createComponent(e);
        ok(c);
        equal(c.urls.length, 0);
        
    });
    
})

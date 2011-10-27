module('pc.fw.PickComponent', {
    setup: function () {
        pc.graph.JsonLoader = function () {};
        var scene = new pc.scene.Scene();
        var registry = new pc.fw.ComponentSystemRegistry();
        var loaders = new pc.resources.LoaderManager();
        context = new pc.fw.ApplicationContext(loaders, scene, registry);
    },
    teardown: function () {
        delete context;
        delete pc.graph.JsonLoader;
    }
});

test("new", function () {
    jack(function () {
        pc.graphics = {};
        pc.graphics.user = jack.create("pc.graphics.user", ["getRenderer"]);
        
        var hc = new pc.fw.PickComponentSystem(context);
        
        ok(hc);
        ok(context.systems.pick);        
    });
});


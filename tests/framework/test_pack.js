module('pc.fw.PackComponent', {
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
    var hc = new pc.fw.PackComponentSystem(context);
    
    ok(hc);
    ok(context.systems.pack);
});


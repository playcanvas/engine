module('pc.fw.HeaderComponent', {
    setup: function () {
        pc.graph.JsonLoader = function () {};
        var scene = new pc.scene.Scene();
        var registry = new pc.fw.ComponentSystemRegistry();
        var manager = new pc.scene.GraphManager();
        var loaders = new pc.resources.LoaderManager();
        context = new pc.fw.ApplicationContext(manager, loaders, scene, registry);
    },
    teardown: function () {
        delete context;
        delete pc.graph.JsonLoader;
    }
});

test("new", function () {
    var hc = new pc.fw.HeaderComponentSystem(context);
    
    ok(hc);
    ok(context.systems.header);
});


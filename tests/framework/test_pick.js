module('pc.fw.PickComponent', {
    setup: function () {
        var scene = new pc.scene.Scene();
        var registry = new pc.fw.ComponentSystemRegistry();
        var loader = new pc.resources.ResourceLoader();
        context = new pc.fw.ApplicationContext(loader, scene, registry);
    },

    teardown: function () {
        delete context;
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


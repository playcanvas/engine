module('pc.fw.RenderComponent', {
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
    var mc = new pc.fw.ModelComponentSystem(context);
    
    ok(mc);
    ok(context.systems.model);
});


test("deleteComponent: model and entity removed", function () {
    jack(function () {
        var mc = new pc.fw.ModelComponentSystem(context);
        var entity = new pc.fw.Entity();
        var model = jack.create("model", ["getGraph"]);
        var node = new pc.scene.GraphNode();
        jack.expect("model.getGraph")
            .exactly("2 time")
            .mock(function () {
                return node;
            });
        var compData = mc.createComponent(entity);
        
        mc.set(entity, "model", model);
        var data = mc._getComponentData(entity);
        
        equal(data.model, model);
    
        mc.deleteComponent(entity);
        
        equal(data.model, null);
        equal(entity.getChildren().length, 0);
        equal(!!node.getParent(), false);
        
    });
});

test("deleteComponent: no model", function () {
    jack(function () {
        var mc = new pc.fw.ModelComponentSystem(context);
        var entity = new pc.fw.Entity();

        var compData = mc.createComponent(entity);
        var data = mc._getComponentData(entity);
        equal(data.model, null);
    
        mc.deleteComponent(entity);
        
        equal(data.model, null);
        equal(entity.getChildren().length, 0);
        
    });
});
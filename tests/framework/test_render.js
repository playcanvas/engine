module('pc.fw.ModelComponent', {
    setup: function () {
        var scene = {};
        var registry = new pc.fw.ComponentSystemRegistry();
        var loader = new pc.resources.ResourceLoader();
        var device = {};
        context = new pc.fw.ApplicationContext(loader, scene, device, registry, {});
    },

    teardown: function () {
        delete context;
    }
});

test("new", function () {
    var mc = new pc.fw.ModelComponentSystem(context);
    
    ok(mc);
    ok(context.systems.model);
});


// test("deleteComponent: model and entity removed", function () {
//     jack(function () {
//         var mc = new pc.fw.ModelComponentSystem(context);
//         var entity = new pc.fw.Entity();
//         var model = jack.create("model", ["getGraph", "getMeshes", "getLights"]);
//         var node = new pc.scene.GraphNode();
//         jack.expect("model.getGraph")
//             .exactly("2 time")
//             .mock(function () {
//                 return node;
//             });
//         jack.expect("model.getMeshes")
//             .exactly("1 time")
//             .mock(function () {
//                 return [];
//             });
//         jack.expect("model.getLights")
//             .exactly("2 times")
//             .mock(function () {
//                 return [];
//             });
//         var compData = mc.addComponent(entity);
        
//         entity.model.model = model;
//         var data = entity.model.data;
        
//         //equal(data.model, model);
    
//         mc.removeComponent(entity);
        
//         equal(data.model, null);
//         equal(entity.getChildren().length, 0);
//         equal(!!node.getParent(), false);
        
//     });
// });

// test("deleteComponent: no model", function () {
//     jack(function () {
//         var mc = new pc.fw.ModelComponentSystem(context);
//         var entity = new pc.fw.Entity();

//         var compData = mc.addComponent(entity);
//         var data = entity.model.data;
//         equal(data.model, null);
    
//         mc.removeComponent(entity);
        
//         equal(data.model, null);
//         equal(entity.getChildren().length, 0);
        
//     });
// });
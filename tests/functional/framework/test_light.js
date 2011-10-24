module("pc.fw.LightComponent", {
    setup: function () {
        var canvas = document.getElementById("test-canvas");
        var graphicsDevice = new pc.gfx.Device(canvas);
        var programLib = new pc.gfx.ProgramLibrary();
        graphicsDevice.setCurrent();
        graphicsDevice.setProgramLibrary(programLib);
        
        var scene = new pc.graph.Scene();
        var registry = new pc.fw.ComponentRegistry();
        var manager = new pc.graph.GraphManager();
        var loaders = new pc.resources.LoaderManager();
        context = new pc.fw.ApplicationContext(manager, loaders, scene, registry);
    },
    teardown: function () {
        delete context;
    }
});

test("new", function () {
    var light = new pc.fw.LightComponent(context);
    
    ok(light);
    ok(light._ambient);
    ok(light._diffuse);
    ok(light._radius);
});

test("createComponent, light node created", function () {
    var lc = new pc.fw.LightComponent(context);
    var entity = new pc.fw.Entity();
    var data = lc.createComponent(entity);
    
    ok(data);
    ok(data.light);
    
})
test("delete, light node deleted", function () {
    var lc = new pc.fw.LightComponent(context);
    var entity = new pc.fw.Entity();
    var data = lc.createComponent(entity);

    lc.deleteComponent(entity);
    
    equal(!!data.light, false);    
        
});

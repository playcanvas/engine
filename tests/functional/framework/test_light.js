module("pc.fw.LightComponent", {
    setup: function () {
        var canvas = document.getElementById("test-canvas");
        var graphicsDevice = new pc.gfx.Device(canvas);
        pc.gfx.Device.setCurrent(graphicsDevice);
        
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
    var light = new pc.fw.DirectionalLightComponentSystem(context);
    
    ok(light);
});

test("createComponent, light node created", function () {
    var lc = new pc.fw.LightComponentSystem(context);
    var entity = new pc.fw.Entity();
    var data = lc.createComponent(entity);
    
    ok(data);
    ok(data.light);
    
})
test("delete, light node deleted", function () {
    var lc = new pc.fw.LightComponentSystem(context);
    var entity = new pc.fw.Entity();
    var data = lc.createComponent(entity);

    lc.deleteComponent(entity);
    
    equal(!!data.light, false);    
        
});

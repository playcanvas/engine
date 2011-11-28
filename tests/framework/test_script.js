module('pc.fw.ScriptComponent', {
    setup: function () {
        var scene = new pc.scene.Scene();
        var registry = new pc.fw.ComponentSystemRegistry();
        var loader = new pc.resources.ResourceLoader();
        context = new pc.fw.ApplicationContext(loader, scene, registry);
        loader.registerHandler(pc.resources.ScriptRequest, new pc.resources.ScriptResourceHandler(context, ""));
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

asyncTest("send() - send a message, check its return value", function () {
    var sc = new pc.fw.ScriptComponentSystem(context);

    var e = new pc.fw.Entity();
    var c = sc.createComponent(e);
    sc.set(e, "urls", "script.js");
    var count = 0;
    setTimeout(function () {
        var r = sc.send(e, "test_script", "sum", 1, 2);    
        equal(r, 3);
        start();    
    }, 1000);
});


asyncTest("message() - for compatibility message() still works", function () {
    var sc = new pc.fw.ScriptComponentSystem(context);

    var e = new pc.fw.Entity();
    var c = sc.createComponent(e);
    sc.set(e, "urls", "script.js");
    var count = 0;
    setTimeout(function () {
        var r = sc.send(e, "test_script", "sum", 1, 2);    
        equal(r, 3);
        start();    
    }, 1000);
});

asyncTest("broadcast() - send many messages, test they were received", function () {
    var sc = new pc.fw.ScriptComponentSystem(context);
    var entities = [];
    var comps = [];
    var i, length = 3;
    
    for(i = 0; i < length; ++i) {
        entities[i] = new pc.fw.Entity();
        comps[i] = sc.createComponent(entities[i]);
        sc.set(entities[i], "urls", "script.js");
    }

    var count = 0;
    setTimeout(function () {
        var r = sc.broadcast("test_script", "store", "value");    
        equal(r, undefined);
        
        for(i = 0; i < length; ++i) {
            equal(comps[i].instances['test_script'].instance.v, "value");
        }
        start();
    }, 1000);
});
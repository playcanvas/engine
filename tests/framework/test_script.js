var context;

module('pc.fw.ScriptComponent', {
    setup: function () {
        var scene = {};
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

        pc.fw.ComponentSystem.unbind('update');
        pc.fw.ComponentSystem.unbind('fixedUpdate');
        pc.fw.ComponentSystem.unbind('postUpdate');
        pc.fw.ComponentSystem.unbind('toolsUpdate');
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

test("addComponent: no data", function () {
    jack(function() {
        pc.resources = jack.create("pc.resources", ["ResourceLoader"]);
        
        var sc = new pc.fw.ScriptComponentSystem(context);
        var e = new pc.fw.Entity();
        
        var c = sc.addComponent(e);
        ok(c);
        equal(c.urls.length, 0);
        
    });    
});

asyncTest("send() - send a message, check its return value", function () {
    var sc = new pc.fw.ScriptComponentSystem(context);

    var e = new pc.fw.Entity();
    var c = sc.addComponent(e);
    e.script.urls = ['script.js'];
    var count = 0;
    setTimeout(function () {
        var r = e.script.send("test_script", "sum", 1, 2);    
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
        comps[i] = sc.addComponent(entities[i]);
        entities[i].script.urls = ['script.js'];
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


asyncTest("update event registered", function () {
    var e = new pc.fw.Entity();

    var sc = new pc.fw.ScriptComponentSystem(context);

    sc.addComponent(e, {
        urls: ['script.js']
    });

    setTimeout(function () {
        sc.onInitialize(e);
        equal(sc._callbacks['update'].length, 1);
        equal(sc._callbacks['postUpdate'].length, 1);
        equal(sc._callbacks['fixedUpdate'].length, 1);
        start();
    }, 1000);
});


asyncTest("update event unregistered on remove", function () {
    var e = new pc.fw.Entity();

    var sc = new pc.fw.ScriptComponentSystem(context);
    sc.addComponent(e, {
        urls: ['script.js']
    });

    setTimeout(function () {
        sc.onInitialize(e);

        sc.removeComponent(e);

        equal(sc._callbacks['update'].length, 0);
        equal(sc._callbacks['postUpdate'].length, 0);
        equal(sc._callbacks['fixedUpdate'].length, 0);
        
        start();
    }, 1000);
});

asyncTest("Correct event is unregistered with multiple instances.", function () {
    var sc = new pc.fw.ScriptComponentSystem(context);

    var e1 = new pc.fw.Entity();
    e1.setName('e1');
    sc.addComponent(e1, {
        urls: ['script.js']
    });
    context.root.addChild(e1);

    var e2 = new pc.fw.Entity();
    e2.setName('e2');
    sc.addComponent(e2, {
        urls: ['script.js']
    });
    context.root.addChild(e2);
    
    setTimeout(function () {
        sc.onInitialize(context.root);

        sc.removeComponent(e2);

        equal(sc._callbacks['update'][0].scope.entity.getGuid(), e1.getGuid());
        
        start();
    }, 1000);
});

asyncTest("update event called with correct this", 1, function () {
    var e = new pc.fw.Entity();

    var sc = new pc.fw.ScriptComponentSystem(context);

    sc.addComponent(e, {
        urls: ['script.js']
    });

    setTimeout(function () {
        sc.onInitialize(e);

        // Test in script.js
        pc.fw.ComponentSystem.update(0.1, context);
        
        start();
    }, 1000);
});

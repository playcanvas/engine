var context;

module('pc.fw.ScriptComponent', {
    setup: function () {
        var scene = {};
        var registry = new pc.fw.ComponentSystemRegistry();
        var loader = new pc.resources.ResourceLoader();
        var device = {};
        context = new pc.fw.ApplicationContext(loader, scene, device, registry, {});
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
        equal(c.scripts.length, 0);
        
    });    
});

asyncTest("send() - send a message, check its return value", function () {
    var sc = new pc.fw.ScriptComponentSystem(context);

    var e = new pc.fw.Entity();
    var c = sc.addComponent(e);
    e.script.scripts = [{ url: 'script.js'}];
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
        entities[i].script.scripts = [{url: 'script.js'}];
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

asyncTest("update event called with correct this", 1, function () {
    var e = new pc.fw.Entity();

    var sc = new pc.fw.ScriptComponentSystem(context);

    sc.addComponent(e, {
        scripts: [{
            url: 'script.js'
        }]
    });

    setTimeout(function () {
        sc.onInitialize(e);

        // Test in script.js
        pc.fw.ComponentSystem.update(0.1, context);
        
        start();
    }, 1000);
});

test("addComponent, removeComponent", function () {
    var e = new pc.fw.Entity();
    var sc = new pc.fw.ScriptComponentSystem(context);

    sc.addComponent(e, {
        scripts: [{
            url: 'script.js'
        }]
    });

    sc.removeComponent(e);

    setTimeout(function () {
        equal(e.script, undefined);
        equal(e.destroyed, undefined);
        start();
    }, 2000);

    stop();
});


test("addComponent, removeComponent, addComponent", function () {
    var e = new pc.fw.Entity();
    var sc = new pc.fw.ScriptComponentSystem(context);

    sc.addComponent(e, {
        scripts: [{
            url: 'script.js'
        }]
    });

    setTimeout(function () {

        sc.removeComponent(e);
        sc.addComponent(e, {
            scripts: [{
                url: 'script.js'
            }]
        });
        sc.removeComponent(e);
        sc.addComponent(e, {
            scripts: [{
                url: 'script.js'
            }]
        });

        setTimeout(function () {
            equal(e.count, 1);
            start();
        });
    }, 2000);

    stop();
});


/*
test("Scripts Initialize called in correct order", function () {
    window.script = {};
    window.script.order = [];
    window.script.a = false;
    window.script.b = false;

    var e1 = new pc.fw.Entity();
    var e2 = new pc.fw.Entity();

    // e1.setRequest({});
    // e2.setRequest({});

    var sc = new pc.fw.ScriptComponentSystem(context);

    sc.addComponent(e1, {
        scripts: [{
            url: 'scripts/a.js'
        }, {
            url: 'scripts/b.js'
        }]
    });

    sc.addComponent(e2, {
        scripts: [{
            url: 'scripts/b.js'
        }, {
            url: 'scripts/a.js'
        }]
    });

    setTimeout(function () {
        //sc.onInitialize(e1);

        equal(window.script.order[0], "a");
        equal(window.script.order[1], "a");
        equal(window.script.order[2], "b");
        equal(window.script.order[3], "b");
        delete window.script;
        start();
    }, 1000);
    
    stop();
});


test("Scripts Update in correct order", function () {
    window.script = {};
    window.script.order = [];
    window.script.a = false;
    window.script.b = false;

    var e1 = new pc.fw.Entity();
    var e2 = new pc.fw.Entity();

    var sc = new pc.fw.ScriptComponentSystem(context);

    sc.addComponent(e1, {
        scripts: [{
            url: 'scripts/a.js'
        }, {
            url: 'scripts/b.js'
        }]
    });

    sc.addComponent(e2, {
        scripts: [{
            url: 'scripts/b.js'
        }, {
            url: 'scripts/a.js'
        }]
    });

    setTimeout(function () {
        sc.onUpdate(1/60);    

        equal(window.script.order[0], "a");
        equal(window.script.order[1], "a");
        equal(window.script.order[2], "b");
        equal(window.script.order[3], "b");
        delete window.script;
        start();
    }, 1000);
    
    stop();
});
*/
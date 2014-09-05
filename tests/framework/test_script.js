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
    }, 500);
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
    }, 500);
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
    }, 500);
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
    }, 500);

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
    }, 500);

    stop();
});

test("initialize, postInitialize, onEnable called", function () {
    var e = new pc.fw.Entity();
    var sc = new pc.fw.ScriptComponentSystem(context);

    sc.addComponent(e, {
        scripts: [{
            url: 'scripts/events.js'
        }]
    });

    setTimeout(function () {
        equal(e.initEvents[0], 'initialize');
        equal(e.initEvents[1], 'onEnable');
        equal(e.initEvents[2], 'postInitialize');
        start();
    }, 500);

    stop();
});

test("onDisable, destroy called", function () {
    var e = new pc.fw.Entity();
    var sc = new pc.fw.ScriptComponentSystem(context);

    sc.addComponent(e, {
        scripts: [{
            url: 'scripts/events.js'
        }]
    });

    setTimeout(function () {
        sc.removeComponent(e);
        setTimeout(function () {
            equal(e.destroyEvents[0], 'onDisable');
            equal(e.destroyEvents[1], 'destroy');
            start();
        }, 500);
    }, 500);

    stop();
});

test("onDisable not called if already disabled", function () {
    var e = new pc.fw.Entity();
    var sc = new pc.fw.ScriptComponentSystem(context);

    sc.addComponent(e, {
        scripts: [{
            url: 'scripts/events.js'
        }]
    });

    setTimeout(function () {
        e.script.enabled = false;
        equal(e.destroyEvents[0], 'onDisable');
        sc.removeComponent(e);
        setTimeout(function () {
            equal(e.destroyEvents[0], 'onDisable');
            equal(e.destroyEvents[1], 'destroy');
            start();
        }, 500);
    }, 500);

    stop();
});

test("onAttributeChanged called", function () {
    var e = new pc.fw.Entity();
    var sc = new pc.fw.ScriptComponentSystem(context);

    sc.addComponent(e, {
        scripts: [{
            url: 'scripts/events.js',
            name: 'events',
            attributes: [{
                type: 'number',
                name: 'attr',
                value: 1
            }]
        }]
    })

    setTimeout(function () {
        notEqual(e.onAttributeChangedCalled, true);

        // set new attributes for the script which should call onAttributeChanged
        e.script.scripts = [{
            url: 'scripts/events.js',
            name: 'events',
            attributes: [{
                type: 'number',
                name: 'attr',
                value: 2
            }]
        }]
        equal(e.onAttributeChangedCalled, true);
        start();
    }, 500);

    stop();
});

test("script attribute types get converted", function () {
    var e = new pc.fw.Entity();
    var sc = new pc.fw.ScriptComponentSystem(context);

    sc.addComponent(e, {
        scripts: [{
            url: 'scripts/events.js',
            name: 'events',
            attributes: [{
                type: 'vector',
                name: 'vector',
                value: [3,3,3]
            }, {
                type: 'rgb',
                name: 'color3',
                value: [1,1,1]
            }, {
                type: 'rgba',
                name: 'color4',
                value: [1,1,1,0.5]
            }]
        }]
    });

    setTimeout(function () {
        QUnit.close(e.script.events.vector.x, 3, 0.01);
        QUnit.close(e.script.events.vector.y, 3, 0.01);
        QUnit.close(e.script.events.vector.z, 3, 0.01);

        QUnit.close(e.script.events.color3.r, 1, 0.01);
        QUnit.close(e.script.events.color3.g, 1, 0.01);
        QUnit.close(e.script.events.color3.b, 1, 0.01);

        QUnit.close(e.script.events.color4.r, 1, 0.01);
        QUnit.close(e.script.events.color4.g, 1, 0.01);
        QUnit.close(e.script.events.color4.b, 1, 0.01);
        QUnit.close(e.script.events.color4.a, 0.5, 0.01);

        start();
    }, 500);

    stop();
});

test("'set' event fired", function () {
    var e = new pc.fw.Entity();
    var sc = new pc.fw.ScriptComponentSystem(context);

    sc.addComponent(e, {
        scripts: [{
            url: 'scripts/events.js',
            name: 'events',
            attributes: [{
                type: 'number',
                name: 'attr',
                value: 1
            }]
        }]
    })

    setTimeout(function () {
        notEqual(e.setEventFired, true);
        e.script.events.attr = 2;
        equal(e.setEventFired, true);
        start();
    }, 500);

    stop();
});

test("set new scripts reinitializes instances", function () {
    var e = new pc.fw.Entity();
    var sc = new pc.fw.ScriptComponentSystem(context);

    sc.addComponent(e, {
        scripts: [{
            url: 'scripts/test_order_a.js'
        }, {
            url: 'scripts/test_order_b.js'
        }]
    });

    setTimeout(function () {
        pc.fw.ComponentSystem.update(0.1, context);
        pc.fw.ComponentSystem.postUpdate(0.1, context);

        // check that script methods were called
        // in the right order
        function test1 (array, length, startIndex) {
            equal(array.length, length);
            equal(array[startIndex], 'initialize');
            equal(array[startIndex + 1], 'onEnable');
            equal(array[startIndex + 2], 'postInitialize');
            equal(array[startIndex + 3], 'update');
            equal(array[startIndex + 4], 'postUpdate');
        }

        test1(e.methodsByA, 5, 0);
        test1(e.methodsByB, 5, 0);

        // change order
        e.script.scripts = [{
            url: 'scripts/test_order_b.js'
        }, {
            url: 'scripts/test_order_a.js'
        }];

        // check that onDisable and then destroy
        // was called on the existing script instances
        equal(e.methodsByA[5], 'onDisable');
        equal(e.methodsByA[6], 'destroy');
        equal(e.methodsByB[5], 'onDisable');
        equal(e.methodsByB[6], 'destroy');

        pc.fw.ComponentSystem.update(0.1, context);
        pc.fw.ComponentSystem.postUpdate(0.1, context);

        test1(e.methodsByB, 12, 7);
        test1(e.methodsByA, 12, 7);
        start();

    }, 500);

    stop();
});

test("Clone entity initializes scripts synchronously", function () {
    var e = new pc.fw.Entity();
    var sc = new pc.fw.ScriptComponentSystem(context);

    sc.addComponent(e, {
        scripts: [{
            url: 'scripts/events.js',
            name: 'events',
            attributes: [{
                type: 'number',
                name: 'attr',
                value: 1
            }]
        },
        // add a regular URL as well to make sure that this also works synchronously
        {
            url: 'http://localhost/engine/tests/framework/scripts/regular.js'
        }]
    })

    setTimeout(function () {
        equal(!!e.script.events, true)

        var clone = e.clone();
        equal(!!clone.script.events, true)

        start();
    }, 500);

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
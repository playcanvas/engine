module('pc.fw.AudioSourceComponent', {
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
    var asc = new pc.fw.AudioSourceComponentSystem(context);
    
    ok(asc);
    ok(context.systems.audiosource);
});

test("addComponent: no data", function () {
    var asc = new pc.fw.AudioSourceComponentSystem(context);
    var e = new pc.fw.Entity();
    
    var comp = asc.addComponent(e);
    
    ok(comp);
    equal(0, comp['assets'].length);
    equal(true, comp['activate']);
    equal(true, comp['positional']);
    equal(1, comp['volume']);
    equal(false, comp['loop'])
    equal(1, comp['rollOffFactor']);
    equal(1, comp['refDistance']);
    equal(10000, comp['maxDistance']);
});

test("addComponent: data", function () {
    var asc = new pc.fw.AudioSourceComponentSystem(context);
    var e = new pc.fw.Entity();
    var data = {
        volume: 0.5,
        loop: true,
        'positional': false,
        activate: false
    }    
    var comp = asc.addComponent(e, data);
    
    ok(comp);
    equal(null, comp['channel'])
    equal(data['activate'],  e.audiosource.activate);
    equal(data['positional'], e.audiosource['positional']);
    equal(data['volume'], e.audiosource.volume);
    equal(data['loop'], e.audiosource.loop);
});

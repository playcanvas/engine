module('pc.fw.AudioSourceComponent', {
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
    var asc = new pc.fw.AudioSourceComponentSystem(context);
    
    ok(asc);
    ok(context.systems.audiosource);
});

test("createComponent: no data", function () {
    var asc = new pc.fw.AudioSourceComponentSystem(context);
    var e = new pc.fw.Entity();
    
    var comp = asc.createComponent(e);
    
    ok(comp);
    equal(0, comp['assets'].length);
    equal(true, comp['activate']);
    equal(true, comp['3d']);
    equal(1, comp['volume']);
    equal(false, comp['loop'])
    equal(1, comp['rollOffFactor']);
    equal(1, comp['minDistance']);
    equal(10000, comp['maxDistance']);
});

test("createComponent: data", function () {
    var asc = new pc.fw.AudioSourceComponentSystem(context);
    var e = new pc.fw.Entity();
    var data = {
        volume: 0.5,
        loop: true,
        '3d': false,
        activate: false
    }    
    var comp = asc.createComponent(e, data);
    
    ok(comp);
    equal(null, comp['channel'])
    equal(data['activate'], asc.get(e, "activate"));
    equal(data['3d'], asc.get(e, "3d"));
    equal(data['volume'], asc.get(e, "volume"));
    equal(data['loop'], asc.get(e, "loop"));    
});

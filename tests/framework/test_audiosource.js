module('pc.fw.AudioSourceComponent', {
    setup: function () {
        pc.graph.JsonLoader = function () {};
        var scene = new pc.scene.Scene();
        var registry = new pc.fw.ComponentSystemRegistry();
        var manager = new pc.scene.GraphManager();
        var loaders = new pc.resources.LoaderManager();
        context = new pc.fw.ApplicationContext(manager, loaders, scene, registry);
    },
    teardown: function () {
        delete context;
        delete pc.graph.JsonLoader;
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
    ok(comp.audio);
    ok(comp.radius);
    equal("", comp.uri);
    equal(true, comp.activate);
    equal(false, comp.ambient);
});

test("createComponent: data", function () {
    var asc = new pc.fw.AudioSourceComponentSystem(context);
    var e = new pc.fw.Entity();
    var data = {
        radius: 10,
        uri: "abc",
        volume: 0.5,
        loop: true,
        ambient: true,
        activate: false
    }    
    var comp = asc.createComponent(e, data);
    
    ok(comp);
    ok(comp.audio);
    equal(data['radius'], asc.get(e, "radius"));
    equal(data['uri'], asc.get(e, "uri"));
    equal(data['activate'], asc.get(e, "activate"));
    equal(data['ambient'], asc.get(e, "ambient"));
    equal(data['volume'], asc.get(e, "volume"));
    equal(data['loop'], asc.get(e, "loop"));    
});

test("set 'uri', updates audio object", function () {
    var asc = new pc.fw.AudioSourceComponentSystem(context);
    var e = new pc.fw.Entity();
    var comp = asc.createComponent(e);
    
    var src = comp.audio.getSource();
    asc.set(e, "uri", "blah");
    var prefix = window.location.href.slice(0,-20);
    
    notEqual(prefix + src, comp.audio.getSource());
    equal(prefix + "blah", comp.audio.getSource());
});

test("set 'ambient', updates audio object", function () {
    var asc = new pc.fw.AudioSourceComponentSystem(context);
    var e = new pc.fw.Entity();
    var comp = asc.createComponent(e);
    
    asc.set(e, "ambient", true);
    ok(comp.audio instanceof pc.audio.AmbientAudio);
    asc.set(e, "ambient", false);
    ok(comp.audio instanceof pc.audio.PointAudio);
});

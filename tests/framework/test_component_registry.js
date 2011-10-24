module('pc.fw.ComponentSystemRegistry');

test("new", function () {
    var r = new pc.fw.ComponentSystemRegistry();
    
    ok(r);
});

test("add", function () {
    var r = new pc.fw.ComponentSystemRegistry();
    var comp = {};
    
    r.add("new_component", comp);
    
    ok(r.new_component);
});

test("add: duplicate", function () {
    var r = new pc.fw.ComponentSystemRegistry();
    var comp = {};
    
    r.add("new", comp);
    
    var fn = function () {
        r.add("new", comp);
    }
    
    raises(fn, "Component name 'new' already registered or not allowed");
});

test("add: not allowed", function () {
    var r = new pc.fw.ComponentSystemRegistry();
    var comp = {};
    
    var fn = function () {
        r.add("add", comp);        
    }
    
    raises(fn, "Component name 'add' already registered or not allowed");
});

test("remove: not present", function () {
    var r = new pc.fw.ComponentSystemRegistry();
    
    var fn = function () {
        r.remove("name");
    };
    
    raises(fn, "No Component named 'name' registered");
});

test("remove", function () {
    var r = new pc.fw.ComponentSystemRegistry();
    var comp = {};
    
    r.add("name", comp);
    
    r.remove("name");
    
    var undefined;
    
    equal(r.name, undefined);
});


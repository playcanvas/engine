module('pc.fw.Entity');

test("New", function () {
    var e = new pc.fw.Entity();
    ok(e);
});

test("setGuid/getGuid", function () {
    jack(function () {
        
        var gm = jack.create("gm", ["addNode", "removeNode"]);
        
        var e = new pc.fw.Entity();
        
        e.setGuid("123", gm);
        
        equal(e.getGuid(), "123");
        
    });
});

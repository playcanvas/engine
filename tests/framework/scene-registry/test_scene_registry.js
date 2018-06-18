module("pc.SceneRegistry");

test("new registry is empty", function () {
    var registry = new pc.SceneRegistry();

    equal(registry.list(), 0);
});

test("add", function () {
    var registry = new pc.SceneRegistry();

    registry.add("New Scene", "/test.json");

    strictEqual(registry.list().length, 1);
});

test("find", function () {
    var registry = new pc.SceneRegistry();
    registry.add("New Scene", "/test.json");

    var result = registry.find("New Scene");

    strictEqual(result.name, "New Scene");
    strictEqual(result.url, "/test.json");
});

test("remove", function () {
    var registry = new pc.SceneRegistry();
    registry.add("New Scene", "/test.json");

    registry.remove("New Scene");

    strictEqual(registry.list().length, 0);
    strictEqual(registry.find("New Scene"), null);
});

test("add multiple", function () {
    var registry = new pc.SceneRegistry();
    registry.add("New Scene 1", "/test1.json");
    registry.add("New Scene 2", "/test2.json");
    registry.add("New Scene 3", "/test3.json");

    strictEqual(registry.list().length, 3);
    strictEqual(registry.list()[0].url, '/test1.json');
    strictEqual(registry.list()[1].url, '/test2.json');
    strictEqual(registry.list()[2].url, '/test3.json');

    strictEqual(registry.find("New Scene 1").url, "/test1.json");
    strictEqual(registry.find("New Scene 2").url, "/test2.json");
    strictEqual(registry.find("New Scene 3").url, "/test3.json");
});

test("remove middle value", function () {
    var registry = new pc.SceneRegistry();
    registry.add("New Scene 1", "/test1.json");
    registry.add("New Scene 2", "/test2.json");
    registry.add("New Scene 3", "/test3.json");

    registry.remove("New Scene 2");

    strictEqual(registry.list().length, 2);
    strictEqual(registry.list()[0].url, '/test1.json');
    strictEqual(registry.list()[1].url, '/test3.json');

    strictEqual(registry.find("New Scene 1").url, "/test1.json");
    strictEqual(registry.find("New Scene 3").url, "/test3.json");
});

test("url index", function () {
    var registry = new pc.SceneRegistry();
    registry.add("New Scene 1", "/test1.json");

    var result = registry.findByUrl('/test1.json');
    strictEqual(result.name, "New Scene 1");
    strictEqual(result.url, "/test1.json");

});


test("remove middle, url index", function () {
    var registry = new pc.SceneRegistry();
    registry.add("New Scene 1", "/test1.json");
    registry.add("New Scene 2", "/test2.json");
    registry.add("New Scene 3", "/test3.json");

    registry.remove("New Scene 2");

    strictEqual(registry.findByUrl("/test1.json").name, "New Scene 1");
    strictEqual(registry.findByUrl("/test2.json"), null);
    strictEqual(registry.findByUrl("/test3.json").name, "New Scene 3");
});

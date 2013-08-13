module("pc.resources.JsonResourceHandler", {});


test("load", function () {
    var handler = new pc.resources.JsonResourceHandler();

    var request = new pc.resources.JsonRequest("file.json");

    handler.load(request).then(function (resources) {
        equal(resources['a'], 1);
        equal(resources['b'], 2);
        start();
    });

    stop();
})
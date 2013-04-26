module("pc.resources.ImageResourceHandler");

test("Load image", function () {
    var loader = new pc.resources.ResourceLoader();

    loader.registerHandler(pc.resources.ImageRequest, new pc.resources.ImageResourceHandler());

    var promise = loader.request(new pc.resources.ImageRequest("/engine/tests/functional/resources/resources/10x10.png"));
    promise.then(function (resources) {
        ok(resources[0] instanceof Image);
        start();
    });

    stop();
});
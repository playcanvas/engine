module("pc.resources.AnimationResourceHandler", {
    setup: function () {
    },

    teardown: function () {

    }
});


test("Load animation", 1, function () {
    var loader = new pc.resources.ResourceLoader();

    loader.registerHandler(pc.resources.AnimationRequest, new pc.resources.AnimationResourceHandler());

    var promise = loader.request(new pc.resources.AnimationRequest("/engine/tests/functional/resources/resources/door_open.json"));
    promise.then(function (resources) {
        ok(resources[0] instanceof pc.anim.Animation);
        start();
    });

    stop();
});
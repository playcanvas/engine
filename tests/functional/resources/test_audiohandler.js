module("pc.resources.AnimationResourceHandler", {
    setup: function () {
    },

    teardown: function () {

    }
});


test("Load audio", 1, function () {
    var loader = new pc.resources.ResourceLoader();
    var manager = new pc.audio.AudioManager();
    
    loader.registerHandler(pc.resources.AudioRequest, new pc.resources.AudioResourceHandler(manager));

    var promise = loader.request(new pc.resources.AudioRequest("/engine/tests/audio/ACDC_-_Back_In_Black-sample.ogg"));
    promise.then(function (resources) {
        ok(resources[0] instanceof pc.audio.Sound);
        start();
    });

    stop();
});
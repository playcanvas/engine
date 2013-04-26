module("pc.resources.ModelResourceHandler", {
	setup: function () {
		var canvas = document.createElement('canvas');

		// Create the graphics device
        var device = new pc.gfx.Device(canvas);

        // Activate the graphics device
        pc.gfx.Device.setCurrent(device);
	},

	teardown: function () {

	}
});


test("Load model", 1, function () {
    var loader = new pc.resources.ResourceLoader();

    loader.registerHandler(pc.resources.ModelRequest, new pc.resources.ModelResourceHandler());

    var promise = loader.request(new pc.resources.ModelRequest("/engine/tests/functional/resources/resources/cube.json"));
    promise.then(function (resources) {
        ok(resources[0] instanceof pc.scene.Model);
        start();
    }, function (error) {
        ok(false, error);
        start();
    });

    stop();
});

test("Load textured model", 1, function () {
    var loader = new pc.resources.ResourceLoader();

    loader.registerHandler(pc.resources.ModelRequest, new pc.resources.ModelResourceHandler());
    loader.registerHandler(pc.resources.ImageRequest, new pc.resources.ImageResourceHandler());

    var promise = loader.request(new pc.resources.ModelRequest("/engine/tests/functional/resources/resources/cube_textured.json"));
    promise.then(function (resources) {
        ok(resources[0] instanceof pc.scene.Model);
        start();
    }, function (error) {
        ok(false, error);
        start();
    });

    stop();
});
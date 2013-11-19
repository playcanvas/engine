module("pc.asset.AssetRegistry");

test("load json asset", function () {
    var loader = new pc.resources.ResourceLoader();
    loader.registerHandler(pc.resources.JsonRequest, new pc.resources.JsonResourceHandler());
    var registry = new pc.asset.AssetRegistry(loader);

    var asset = new pc.asset.Asset("asset", "json", {
        filename: "asset.json",
        url: "http://localhost/engine/tests/asset/assets/asset.json"
    });
    registry.load([asset]).then(function (resources) {
        var json = resources[0];

        equal(json.json, "data");
        start();
    });
    stop();
});

test("load texture asset", function () {
    var loader = new pc.resources.ResourceLoader();
    loader.registerHandler(pc.resources.ImageRequest, new pc.resources.ImageResourceHandler());
    var registry = new pc.asset.AssetRegistry(loader);

    var asset = new pc.asset.Asset("asset", "image", {
        filename: "test_image.png",
        url: "http://localhost/engine/tests/asset/assets/test_image.png"
    });

    registry.load([asset]).then(function (resources) {
        var image = resources[0];
        ok(image instanceof Image);
        start();
    });
    stop();
});
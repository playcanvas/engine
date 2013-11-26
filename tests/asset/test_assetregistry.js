module("pc.asset.AssetRegistry");

test("load json asset", function () {
    var loader = new pc.resources.ResourceLoader();
    loader.registerHandler(pc.resources.JsonRequest, new pc.resources.JsonResourceHandler());
    var registry = new pc.asset.AssetRegistry(loader);

    var asset = new pc.asset.Asset("asset", pc.asset.ASSET_JSON, {
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

    var asset = new pc.asset.Asset("asset", pc.asset.ASSET_IMAGE, {
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

test("find, filters on type", function () {
    var loader = new pc.resources.ResourceLoader();
    loader.registerHandler(pc.resources.ImageRequest, new pc.resources.ImageResourceHandler());
    var registry = new pc.asset.AssetRegistry(loader);

    registry.addAsset(new pc.asset.Asset("asset", pc.asset.ASSET_IMAGE, {
        filename: "test_image.png",
        url: "http://localhost/engine/tests/asset/assets/test_image.png"
    }));

    registry.addAsset(new pc.asset.Asset("asset", pc.asset.ASSET_IMAGE, {
        filename: "test_image2.png",
        url: "http://localhost/engine/tests/asset/assets/test_image2.png"
    }));

    var asset = registry.find("asset", pc.asset.ASSET_IMAGE);

    ok(asset instanceof pc.asset.Asset);
    equal(asset.type, pc.asset.ASSET_IMAGE);
    equal(asset.file.filename, "test_image.png");
});

test("findAll, filters on type", function () {
    var loader = new pc.resources.ResourceLoader();
    loader.registerHandler(pc.resources.ImageRequest, new pc.resources.ImageResourceHandler());
    var registry = new pc.asset.AssetRegistry(loader);

    registry.addAsset(new pc.asset.Asset("asset", pc.asset.ASSET_IMAGE, {
        filename: "test_image.png",
        url: "http://localhost/engine/tests/asset/assets/test_image.png"
    }));

    registry.addAsset(new pc.asset.Asset("asset", pc.asset.ASSET_TEXT, {
        filename: "test_image.txt",
        url: "http://localhost/engine/tests/asset/assets/text.txt"
    }));

    var assets = registry.findAll("asset", pc.asset.ASSET_IMAGE);

    equal(assets.length, 1);
    equal(assets[0].type, pc.asset.ASSET_IMAGE);
});

test("find, name not found", function () {
    var loader = new pc.resources.ResourceLoader();
    loader.registerHandler(pc.resources.ImageRequest, new pc.resources.ImageResourceHandler());
    var registry = new pc.asset.AssetRegistry(loader);

    var asset = registry.find("asset", pc.asset.ASSET_IMAGE);
    equal(asset, null)
});

test("find, type not found", function () {
    var loader = new pc.resources.ResourceLoader();
    loader.registerHandler(pc.resources.ImageRequest, new pc.resources.ImageResourceHandler());
    var registry = new pc.asset.AssetRegistry(loader);

    var asset = registry.find("asset", "abc");
    equal(asset, null)
});

test("findAll, name not found", function () {
    var loader = new pc.resources.ResourceLoader();
    loader.registerHandler(pc.resources.ImageRequest, new pc.resources.ImageResourceHandler());
    var registry = new pc.asset.AssetRegistry(loader);

    var assets = registry.findAll("asset", pc.asset.ASSET_IMAGE);
    equal(assets.length, 0);
});

test("findAll, type not found", function () {
    var loader = new pc.resources.ResourceLoader();
    loader.registerHandler(pc.resources.ImageRequest, new pc.resources.ImageResourceHandler());
    var registry = new pc.asset.AssetRegistry(loader);

    var assets = registry.findAll("asset", "abc");
    equal(assets.length, 0);
});

test("find, no type", function () {
    var loader = new pc.resources.ResourceLoader();
    loader.registerHandler(pc.resources.ImageRequest, new pc.resources.ImageResourceHandler());
    var registry = new pc.asset.AssetRegistry(loader);

    registry.addAsset(new pc.asset.Asset("asset", pc.asset.ASSET_IMAGE, {
        filename: "test_image.png",
        url: "http://localhost/engine/tests/asset/assets/test_image.png"
    }));

    registry.addAsset(new pc.asset.Asset("asset", pc.asset.ASSET_IMAGE, {
        filename: "test_image2.png",
        url: "http://localhost/engine/tests/asset/assets/test_image2.png"
    }));

    var asset = registry.find("asset");

    ok(asset instanceof pc.asset.Asset);
    equal(asset.type, pc.asset.ASSET_IMAGE);
    equal(asset.file.filename, "test_image.png");
});

test("findAll, no type", function () {
    var loader = new pc.resources.ResourceLoader();
    loader.registerHandler(pc.resources.ImageRequest, new pc.resources.ImageResourceHandler());
    var registry = new pc.asset.AssetRegistry(loader);

    registry.addAsset(new pc.asset.Asset("asset", pc.asset.ASSET_IMAGE, {
        filename: "test_image.png",
        url: "http://localhost/engine/tests/asset/assets/test_image.png"
    }));

    registry.addAsset(new pc.asset.Asset("asset", pc.asset.ASSET_TEXT, {
        filename: "test_image.txt",
        url: "http://localhost/engine/tests/asset/assets/text.txt"
    }));

    var assets = registry.findAll("asset");

    equal(assets.length, 2);
    equal(assets[0].type, pc.asset.ASSET_IMAGE);
    equal(assets[1].type, pc.asset.ASSET_TEXT);
});
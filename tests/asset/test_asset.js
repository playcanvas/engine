module("pc.asset.Asset", {
    setup: function () {
        guidCreate = pc.guid.create
        pc.guid.create = function () {
            return "1234";
        }
    },
    teardown: function () {
        pc.guid.create = guidCreate;
    }
});
var guidCreate;

test("new pc.asset.Asset, shortform", function () {
    var asset = new pc.asset.Asset("asset_name", "text", {
        filename: "filename.txt",
        url: "example/path/filename.txt"
    });

    equal(asset.name, "asset_name");
    equal(asset.file.filename, "filename.txt");
    equal(asset.file.url, "example/path/filename.txt");
    deepEqual(asset.data, {});
    equal(asset.prefix, "");
    equal(asset.getFileUrl(), "example/path/filename.txt");
});

test("new pc.asset.Asset, name, file", function () {
    var asset = new pc.asset.Asset("asset_name", "text", {
        filename: "filename.txt",
        url: "example/path/filename.txt"
    });

    equal(asset.name, "asset_name");
    equal(asset.file.filename, "filename.txt");
    equal(asset.file.url, "example/path/filename.txt");
    deepEqual(asset.data, {});
    equal(asset.prefix, "");
    equal(asset.getFileUrl(), "example/path/filename.txt");

});

test("new pc.asset.Asset, name, data", function () {
    var o = {
        json: "data"
    };

    var asset = new pc.asset.Asset("asset_name", "text", null, o);

    equal(asset.name, "asset_name");

    deepEqual(asset.data, o);

    equal(asset.file, null);
    equal(asset.getFileUrl(), null);
    equal(asset.prefix, "");
});


test("asset.data", function () {
    var prefix = "/dir";
    var data = {}

    var asset = new pc.fw.Asset("abc", data, prefix);
    equal(asset.key, data['key']);
    equal(asset.key2, data['key2']);
});

test("asset.getFileUrl", function () {
    var prefix = "/dir";
    var data = {
        "file": {
            "url": "path/to/file.txt"
        }
    };

    var asset = new pc.fw.Asset("abc", data, prefix);
    equal(asset.getFileUrl(), "/dir/path/to/file.txt");
});

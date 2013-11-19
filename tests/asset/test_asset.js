module("pc.asset.Asset", {
    setUp: function () {
        guidCreate = pc.guid.create
        pc.guid.create = function () {
            return "1234";
        }
    },
    tearDown: function () {
        pc.guid.create = guidCreate;
    }
});
var guidCreate;

test("new pc.asset.Asset, shortform", function () {
    var _guid = pc.guid.create;
    pc.guid.create = function () {return "1234"};
    var asset = new pc.asset.Asset("asset_name", "text", {
        filename: "filename.txt",
        size: 1234,
        hash: "abcd",
        url: "example/path/filename.txt"
    });

    equal(asset.resourceId, "1234");
    equal(asset.name, "asset_name");
    equal(asset.file.filename, "filename.txt");
    equal(asset.file.url, "example/path/filename.txt");
    deepEqual(asset.data, {});
    equal(asset.prefix, "");
    equal(asset.getFileUrl(), "example/path/filename.txt");
});

test("new pc.asset.Asset, name, file", function () {
    var asset = new pc.asset.Asset("1234", "asset_name", "text", {
        filename: "filename.txt",
        size: 1234,
        hash: "abcd",
        url: "example/path/filename.txt"
    });

    equal(asset.resourceId, "1234");
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

    var asset = new pc.asset.Asset("1234", "asset_name", "text", null, o);
    
    equal(asset.resourceId, "1234");
    equal(asset.name, "asset_name");
    
    deepEqual(asset.data, o);

    equal(asset.file, null);
    equal(asset.getFileUrl(), null);
    equal(asset.prefix, "");
});
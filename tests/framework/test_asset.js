module("pc.fw.Asset");

test("asset new", function () {
    var prefix = "/dir";
    var data = {
        "_id": "abc",
        "key": "value",
        "key2": "value2"
    }

    
    var asset = new pc.fw.Asset(prefix, data);
    
    ok(asset instanceof pc.fw.Asset)    
    equal(asset.prefix, prefix);
});

test("asset.getGuid", function () {
    var prefix = "/dir";
    var data = {
        "_id": "abc"
    }
    
    var asset = new pc.fw.Asset(prefix, data);
    
    equal(asset.getGuid(), "abc");
    equal(asset._id, undefined);
    equal(data['_id'], "abc"); // confirm _id not deleted from source data
});

test("asset.setGuid", function () {
    var prefix = "/dir";
    var data = {
        "_id": "abc"
    }
    
    var asset = new pc.fw.Asset(prefix, data);
    asset.setGuid("def")
    equal(asset.getGuid(), "def");
});

test("asset.data", function () {
    var prefix = "/dir";
    var data = {
        "_id": "abc"
    }
    
    var asset = new pc.fw.Asset(prefix, data);
    equal(asset.key, data['key']);
    equal(asset.key2, data['key2']);
});

test("asset.getFileUrl", function () {
    var prefix = "/dir";
    var data = {
        "_id": "abc",
        "file": {
            "url": "path/to/file.txt"
        }
    };
    
    var asset = new pc.fw.Asset(prefix, data);
    equal(asset.getFileUrl(), "/dir/path/to/file.txt"); 
});

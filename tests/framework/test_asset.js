module("pc.fw.Asset");

test("asset new", function () {
    var data = {
        "_id": "abc",
        "key": "value",
        "key2": "value2"
    }
    
    var asset = new pc.fw.Asset(data);
    
    ok(asset instanceof pc.fw.Asset)    
});

test("asset.getGuid", function () {
    var data = {
        "_id": "abc"
    }
    
    var asset = new pc.fw.Asset(data);
    
    equal(asset.getGuid(), "abc");
    equal(asset._id, undefined);
    equal(data['_id'], "abc"); // confirm _id not deleted from source data
});

test("asset.setGuid", function () {
    var data = {
        "_id": "abc"
    }
    
    var asset = new pc.fw.Asset(data);
    asset.setGuid("def")
    equal(asset.getGuid(), "def");
});

test("asset.data", function () {
    var data = {
        "_id": "abc"
    }
    
    var asset = new pc.fw.Asset(data);
    equal(asset.key, data['key']);
    equal(asset.key2, data['key2']);
});

test("asset.getFileUrl, api", function () {
    var data = {
        "_id": "abc",
        "file": {
            "url": "path/to/file.txt"
        }
    };
    
    var asset = new pc.fw.Asset(data);
    equal(asset.getFileUrl(), pc.path.join("/api", data.file.url)); 
});

test("asset.getFileUrl, exported", function () {
    var data = {
        "_id": "abc",
        "file": {
            "exported": true,
            "url": "path/to/file.txt"
        }
    };
    
    var asset = new pc.fw.Asset(data);
    equal(asset.getFileUrl(), data.file.url); 
});


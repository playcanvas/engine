module("pc.fw.Asset");

test("asset new", function () {
    var prefix = "/dir";
    var data = {
        "key": "value",
        "key2": "value2"
    }

    
    var asset = new pc.fw.Asset("abc", data, prefix);
    
    ok(asset instanceof pc.fw.Asset)    
    equal(asset.prefix, prefix);
});

test("asset.resourceId", function () {
    var prefix = "/dir";
    var data = {}
    
    var asset = new pc.fw.Asset("abc", data, prefix);
    
    equal(asset.resourceId, "abc");
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

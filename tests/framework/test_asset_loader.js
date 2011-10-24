module("pc.fw.AssetLoader")


test("load", 2, function () {
    jack(function () {
        
        pc.content = jack.create("pc.content", ["data"]);
        pc.content.data = [];
        api = jack.create("api", ["asset"]);
        api.asset = jack.create("api.asset", ["getOne"]);
        
        jack.expect("api.asset.getOne")
            .exactly("1 time")
            .whereArgument(0).is("abc")
            .whereArgument(1).isType("function")
            .mock(function (guid, success) {
                success({_id: "abc"});
            });

        var a = new pc.fw.AssetLoader(api)
        
        a.load("abc", function (asset) {
            ok(asset instanceof pc.fw.Asset);
            equal(asset.getGuid(), "abc");
        });
           
    });
})



test("load in cache", 3, function () {
    jack(function () {
        
        pc.content = jack.create("pc.content", ["data"]);
        pc.content.data = [];
        api = jack.create("api", ["asset"]);
        api.asset = jack.create("api.asset", ["getOne"]);
        
        jack.expect("api.asset.getOne")
            .exactly("1 time")
            .whereArgument(0).is("abc")
            .whereArgument(1).isType("function")
            .mock(function (guid, success) {
                success({_id: "abc"});
            });

        var a = new pc.fw.AssetLoader(api)
        
        a.load("abc", function (asset) {
            equal(asset.getGuid(), "abc");
            a.load("abc", function (asset) {
                ok(asset instanceof pc.fw.Asset);
                equal(asset.getGuid(), "abc");
            });
        });
           
    });
});

test("load from pc.content.data", 1, function () {
    jack(function () {
        pc.content = {};
        pc.content.data = {
            "abc": {
                "_id": "abc",
            }
        };
        
        var api = jack.create("api", []);
        var a = new pc.fw.AssetLoader(api);
        
        a.load("abc", function (asset) {
            equal(asset.getGuid(), "abc");
        });
    });
});


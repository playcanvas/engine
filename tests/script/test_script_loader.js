module("pc.script.ScriptLoader", {
    setup: function () {
    },
    
    teardown: function () {
        var head = document.getElementsByTagName("head")[0];
        var script = head.getElementsByTagName("script")[0];
        if(script) {
            head.removeChild(script);
        }
        
        pc.script.setLoader(null);
    }
    
});

test("create", function () {
    var sl = new pc.script.ScriptLoader("test/prefix");
    
    ok(sl);
    ok(sl.add);
    ok(sl.load);
});

asyncTest("load valid", 1, function () {
    var sl = new pc.script.ScriptLoader("");
    pc.script.setLoader(sl);
    
    var url = "sample.js";
    var context = {};
   
    sl.load(url, context, function (name, Type) {
        ok(true);
        start();
    });
});

asyncTest("load with timeout, valid", 1, function () {
    var sl = new pc.script.ScriptLoader("");
    pc.script.setLoader(sl);
    
    var url = "sample.js";
    var context = {};
   
    sl.load(url, context, function (name, Type) {
        ok(true);
        start();
    }, {
        timeout: 1000,
        error: function () {
            ok(false);
        }
    });
});

asyncTest("load with prefix, valid", 1, function () {
    var sl = new pc.script.ScriptLoader("sample_folder");
    pc.script.setLoader(sl);
    
    var url = "sample.js";
    var context = {};
   
    sl.load(url, context, function (name, Type) {
        ok(true);
        start();
    });    
});

asyncTest("load with timeout, fail", function () {
    var sl = new pc.script.ScriptLoader("sample_folder");
    pc.script.setLoader(sl);
    
    var url = "missing.js";
    var context = {};
   
    sl.load(url, context, function (name, Type) {
        ok(false);
    }, {
        timeout: 500,
        error: function () {
            ok(true);
            start();
        }
    });    
    
})

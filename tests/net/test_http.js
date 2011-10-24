module('pc.net.http');

test("Methods exist", function() {
	ok(pc.net.http.get);
    ok(pc.net.http.post);
    ok(pc.net.http.put);
    ok(pc.net.http.request);	
});

test("ContentType enum is correct", function() {
    same(pc.net.http.ContentType.FORM_URLENCODED, "application/x-www-form-urlencoded");
    same(pc.net.http.ContentType.GIF, "image/gif");
    same(pc.net.http.ContentType.JPEG, "image/jpeg");
    same(pc.net.http.ContentType.JSON, "application/json");
    same(pc.net.http.ContentType.PNG, "image/png");
    same(pc.net.http.ContentType.TEXT, "text/plain");
    same(pc.net.http.ContentType.XML, "application/xml");
});

test("request: xhr called with correct args", function() {
    jack(function() {
        var xhr  = jack.create("xhr", ["open", "send", "getResponseHeader"]);
        jack.expect("xhr.open").withArguments("GET", "http://test.com", true);
        jack.expect("xhr.send").withArguments(null);
        var r = pc.net.http.request("GET", "http://test.com", {}, xhr);
        
        ok(r == xhr);
    });
});

test("request: xhr calls callback", function() {
    var callbackFired = false;
    
    var xhr = {
        open: function(method, url, async) {},
        send: function() {
            xhr.readyState = 4;
            xhr.responseText = "callback test";
            xhr.status = 200;
            xhr.onreadystatechange();
        },
        getResponseHeader : function () {}
    };
    
    var callback = function(response, status, xhr2) {
        same(response, "callback test");
        same(status, 200);
        equal(xhr2, xhr);
        callbackFired = true;
    };
    
    var r = pc.net.http.request("GET", "http://test.com", { success : callback}, xhr);
    
    ok(r === xhr);
    same(callbackFired, true);
});

test("request: xhr calls success callback with correct status", function() {
    var callbackCount = 0;
    var expectedStatus;

    var xhr = {
        open: function(method, url, async) {},
        send: function() {
            xhr.readyState = 4;
            xhr.onreadystatechange();
        },
        getResponseHeader : function () {}
    };
        
    var callback = function(response, status, xhr) {
        same(status, expectedStatus);
        callbackCount++;
    };
    
    expectedStatus = 200;
    xhr.status = 200;
    pc.net.http.request("GET", "http://test.com", { success : callback }, xhr);

    expectedStatus = 201;
    xhr.status = 201;
    pc.net.http.request("GET", "http://test.com", { success : callback }, xhr);
    
    expectedStatus = 206;
    xhr.status = 206;
    pc.net.http.request("GET", "http://test.com", { success : callback }, xhr);
    
    expectedStatus = 304;
    xhr.status = 304;
    var r = pc.net.http.request("GET", "http://test.com", { success : callback }, xhr);
    
    ok(r === xhr);
    same(callbackCount, 4);
});

test("request: xhr calls error callback with correct status", function() {
    var callbackCount = 0;
    var expectedStatus;

    var xhr = {
        open: function(method, url, async) {},
        send: function() {
            xhr.readyState = 4;
            xhr.onreadystatechange();
        },
        getResponseHeader : function () {}
    };
        
    var callback = function(status, xhr, e) {
        same(status, expectedStatus);
        callbackCount++;
    };
    
    expectedStatus = 404;
    xhr.status = 404;
    pc.net.http.request("GET", "http://test.com", { error : callback }, xhr);
    
    expectedStatus = 500;
    xhr.status = 500;
    pc.net.http.request("GET", "http://test.com", { error : callback }, xhr);
    
    expectedStatus = 403;
    xhr.status = 403;
    var r = pc.net.http.request("GET", "http://test.com", { error : callback }, xhr);
    
    ok(r === xhr);
    same(callbackCount, 3);
});
    
test("get: xhr called with correct args", function () {
	jack(function() {
        var xhr  = jack.create("xhr", ["open", "send"]);
        jack.expect("xhr.open").withArguments("GET", "http://test.com", true);
        jack.expect("xhr.send").withArguments(null);
        var r = pc.net.http.get("http://test.com", {}, null, xhr);
        
        ok(r === xhr);
    });
});

test("get: backwards compatibility with old (responseTest) callbacks", function () {
    var callbackFired = false;
    
    var xhr = {
        open: function(method, url, async) {},
        send: function() {
            xhr.readyState = 4;
            xhr.responseText = "callback test";
            xhr.status = 200;
            xhr.onreadystatechange();
        },
        getResponseHeader : function () {}
    };
    
    var callback = function(response) {
        same(response, "callback test");
        callbackFired = true;
    };
    
    var r = pc.net.http.get("http://test.com", callback, null, xhr);
    
    ok(r === xhr);
    same(callbackFired, true);
});

test("post: xhr called with corrent args", function () {
	jack(function() {
        var xhr  = jack.create("xhr", ["open", "send"]);
        jack.expect("xhr.open").withArguments("POST", "http://test.com", true);
        jack.expect("xhr.send").withArguments("qazxsw");
        var r = pc.net.http.post("http://test.com", null, "qazxsw", null, xhr);
        
        ok(r === xhr);
    });
});

test("put: xhr called with corrent string data", function () {
	jack(function() {
        var xhr  = jack.create("xhr", ["open", "send"]);
        jack.expect("xhr.open").withArguments("PUT", "http://test.com", true);
        jack.expect("xhr.send").withArguments("qwerty");
        var r = pc.net.http.put("http://test.com", null, "qwerty", null, xhr);
        
        ok(r === xhr);
    });
});

test("delete_: xhr called with corrext string data", function () {
    jack(function() {
        var xhr = jack.create("xhr", ["open", "send"]);
        jack.expect("xhr.open").withArguments("DELETE", "http://test.com", true);
        jack.expect("xhr.send");
        var r = pc.net.http.delete_("http://test.com", null, null, xhr);
    });    
});

test("request: cache=false adds timestamp to plain url", function () {
    jack(function() {
        var xhr  = jack.create("xhr", ["open", "send"]);
        pc.time = jack.create("core.time", ["now"]);
		jack.expect("core.time.now").returnValue(12345678);
        jack.expect("xhr.open").withArguments("GET", "http://test.com?ts=12345678", true);
        jack.expect("xhr.send").withArguments(null);
        var r = pc.net.http.request("GET", "http://test.com", {cache:false}, xhr);
        
        ok(r === xhr);
    });
});

test("request: cache=false adds timestamp to url with existing query", function () {
    jack(function() {
        var xhr  = jack.create("xhr", ["open", "send"]);
        pc.time = jack.create("core.time", ["now"]);
        jack.expect("core.time.now").returnValue(12345678);
        jack.expect("xhr.open").withArguments("GET", "http://test.com?query=value&ts=12345678", true);
        jack.expect("xhr.send").withArguments(null);
        var r = pc.net.http.request("GET", "http://test.com?query=value", {cache:false}, xhr);
        
        ok(r === xhr);
    });
});

test("request: options.async=true creates a non-blocking request", function () {
    jack(function() {
        var xhr  = jack.create("xhr", ["open", "send"]);
        jack.expect("xhr.open").withArguments("GET", "http://test.com", true);
        jack.expect("xhr.send").withArguments(null);
        var r = pc.net.http.request("GET", "http://test.com", { async : true }, xhr);
        
        ok(r === xhr);
    });
});

test("request: options.async=false creates a blocking request", function () {
    jack(function() {
        var xhr  = jack.create("xhr", ["open", "send"]);
        jack.expect("xhr.open").withArguments("GET", "http://test.com", false);
        jack.expect("xhr.send").withArguments(null);
        var r = pc.net.http.request("GET", "http://test.com", { async : false }, xhr);
        
        ok(r === xhr);
    });
});

test("request: send exception triggers error callback with mock object", function() {
    var callbackFired = false;
    
    var xhr = {
        open: function(method, url, async) {},
        send: function() {
            xhr.readyState = 4;
            xhr.status = 0;
            xhr.onreadystatechange();
            throw "Test exception";
        },
        getResponseHeader : function () {}
    };
    
    var callback = function(status, _xhr, exception) {
            equal(_xhr.status, -1);
            notEqual(_xhr, null);
            same(exception, "Test exception");
            callbackFired = true;
        
    };
    
    var r = pc.net.http.request("GET", "http://test.com", { error : callback}, xhr);
    
    ok(r === xhr);
    same(callbackFired, true);
});

test("request: send exception triggers error callback with real XMLHttpRequest", function() {
    var callbackFired = false;
    
    var callback = function(status, xhr, exception) {
        same(status, -1);
        same(xhr == null, false);
        same(exception == null, false);
        callbackFired = true;
    };
    
    var r = pc.net.http.request("GET", "http://127.0.0.1:1/", { error : callback, async : false });
    
    ok(r instanceof XMLHttpRequest);
    same(true, callbackFired);
});

test("request: set post data direct, no headers", function() {
   	jack(function() {
        var xhr  = jack.create("xhr", ["open", "send"]);
        jack.expect("xhr.open").withArguments("GET", "http://test.com", true);
        jack.expect("xhr.send").withArguments("abcdef");
        var r = pc.net.http.request("GET", "http://test.com", { postdata : "abcdef" }, xhr);
        
        ok(r === xhr);
    });
});

test("request: set headers", function() {
   	jack(function() {
        var xhr  = jack.create("xhr", ["open", "send", "setRequestHeader"]);
        jack.expect("xhr.open").withArguments("GET", "http://test.com", true);
        jack.expect("xhr.setRequestHeader").withArguments("key1", "value1");
        jack.expect("xhr.setRequestHeader").withArguments("key2", "value2");
        jack.expect("xhr.send").withArguments(null);
        var r = pc.net.http.request("GET", "http://test.com", { headers : { key1 : "value1", key2 : "value2" } }, xhr);
        
        ok(r === xhr);
    });
});

test("request: set post data, header x-www-form-urlencoded", function() {
   	jack(function() {
        var xhr  = jack.create("xhr", ["open", "send", "setRequestHeader"]);
        jack.expect("xhr.open").withArguments("GET", "http://test.com", true);
        jack.expect("xhr.setRequestHeader").withArguments("Content-Type", "application/x-www-form-urlencoded");
        jack.expect("xhr.send").withArguments("key%261=value%261&key%262=value%262");
        var r = pc.net.http.request("GET", "http://test.com", {
            postdata : {
                "key&1" : "value&1",
                "key&2" : "value&2" },
            headers : {
                 "Content-Type" : "application/x-www-form-urlencoded" } }, xhr);
                 
        ok(r === xhr);
    });
});

test("request: set post data, check that default content-type is x-www-form-urlencoded", function() {
    jack(function () {
        var xhr  = jack.create("xhr", ["open", "send", "setRequestHeader"]);
        jack.expect("xhr.open").withArguments("GET", "http://test.com", true);
        jack.expect("xhr.setRequestHeader").withArguments("Content-Type", "application/x-www-form-urlencoded");
        jack.expect("xhr.send").withArguments("key1=value1&key2=value2");
        var r = pc.net.http.request("GET", "http://test.com", {
            postdata : {
                key1 : "value1",
                key2 : "value2" 
                } 
            }, xhr);
    
        ok(r === xhr);
    });
    
});

test("request: set post data with XML no content type", function() {
    var xml = document.implementation.createDocument("", "xml", null);
    
    var headerSet, dataSet;
    
    var xhr = {
        open: function(method, url, async) {},
        send: function(postdata) {
            equal(postdata, xml);
            dataSet = true;
        }
    };
    
    var r = pc.net.http.request("GET", "http://test.com", { postdata : xml }, xhr);
    
    ok(r === xhr);
    same(dataSet, true);
});

test("request: post data, unknown content-type reverts to JSON", function() {
    var headerSet, dataSet;
    
    var xhr = {
        open: function(method, url, async) {},
        setRequestHeader: function(key, value) {
            same(key, "Content-Type");
            same(value, "test/contentType");
            headerSet = true;
        },
        send: function(postdata) {
            obj = JSON.parse(postdata);
            same(obj["key1"], "value 1");
            same(obj["key2"], "value 2");
            xhr.readyState = 4;
            xhr.status = 200;
            xhr.onreadystatechange();
            dataSet = true;
        },
        getResponseHeader : function () {}
    };
    
    var r = pc.net.http.request("GET", "http://test.com", {
        postdata : {
            key1 : "value 1",
            key2 : "value 2" },
        headers : {
            "Content-Type" : "test/contentType" } }, xhr);
    
    ok(r === xhr);
    same(headerSet, true);
    same(dataSet, true);
});

test("request: check that JSON data is parsed correctly", function() {
    var headerSet, dataSet, callbackCalled;
    
    var xhr = {
        open: function(method, url, async) {},
        send: function(postdata) {
            xhr.readyState = 4;
            xhr.status = 200;
            xhr.responseText ='{"_id":"12345","data":"Testing"}'; 
            xhr.onreadystatechange();
            dataSet = true;
        },
        getResponseHeader : function (header) {
            if (header == "Content-Type") {
                return "application/json";
            }
            return null;
        }
    };
    
    var callback = function (response, status, xhr2) {
        same(status, 200);
        ok(xhr2 == xhr);
        same(response instanceof Object, true);
        same(response._id, "12345");
        same(response.data, "Testing");
        callbackCalled = true;
    }
    
    var r = pc.net.http.request("GET", "http://test.com", { success : callback }, xhr);
    
    ok(r === xhr);
    same(dataSet, true);
    same(callbackCalled, true);
});


test("request: check that requesting a file ending .json will parse as json", function () {
   var headerSet, dataSet, callbackCalled;
    
    var xhr = {
        open: function(method, url, async) {},
        send: function(postdata) {
            xhr.readyState = 4;
            xhr.status = 200;
            xhr.responseText ='{"_id":"12345","data":"Testing"}'; 
            xhr.onreadystatechange();
            dataSet = true;
        },
        getResponseHeader : function (header) {
            return null;
        }
    };
    
    var callback = function (response, status, xhr2) {
        same(status, 200);
        ok(xhr2 == xhr);
        same(response instanceof Object, true);
        same(response._id, "12345");
        same(response.data, "Testing");
        callbackCalled = true;
    }
    
    var r = pc.net.http.request("GET", "http://test.com/file.json", { success : callback }, xhr);
    
    ok(r === xhr);
    same(dataSet, true);
    same(callbackCalled, true);    
});

test("request: check that Content-Type header with parameter is parsed correctly", function() {
    var headerSet, dataSet, callbackCalled;
    
    var xhr = {
        open: function(method, url, async) {},
        send: function(postdata) {
            xhr.readyState = 4;
            xhr.status = 200;
            xhr.responseText ='{"_id":"12345","data":"Testing"}'; 
            xhr.onreadystatechange();
            dataSet = true;
        },
        getResponseHeader : function (header) {
            if (header == "Content-Type") {
                return "application/json; charset=utf-8";
            }
            return null;
        }
    };
    
    var callback = function (response, status, xhr2) {
        same(status, 200);
        ok(xhr2 == xhr);
        same(response instanceof Object, true);
        same(response._id, "12345");
        same(response.data, "Testing");
        callbackCalled = true;
    }
    
    var r = pc.net.http.request("GET", "http://test.com", { success : callback }, xhr);
    
    ok(r === xhr);
    same(dataSet, true);
    same(callbackCalled, true);
});



test("request: check that XML data is returned correctly", function() {
    var headerSet, dataSet, callbackCalled;
    var xml = document.implementation.createDocument("", "xml", null);
    
    var xhr = {
        open: function(method, url, async) {},
        send: function(postdata) {
            xhr.readyState = 4;
            xhr.status = 200;
            xhr.responseXML = xml; 
            xhr.onreadystatechange();
            dataSet = true;
        },
        getResponseHeader : function (header) {
            if (header == "Content-Type") {
                return "application/xml";
            }
            return null;
        }
    };
    
    var callback = function (response, status, xhr2) {
        same(status, 200);
        ok(xhr2 == xhr);
        same(response instanceof Document, true);
        same(response, xml);
        callbackCalled = true;
    }
    
    var r = pc.net.http.request("GET", "http://test.com", { success : callback }, xhr);
    
    ok(r === xhr);
    same(dataSet, true);
    same(callbackCalled, true);
});

test("request: send FormData", 1, function () {
    var xhr = {
        open: function (method, url, async) {},
        send: function (postdata) {
            ok(postdata instanceof FormData);
        },
        setRequestHeader: function () {}
    }
    
    pc.net.http.request("POST", "http://test.com", {postdata: new FormData()}, xhr);
});

module('pc.net.oauth');

test("Methods exist", function() {
    var oauth = new pc.net.OAuth();
    ok(oauth.get);
    ok(oauth.post);
    ok(oauth.put);
    ok(oauth.request);    
});


test("request: adds access_token to plain url", function () {
    jack(function() {
        var oauth = new pc.net.OAuth();
        oauth.accessToken = "abc123";
        
        var xhr  = jack.create("xhr", ["open", "send"]);
        jack.expect("xhr.open").withArguments("GET", "http://test.com?access_token=abc123", true);
        jack.expect("xhr.send").withArguments(null);
        var r = oauth.request("GET", "http://test.com", {}, xhr);
        ok(r === xhr);
    });
});

test("request: adds access_token to url with existing query", function () {
    jack(function() {
        var oauth = new pc.net.OAuth();
        oauth.accessToken = "abc123";

        var xhr  = jack.create("xhr", ["open", "send"]);
        jack.expect("xhr.open").withArguments("GET", "http://test.com?a=1&access_token=abc123", true);
        jack.expect("xhr.send").withArguments(null);
        var r = oauth.request("GET", "http://test.com?a=1", {}, xhr);
        ok(r === xhr);
    });
});

test("request: adds access_token to url with options.query", function () {
    jack(function() {
        var oauth = new pc.net.OAuth();
        oauth.accessToken = "abc123";
        
        var xhr  = jack.create("xhr", ["open", "send"]);
        jack.expect("xhr.open").withArguments("GET", "http://test.com?a=1&access_token=abc123", true);
        jack.expect("xhr.send").withArguments(null);
        var r = oauth.request("GET", "http://test.com", {
            query: {
                a: 1
            }
        }, xhr);
        ok(r === xhr);
    });
});

test("request: 401 error calls refreshAccessToken", 1, function () {
    var oauth = new pc.net.OAuth();
    oauth.refreshAccessToken = function (success) {
        ok(true);
        this.accessToken = "refreshed" 
        success(this.access_token);
    };
    
    var done = false;
    var xhr = {
        open: function(method, url, async) {
            if (url.indexOf("refreshed") >= 0) {
                done = true;
            }
        },
        send: function() {
            xhr.readyState = 4;
            xhr.status = done ? 200 : 401;
            xhr.onreadystatechange();
        },
        getResponseHeader : function () {}
    };
    
    var r = oauth.request("GET", "http://example.com", {}, xhr);
    
});

asyncTest("refreshAccessToken", 3, function () {
    var origin = window.location.href.split("/").slice(0,3).join("/");
    var oauth = new pc.net.OAuth("http://example.com/endpoint", "http://example.com/redirect", origin, "client_id", "scope");
    
    oauth.refreshAccessToken(function (token) {
        equal(token, "abc123");
        start();
    });
    
    var iframe = document.getElementById("pc-oauth-access-token");
    ok(iframe);
    equal(iframe.src, "http://example.com/endpoint?client_id=client_id&redirect_url=" + encodeURIComponent("http://example.com/redirect") + "&scope=scope&response_type=token");
    
    window.postMessage({
        access_token: "abc123"
    }, origin);
    
});

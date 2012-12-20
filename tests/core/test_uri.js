module("pc.uri");

test("Parsed, all sections", function () {
    var s = "http://a/b/c/d;p?q=r#l";
    
    var uri = new pc.URI(s);
    
    equal(uri.scheme, "http");
    equal(uri.authority, "a");
    equal(uri.path, "/b/c/d;p");
    equal(uri.query, "q=r");
    equal(uri.fragment, "l");

});

test("Parse, no scheme", function () {
    var s = "//a/b/c/d;p?q=r#l";
    var uri = new pc.URI(s);
    var undef;
    
    equal(uri.scheme, undef);
    equal(uri.authority, "a");
    equal(uri.path, "/b/c/d;p");
    equal(uri.query, "q=r");
    equal(uri.fragment, "l");
        
});

test("Parse, no authority", function () {
    var s = "/b/c/d;p?q=r#l";
    var uri = new pc.URI(s);
    var undef;
    
    equal(uri.scheme, undef);
    equal(uri.authority, undef);
    equal(uri.path, "/b/c/d;p");
    equal(uri.query, "q=r");
    equal(uri.fragment, "l");
        
});

test("Parse, no query", function () {
    var s = "http://a/b/c/d;p#l";
    var uri = new pc.URI(s);
    var undef;
    
    equal(uri.scheme, "http");
    equal(uri.authority, "a");
    equal(uri.path, "/b/c/d;p");
    equal(uri.query, undef);
    equal(uri.fragment, "l");
        
});

test("Parse, no fragment", function () {
    var s = "http://a/b/c/d;p?q=r";
    var uri = new pc.URI(s);
    var undef;
    
    equal(uri.scheme, "http");
    equal(uri.authority, "a");
    equal(uri.path, "/b/c/d;p");
    equal(uri.query, "q=r");
    equal(uri.fragment, undef);
        
});

test("toString", function () {
    var s = "http://a/b/c/d;p?q=r#l";
    var uri = new pc.URI(s);
    var r = uri.toString();
    
    equal(s,r);
});

test("Edit query", function() {
    var s = "http://example.com";
    var uri = new pc.URI(s);
    uri.query = "q=abc";
    
    equal(uri.toString(), "http://example.com?q=abc");
    
    uri.query = "";
    equal(uri.toString(), s);
    
});

test("getQuery", function () {
    var s = "http://example.com/test?a=1&b=string&c=something%20spaced";
    var uri = new pc.URI(s);
    
    var q = uri.getQuery();
    
    equal(q.a, "1");
    equal(q.b, "string");
    equal(q.c, "something spaced");    
});

test("getQuery: emtpy", function () {
    var s = "http://example.com/test";
    var uri = new pc.URI(s);
    
    var q = uri.getQuery();
    
    equal(Object.keys(q).length, 0);
});

test("setQuery", function () {
    var uri = new pc.URI("http://example.com/test");
    var q = {
        key: "value",
        "with space": "\""
    };
    
    uri.setQuery(q);
    equal("key=value&with%20space=%22", uri.query)
});

test("createURI", function () {
   var uri;
   
   uri = pc.createURI({
       scheme: "http",
       authority: "example.com",
       path: "/abc"     
   });
   equal("http://example.com/abc", uri);

   uri = pc.createURI({
       host: "http://example.com",
       path: "/abc"     
   });
   equal("http://example.com/abc", uri);

   uri = pc.createURI({
       hostpath: "http://example.com/abc",
   });
   equal("http://example.com/abc", uri);

   uri = pc.createURI({
       hostpath: "http://example.com/abc",
       query: "a=b&c=d"
   });
   equal("http://example.com/abc?a=b&c=d", uri);
   
});

test("createURI, exceptions", function () {
   var uri;
   
   raises(function() {
       pc.createURI({
           scheme: "http",
           host: "http://test.com"
       });
   });
   
   raises(function() {
       pc.createURI({
           authority: "http",
           host: "http://test.com"
       });
   });

   raises(function() {
       pc.createURI({
           scheme: "http",
           hostpath: "http://test.com"
       });
   });

   raises(function() {
       pc.createURI({
           authority: "http",
           hostpath: "http://test.com"
       });
   });

   raises(function() {
       pc.createURI({
           scheme: "http",
           authority: "e.com",
           host: "http://test.com"
       });
   });

   raises(function() {
       pc.createURI({
           scheme: "abc",
           authority: "http",
           hostpath: "http://test.com"
       });
   });
   
   raises(function() {
       pc.createURI({
           host: "http://test.com",
           hostpath: "http://test.com"
       });
   });


});

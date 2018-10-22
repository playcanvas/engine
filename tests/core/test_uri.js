describe('pc.URI', function () {
    it("Parsed, all sections", function () {
        var s = "http://a/b/c/d;p?q=r#l";

        var uri = new pc.URI(s);

        expect(uri.scheme).to.equal("http");
        expect(uri.authority).to.equal("a");
        expect(uri.path).to.equal("/b/c/d;p");
        expect(uri.query).to.equal("q=r");
        expect(uri.fragment).to.equal("l");

    });

    it("Parse, no scheme", function () {
        var s = "//a/b/c/d;p?q=r#l";
        var uri = new pc.URI(s);
        var undef;

        expect(uri.scheme).to.equal(undef);
        expect(uri.authority).to.equal("a");
        expect(uri.path).to.equal("/b/c/d;p");
        expect(uri.query).to.equal("q=r");
        expect(uri.fragment).to.equal("l");

    });

    it("Parse, no authority", function () {
        var s = "/b/c/d;p?q=r#l";
        var uri = new pc.URI(s);
        var undef;

        expect(uri.scheme).to.equal(undef);
        expect(uri.authority).to.equal(undef);
        expect(uri.path).to.equal("/b/c/d;p");
        expect(uri.query).to.equal("q=r");
        expect(uri.fragment).to.equal("l");
    });

    it("Parse, no query", function () {
        var s = "http://a/b/c/d;p#l";
        var uri = new pc.URI(s);
        var undef;

        expect(uri.scheme).to.equal("http");
        expect(uri.authority).to.equal("a");
        expect(uri.path).to.equal("/b/c/d;p");
        expect(uri.query).to.equal(undef);
        expect(uri.fragment).to.equal("l");
    });

    it("Parse, no fragment", function () {
        var s = "http://a/b/c/d;p?q=r";
        var uri = new pc.URI(s);
        var undef;

        expect(uri.scheme).to.equal("http");
        expect(uri.authority).to.equal("a");
        expect(uri.path).to.equal("/b/c/d;p");
        expect(uri.query).to.equal("q=r");
        expect(uri.fragment).to.equal(undef);
    });

    it("toString", function () {
        var s = "http://a/b/c/d;p?q=r#l";
        var uri = new pc.URI(s);
        var r = uri.toString();

        expect(s).to.equal(r);
    });

    it("Edit query", function() {
        var s = "http://example.com";
        var uri = new pc.URI(s);
        uri.query = "q=abc";

        expect(uri.toString()).to.equal("http://example.com?q=abc");

        uri.query = "";
        expect(uri.toString()).to.equal(s);

    });

    it("getQuery", function () {
        var s = "http://example.com/test?a=1&b=string&c=something%20spaced";
        var uri = new pc.URI(s);

        var q = uri.getQuery();

        expect(q.a).to.equal("1");
        expect(q.b).to.equal("string");
        expect(q.c).to.equal("something spaced");
    });

    it("getQuery: emtpy", function () {
        var s = "http://example.com/test";
        var uri = new pc.URI(s);

        var q = uri.getQuery();

        expect(Object.keys(q).length).to.equal(0);
    });

    it("setQuery", function () {
        var uri = new pc.URI("http://example.com/test");
        var q = {
          key: "value",
          "with space": "\""
        };

        uri.setQuery(q);
        expect("key=value&with%20space=%22").to.equal(uri.query)
    });

    it("createURI", function () {
        var uri;

        uri = pc.createURI({
            scheme: "http",
            authority: "example.com",
            path: "/abc"
        });
        expect("http://example.com/abc").to.equal(uri);

        uri = pc.createURI({
            host: "http://example.com",
            path: "/abc"
        });
        expect("http://example.com/abc").to.equal(uri);

        uri = pc.createURI({
            hostpath: "http://example.com/abc",
        });
        expect("http://example.com/abc").to.equal(uri);

        uri = pc.createURI({
            hostpath: "http://example.com/abc",
            query: "a=b&c=d"
        });
        expect("http://example.com/abc?a=b&c=d").to.equal(uri);

    });

    it("createURI, exceptions", function () {
        expect(function() {
            pc.createURI({
                scheme: "http",
                host: "http://test.com"
            });
        }).to.throw();

        expect(function() {
            pc.createURI({
                authority: "http",
                host: "http://test.com"
            });
        }).to.throw();

        expect(function() {
            pc.createURI({
                scheme: "http",
                hostpath: "http://test.com"
            });
        }).to.throw();

        expect(function() {
            pc.createURI({
                authority: "http",
                hostpath: "http://test.com"
            });
        }).to.throw();

        expect(function() {
            pc.createURI({
                scheme: "http",
                authority: "e.com",
                host: "http://test.com"
            });
        }).to.throw();

        expect(function() {
            pc.createURI({
                scheme: "abc",
                authority: "http",
                hostpath: "http://test.com"
            });
        }).to.throw();

        expect(function() {
            pc.createURI({
                host: "http://test.com",
                hostpath: "http://test.com"
            });
        }).to.throw();
    });
});


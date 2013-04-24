module('pc.resources.ResourceLoader');

var TestResourceHandler = function () {
    this.loaded = 0;
	this.opened = 0;
};
TestResourceHandler = pc.inherits(TestResourceHandler, pc.resources.ResourceHandler);
TestResourceHandler.prototype.load = function (request, options) {
    this.loaded++;
    var identifier = request.canonical;
    
    return new RSVP.Promise(function (resolve, reject) {
        resolve(identifier);
    });
};

TestResourceHandler.prototype.open = function (response, request, options) {
    this.opened++;
    return response + "-opened";
};

var TestRequest = function TestRequest() {};
TestRequest = pc.inherits(TestRequest, pc.resources.ResourceRequest);
TestRequest.type = "test";

// Simulate a hierarchical asset handler
// When a 'ChildRequest' is made the handler pushes the callbacks onto this.success, this.progress and this.error
// Then the test can simulate the loading succeeding by calling  the callbacks from the list
// The 'ChildRequest' simulated loading also add another request to be loaded, only this time it is added this.delayed
// So you can simulate loading the child before or after the parent
var ChildResourceHandler = function (depth, requestInOpen) {
    this.depth = depth;
    this.loaded = 0;
    this.opened = 0;
    this.children = 0;
    this.requestInOpen = requestInOpen;
};
ChildResourceHandler = pc.inherits(ChildResourceHandler, pc.resources.ResourceHandler);
pc.extend(ChildResourceHandler.prototype, {
    load: function (request, options) {
        var self = this;

        self.loaded++;

        var identifier = request.canonical;

        var promise = new RSVP.Promise(function (resolve, reject) {
            if (!self.requestInOpen) {
                self._doRequest(request);
            }

            // If child resource has 'delay' then resolve after 200ms.
            if (identifier.indexOf("delay") >= 0) {
                self.children++;
                setTimeout(function () {
                    resolve(identifier);
                }, 200);
            } else {
                resolve(identifier);    
            }
        });
        
        return promise;
    },

    open: function (response, request, options) {
        this.opened++;

        if (this.requestInOpen) {
            this._doRequest(request);
        }

        return response + "-opened";
    },

    _doRequest: function (request) {
        var identifier = request.canonical;

        var depth = parseInt(identifier[identifier.length-1]);

        if (depth < this.depth) {
            depth++;
            this._loader.request(new ChildRequest("delay_" + identifier.substr(0, identifier.length-1) + depth), {parent:request});
        }
    }
});

var ChildRequest = function ChildRequest() {};
ChildRequest = pc.inherits(ChildRequest, pc.resources.ResourceRequest);
ChildRequest.type = "child";

test("new ResourceLoader", function () {
    ok(pc.resources.ResourceLoader);
    
    var loader = new pc.resources.ResourceLoader();
    ok(loader);	
});

test("ResourceLoader: registerHandler", function () {
	var loader = new pc.resources.ResourceLoader();
	
	var handler = new TestResourceHandler();
	loader.registerHandler(TestRequest, handler);
	
	var request = new TestRequest();
	
	ok(loader._handlers[request.type]);
});

test("ResourceLoader: request single resource", function () {
	var loader = new pc.resources.ResourceLoader();
	var handler = new TestResourceHandler();
	loader.registerHandler(TestRequest, handler);
	
	var requests = [
		new TestRequest("http://abc.com/directory/resource/1")
	];
	
    var p = loader.request(requests);
	
    p.then(function (resources) {
        equal(resources[0], "http://abc.com/directory/resource/1-opened");
        equal(handler.loaded, 1);
        equal(handler.opened, 1);
        start();
    });

    stop();
});

test("ResourceLoader: request multiple resources", function () {
	var loader = new pc.resources.ResourceLoader();
	var handler = new TestResourceHandler();
	loader.registerHandler(TestRequest, handler);
	
	var requests = [
		new TestRequest("http://abc.com/directory/resource/1"),
		new TestRequest("http://abc.com/directory/resource/2"),
		new TestRequest("http://abc.com/directory/resource/3"),
		new TestRequest("http://abc.com/directory/resource/4")
	];
	var p = loader.request(requests);
    
    p.then(function (resources) {
        equal(resources[0], "http://abc.com/directory/resource/1-opened");
        equal(resources[1], "http://abc.com/directory/resource/2-opened");
        equal(resources[2], "http://abc.com/directory/resource/3-opened");
        equal(resources[3], "http://abc.com/directory/resource/4-opened");
        start();
    });

    stop();
});

test("ResourceLoader: request called twice with different resources", function () {
	var loader = new pc.resources.ResourceLoader();
	var handler = new TestResourceHandler();
	loader.registerHandler(TestRequest, handler);
	
	var first = [
		new TestRequest("http://abc.com/directory/resource/1"),
		new TestRequest("http://abc.com/directory/resource/2"),
		new TestRequest("http://abc.com/directory/resource/3"),
		new TestRequest("http://abc.com/directory/resource/4")
	];
	
	var second = [
		new TestRequest("http://abc.com/directory/resource/5"),
		new TestRequest("http://abc.com/directory/resource/6"),
		new TestRequest("http://abc.com/directory/resource/7"),
		new TestRequest("http://abc.com/directory/resource/8")
	];
	
	var p1 = loader.request(first);
	var p2 = loader.request(second);
    
    p1.then(function (resources) {
        equal(resources[0], "http://abc.com/directory/resource/1-opened");
        equal(resources[1], "http://abc.com/directory/resource/2-opened");
        equal(resources[2], "http://abc.com/directory/resource/3-opened");
        equal(resources[3], "http://abc.com/directory/resource/4-opened");
    });

    p2.then(function (resources) {
        equal(resources[0], "http://abc.com/directory/resource/5-opened");
        equal(resources[1], "http://abc.com/directory/resource/6-opened");
        equal(resources[2], "http://abc.com/directory/resource/7-opened");
        equal(resources[3], "http://abc.com/directory/resource/8-opened");
        start();
    });

    stop();
});

test("ResourceLoader: request called twice with same resources", function () {
	var expectedMaxConcurrentRequests = 2;
	
	var loader = new pc.resources.ResourceLoader({
		maxConcurrentRequests: expectedMaxConcurrentRequests 
	});
	var handler = new TestResourceHandler();
	loader.registerHandler(TestRequest, handler);
	var firstComplete = false;
	var secondComplete = false;
	
	var first = [
		new TestRequest("http://abc.com/directory/resource/1"),
		new TestRequest("http://abc.com/directory/resource/2"),
		new TestRequest("http://abc.com/directory/resource/3"),
		new TestRequest("http://abc.com/directory/resource/4")
	];
	
	var second = [
		new TestRequest("http://abc.com/directory/resource/3"),
		new TestRequest("http://abc.com/directory/resource/4"),
		new TestRequest("http://abc.com/directory/resource/5"),
		new TestRequest("http://abc.com/directory/resource/6")
	];
	
	var p1 = loader.request(first);
	var p2 = loader.request(second);
    
    p1.then(function (resources) {
        equal(resources[0], "http://abc.com/directory/resource/1-opened");
        equal(resources[1], "http://abc.com/directory/resource/2-opened");
        equal(resources[2], "http://abc.com/directory/resource/3-opened");
        equal(resources[3], "http://abc.com/directory/resource/4-opened");
    });

    p2.then(function (resources) {
        equal(resources[0], "http://abc.com/directory/resource/3-opened");
        equal(resources[1], "http://abc.com/directory/resource/4-opened");
        equal(resources[2], "http://abc.com/directory/resource/5-opened");
        equal(resources[3], "http://abc.com/directory/resource/6-opened");
        start();        -opened
    })

    stop();	
});

test("ResourceLoader: second request returned from cache", function () {
    var loader = new pc.resources.ResourceLoader();

    var handler = new TestResourceHandler();
    loader.registerHandler(TestRequest, handler);

    var p = loader.request(new TestRequest('http://abc.com/directory/resource/1'));

    p.then(function (resource) {
        var p = loader.request(new TestRequest('http://abc.com/directory/resource/1'));
        p.then(function (resource) {
            equal(handler.loaded, 1);
            equal(handler.opened, 1);
            equal(resource, 'http://abc.com/directory/resource/1-opened');
            start();
        });
    }, function (error) {
        asd;
    });

    stop();
});

test("ChildRequest: request a hierarchical resource", 11, function () {
    var loader = new pc.resources.ResourceLoader();
    var handler = new ChildResourceHandler(1);
    loader.registerHandler(ChildRequest, handler);
    
    var first = [
        new ChildRequest("1_0"),
        new ChildRequest("2_0"),
        new ChildRequest("3_0"),
        new ChildRequest("4_0")
    ];
        
    var p = loader.request(first);

    p.then(function (resources) {
        equal(resources[0], "1_0-opened");
        equal(resources[1], "2_0-opened");
        equal(resources[2], "3_0-opened");
        equal(resources[3], "4_0-opened");

        equal(handler.loaded, 8);
        equal(handler.opened, 8);
        equal(handler.children, 4);

        // Check child resources are in cache
        equal(loader.getFromCache('delay_1_1'), "delay_1_1-opened");
        equal(loader.getFromCache('delay_2_1'), "delay_2_1-opened");
        equal(loader.getFromCache('delay_3_1'), "delay_3_1-opened");
        equal(loader.getFromCache('delay_4_1'), "delay_4_1-opened");

        start();
    });

    stop();
});


test("ChildRequest: request a deep hierarchical resource", 7, function () {
    var expectedMaxConcurrentRequests = 8;
    
    var loader = new pc.resources.ResourceLoader();
    var handler = new ChildResourceHandler(3);
    loader.registerHandler(ChildRequest, handler);
    
    var first = [
        new ChildRequest("1_0")
    ];
        
    var p = loader.request(first);
    p.then(function (resources) {
        equal(resources[0], "1_0-opened");
        
        equal(handler.loaded, 4);
        equal(handler.opened, 4);
        equal(handler.children, 3);

        // Check child resources are in cache
        equal(loader.getFromCache('delay_1_1'), "delay_1_1-opened");
        equal(loader.getFromCache('delay_delay_1_2'), "delay_delay_1_2-opened");
        equal(loader.getFromCache('delay_delay_delay_1_3'), "delay_delay_delay_1_3-opened");

        start();
    });

    stop();
});

test("ChildRequest: hierarchical request made in open()", function () {
    var loader = new pc.resources.ResourceLoader();
    var handler = new ChildResourceHandler(3, true);
    loader.registerHandler(ChildRequest, handler);
    
    var first = [
        new ChildRequest("1_0")
    ];
        
    var p = loader.request(first);
    p.then(function (resources) {
        equal(resources[0], "1_0-opened");
        
        equal(handler.loaded, 4);
        equal(handler.opened, 4);
        equal(handler.children, 3);

        // Check child resources are in cache
        equal(loader.getFromCache('delay_1_1'), "delay_1_1-opened");
        equal(loader.getFromCache('delay_delay_1_2'), "delay_delay_1_2-opened");
        equal(loader.getFromCache('delay_delay_delay_1_3'), "delay_delay_delay_1_3-opened");

        start();
    });

    stop();
})

test("ResourceLoader: cancel", function () {
	var expectedMaxConcurrentRequests = 2;
	
	var loader = new pc.resources.ResourceLoader({
		maxConcurrentRequests: expectedMaxConcurrentRequests 
	});
	var handler = new TestResourceHandler();
	loader.registerHandler(TestRequest, handler);
	
	var requests = [
		new TestRequest("http://abc.com/directory/resource/1"),
		new TestRequest("http://abc.com/directory/resource/2"),
		new TestRequest("http://abc.com/directory/resource/3"),
		new TestRequest("http://abc.com/directory/resource/4")
	];
	var handle = loader.request(requests, 1);
	
	loader.cancel(handle);
	
	equal(loader._pending.length, 0);
});

test("ResourceLoader: progress callback is passed to load", 1, function () {
    var loader = new pc.resources.ResourceLoader({
    });
    
    var handler = new TestResourceHandler();
    loader.registerHandler(TestRequest, handler);
    
    var requests = [
        new TestRequest("http://abc.com/directory/resource/1")
    ];
    
    var handle = loader.request(requests, 1, function (resource) {
        throw Error("Shouldn't get here.")
    }, function (error) {
        throw Error("Shouldn't get here.")
    }, function (progress) {
        equal(100,100);
    });

    // trigger progress callback that was passed into load
    handler.progress[0](100);    
});

test("ResourceLoader: error callback is passed to load", 1, function () {
    var loader = new pc.resources.ResourceLoader({
    });
    
    var handler = new TestResourceHandler();
    loader.registerHandler(TestRequest, handler);
    
    var requests = [
        new TestRequest("http://abc.com/directory/resource/1")
    ];
    
    var handle = loader.request(requests, 1, function (resources) {
        throw Error("Shouldn't get here.")
    }, function (errors, resources) {
        equal(errors["http://abc.com/directory/resource/1"], "Test error");
    });

    // trigger error callback that was passed into load
    handler.error[0]("Test error");    
});

test("ResourceLoader: error in child resource causes error in parent", 1, function () {
    var loader = new pc.resources.ResourceLoader({
    });
    
    var handler = new ChildResourceHandler(1);
    loader.registerHandler(ChildRequest, handler);
    
    var requests = [
        new ChildRequest("1_0")
    ];
    
    var handle = loader.request(requests, 1, function (resource) {
        throw Error("Shouldn't get here.")
    }, function (errors, resources) {
        equal(errors["delay_1_1"], "Test error");
    });

    // trigger error callback in child
    handler.error[1]("Test error");
});

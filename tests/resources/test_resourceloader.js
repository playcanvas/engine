module('pc.resources.ResourceLoader');

var TestResourceHandler = function () {
	this.success = [];
	this.error = [];
	this.progress = [];
	this.opened = false;
};
TestResourceHandler = TestResourceHandler.extendsFrom(pc.resources.ResourceHandler);
TestResourceHandler.prototype.load = function (identifier, success, error, progress, options) {
	this.success.push(success);
	this.error.push(error);
	this.progress.push(progress);
};

TestResourceHandler.prototype.open = function (response, options) {
    this.opened = true;
    return response;
};

var TestRequest = function TestRequest() {};
TestRequest = TestRequest.extendsFrom(pc.resources.ResourceRequest);
TestRequest.type = "test";

// Simulate a hierarchical asset handler
// When a 'ChildRequest' is made the handler pushes the callbacks onto this.success, this.progress and this.error
// Then the test can simulate the loading succeeding by calling  the callbacks from the list
// The 'ChildRequest' simulated loading also add another request to be loaded, only this time it is added this.delayed
// So you can simulate loading the child before or after the parent
var ChildResourceHandler = function (depth) {
    this.success = [];
    this.delayed = []; // delayed success callbacks to simulate larger files
    this.error = [];
    this.progress = [];
    this.depth = depth;
};
ChildResourceHandler = ChildResourceHandler.extendsFrom(pc.resources.ResourceHandler);
ChildResourceHandler.prototype.load = function (identifier, success, error, progress, options) {
    // If child resource has 'delay' in the name then push it on the delay list,
    // otherwise use the success list
    if(identifier.indexOf("delay") >= 0) {
        this.delayed.push(success);        
    } else {
        this.success.push(success);
    }
    this.error.push(error);
    this.progress.push(progress);

    depth = parseInt(identifier[identifier.length-1]);
    
    if(depth < this.depth) {
        this._loader.request(new ChildRequest("delay_" + identifier.substr(0, identifier.length-1) + ++depth), 
            function (resources) {}, 
            function (errors) {}, 
            function (progress) {}, 
            options);        
    }
};

ChildResourceHandler.prototype.open = function (response, options) {
    this.opened = true;
    return response;
}

var ChildRequest = function ChildRequest() {};
ChildRequest = ChildRequest.extendsFrom(pc.resources.ResourceRequest);
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
	loader.request(requests, 1);
	
	equal(loader._batches.length, 1);
	equal(loader._pending.length, 0);
	equal(loader._loading.length, 1);
	
	equal(loader._loading[0], requests[0].identifier);

	// trigger successfully loads
	handler.success.forEach(function (callback, index, arr) {
		callback(index);
	}, this);
    
    
	equal(loader._batches.length, 0);
	equal(loader._pending.length, 0);
	equal(loader._loading.length, 0);
    
    equal(handler.opened, true);
});

test("ResourceLoader: request multiple resources", function () {
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
	loader.request(requests, 1);
	
	equal(loader._batches.length, 1);
	equal(loader._pending.length, requests.length - expectedMaxConcurrentRequests);
	equal(loader._loading.length, expectedMaxConcurrentRequests);
	
	equal(loader._loading[0], requests[0].identifier)
	equal(loader._loading[1], requests[1].identifier)
	
	// trigger successfully loads
	handler.success.forEach(function (callback, index, arr) {
		callback(index);
	}, this);
	handler.success.splice(0,2);

	equal(loader._batches.length, 1);
	equal(loader._pending.length, 0);
	equal(loader._loading.length, expectedMaxConcurrentRequests);
	
	equal(loader._loading[0], requests[2].identifier)
	equal(loader._loading[1], requests[3].identifier)

	// trigger more successfully loads
	handler.success.forEach(function (callback, index, arr) {
		callback(index);
	}, this);
	handler.success = [];

	equal(loader._batches.length, 0);
	equal(loader._pending.length, 0);
	equal(loader._loading.length, 0);	
});

test("ResourceLoader: request called twice with different resources", function () {
	var expectedMaxConcurrentRequests = 2;
	
	var loader = new pc.resources.ResourceLoader({
		maxConcurrentRequests: expectedMaxConcurrentRequests 
	});
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
	
	loader.request(first, 1);
	loader.request(second, 1);
	
	equal(loader._batches.length, 2);
	equal(loader._pending.length, 8 - expectedMaxConcurrentRequests);
	equal(loader._loading.length, expectedMaxConcurrentRequests);
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
	
	loader.request(first, 1, function (resources) {
		firstComplete = true;	
	});
	loader.request(second, 1, function (resources) {
		secondComplete = true;
	});
	
	equal(loader._batches.length, 2);
	equal(loader._pending.length, 4);
	equal(loader._loading.length, expectedMaxConcurrentRequests);
	
	// trigger successfully loads 2 at a time
	handler.success.forEach(function (callback, index, arr) {
		callback(index);
	}, this);
	handler.success.splice(0,2);

	handler.success.forEach(function (callback, index, arr) {
		callback(index);
	}, this);
	handler.success.splice(0,2);
	
	equal(firstComplete, true);

	handler.success.forEach(function (callback, index, arr) {
		callback(index);
	}, this);
	handler.success.splice(0,2);
	
	equal(secondComplete, true);	
	
});

test("ResourceLoader: request called twice with different priorities", function () {
	var expectedMaxConcurrentRequests = 2;
	
	var loader = new pc.resources.ResourceLoader({
		maxConcurrentRequests: expectedMaxConcurrentRequests 
	});
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
	
	loader.request(first, 2);
	loader.request(second, 1);
	
	equal(loader._batches.length, 2);
	equal(loader._pending.length, 8 - expectedMaxConcurrentRequests);
	equal(loader._loading.length, expectedMaxConcurrentRequests);

	equal(loader._pending[0], second[0].identifier);
	equal(loader._pending[1], second[1].identifier);
	equal(loader._pending[2], second[2].identifier);
	equal(loader._pending[3], second[3].identifier);
	equal(loader._pending[4], first[2].identifier);
	equal(loader._pending[5], first[3].identifier);

});

test("ChildRequest: request a hierarchical resource", 4, function () {
    var expectedMaxConcurrentRequests = 8;
    
    var loader = new pc.resources.ResourceLoader({
        maxConcurrentRequests: expectedMaxConcurrentRequests 
    });
    var handler = new ChildResourceHandler(1);
    loader.registerHandler(ChildRequest, handler);
    
    var first = [
        new ChildRequest("1_0"),
        new ChildRequest("2_0"),
        new ChildRequest("3_0"),
        new ChildRequest("4_0")
    ];
        
    loader.request(first, 1, function (resources) {
        ok(resources["1_0"]);
        ok(resources["2_0"]);
        ok(resources["3_0"]);
        ok(resources["4_0"]);
    });

    // Simulate first round of success callbacks
    handler.success.forEach(function (callback, index, arr) {
        callback(index+1);
    }, this);
    handler.success.splice(0,4);

    handler.delayed.forEach(function (callback, index, arr) {
        callback(index+1);
    }, this);
    handler.delayed.splice(0,4);
});


test("ChildRequest: request a hierarchical resource", 1, function () {
    var expectedMaxConcurrentRequests = 8;
    
    var loader = new pc.resources.ResourceLoader({
        maxConcurrentRequests: expectedMaxConcurrentRequests 
    });
    var handler = new ChildResourceHandler(3);
    loader.registerHandler(ChildRequest, handler);
    
    var first = [
        new ChildRequest("1_0")
    ];
        
    loader.request(first, 1, function (resources) {
        ok(resources["1_0"]);
    });

    // Simulate first round of success callbacks
    handler.success.forEach(function (callback, index, arr) {
        callback(index+1);
    }, this);
    handler.success.splice(0,1);

    handler.delayed.forEach(function (callback, index, arr) {
        callback(index+1);
    }, this);
    handler.delayed.splice(0,1);
});

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

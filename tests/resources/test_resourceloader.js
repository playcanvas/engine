module('pc.resources.ResourceLoader');

// Test request that always succeeds
var TestResourceHandler = function () {
    this.loaded = 0;
	this.opened = 0;
};
TestResourceHandler = pc.inherits(TestResourceHandler, pc.resources.ResourceHandler);
TestResourceHandler.prototype.load = function (request, options) {
    this.loaded++;
    var identifier = request.canonical;
    
    return new RSVP.Promise(function (resolve, reject) {
        // if the identifier contains the string "delay" then we simulate a 1s delay in retrieving the resource
        if (identifier.indexOf("delay") >= 0) {
            setTimeout(function () {
                resolve(identifier);        
            }, 500);
        } else {
            resolve(identifier);
        }
    });
};

TestResourceHandler.prototype.open = function (response, request, options) {
    this.opened++;
    return new String(response + "-opened");
};

var TestRequest = function TestRequest() {};
TestRequest = pc.inherits(TestRequest, pc.resources.ResourceRequest);
TestRequest.prototype.type = "test";
TestRequest.prototype.Type = String;

// Request that always errors
var ErrorResourceHandler = function (errorInOpen) {
    this.loaded = 0;
    this.errorInOpen = errorInOpen;
};
ErrorResourceHandler = pc.inherits(ErrorResourceHandler, pc.resources.ResourceHandler);
ErrorResourceHandler.prototype.load = function (request, options) {
    var self = this;
    this.loaded++;
    var identifier = request.canonical;
    
    return new RSVP.Promise(function (resolve, reject) {
        if (!self.errorInOpen) {
            reject("An error occured");    
        } else {
            resolve(identifier);
        }
    });
};

ErrorResourceHandler.prototype.open = function (response, request, options) {
    this.opened++;
    if (this.errorInOpen) {
        throw Error("An error occured");
    }
    return response + "-opened";
};

var ErrorRequest = function ErrorRequest() {};
ErrorRequest = pc.inherits(ErrorRequest, pc.resources.ResourceRequest);
ErrorRequest.prototype.type = "error";


// Request that returns a cloned object
var ClonedResourceHandler = function () {
};
ClonedResourceHandler = pc.inherits(ClonedResourceHandler, pc.resources.ResourceHandler);
pc.extend(ClonedResourceHandler.prototype, {
    load: function (request, options) {
        var self = this;
        var identifier = request.canonical;
        
        return new RSVP.Promise(function (resolve, reject) {
            resolve(identifier);
        });
    },
    open: function (data, request, options) {
        var resource = {
            value: data + "-opened"
        };
        return resource;
    },
    clone: function (resource) {
        // return a new object
        return {
            value: resource.value
        }
    }
});

var ClonedRequest = function ClonedRequest() {};
ClonedRequest = pc.inherits(ClonedRequest, pc.resources.ResourceRequest);
ClonedRequest.prototype.type = "cloned";


// A request that makes child requests
// Set the max depth when you create it, and then format the identifier, "foo_0", each request will increment the last digit of the identifier
// to track the depth.
var ChildResourceHandler = function (depth, requestInOpen, errorRequest) {
    this.depth = depth;
    this.loaded = 0;
    this.opened = 0;
    this.children = 0;
    this.requestInOpen = requestInOpen; // perform child request in open() (otherwise in load())
    this.errorRequest = errorRequest; // Make the child request one that fails
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
            var childRequest; 
            if (!this.errorRequest) {
                childRequest = new ChildRequest("delay_" + identifier.substr(0, identifier.length-1) + depth);
            } else {
                childRequest = new ErrorRequest("error_" + identifier.substr(0, identifier.length-1) + depth)
            }

            this._loader.request(childRequest, {parent:request});
        }
    }
});

var ChildRequest = function ChildRequest() {};
ChildRequest = pc.inherits(ChildRequest, pc.resources.ResourceRequest);
ChildRequest.prototype.type = "child";

// Request that accepts an object to be used as the resource, instead of creating a new one.
var FillInResourceHandler = function () {
    this.loaded = 0;
    this.opened = 0;
};
FillInResourceHandler = pc.inherits(FillInResourceHandler, pc.resources.ResourceHandler);
FillInResourceHandler.prototype.load = function (request, options) {
    this.loaded++;
    var identifier = request.canonical;
    
    return new RSVP.Promise(function (resolve, reject) {
        request.result.value = identifier;
        resolve(request.result);
    });
};

FillInResourceHandler.prototype.open = function (data, request, options) {
    this.opened++;
    data.value += "-opened";
    return data;
};

var FillInResult = function FillInResult() {};

var FillInRequest = function FillInRequest() {};
FillInRequest = pc.inherits(FillInRequest, pc.resources.ResourceRequest);
FillInRequest.prototype.type = "fillin";
FillInRequest.prototype.Type = FillInResult;

var DualChildRequest = function DualChildRequest() {};
DualChildRequest = pc.inherits(DualChildRequest, pc.resources.ResourceRequest);

var DualChildResourceHandler = function () {
    this.responses = [];
};
DualChildResourceHandler = pc.inherits(DualChildResourceHandler, pc.resources.ResourceHandler);
DualChildResourceHandler.prototype.load = function (request, options) {
    var self = this;
    return new RSVP.Promise(function (resolve, reject) {

        resolve(self);
    });
};
DualChildResourceHandler.prototype.open = function (data, request, options) {
    var self = this;
    var options = {
        parent: request
    };
    self._loader.request(new TestRequest("delay-abc"), options).then(function (responses) {
        self.responses.push(responses[0]);
    });
    self._loader.request(new TestRequest("delay-abc"), options).then(function (responses) {
        self.responses.push(responses[0]);
    });

    return data;
}

test("new ResourceLoader", function () {
    ok(pc.resources.ResourceLoader);
    
    var loader = new pc.resources.ResourceLoader();
    ok(loader);	
});

test("registerHandler", function () {
	var loader = new pc.resources.ResourceLoader();
	
	var handler = new TestResourceHandler();
	loader.registerHandler(TestRequest, handler);
	
	var request = new TestRequest();
	
	ok(loader._handlers[request.type]);
});


test("missing handler", function () {
    var loader = new pc.resources.ResourceLoader();
    
    var handler = new TestResourceHandler();
    loader.registerHandler(TestRequest, handler);
    
    var promise = loader.request(new ErrorRequest);
    promise.then(null, function (error) {
        equal(error, "Missing handler for type: error");
        start();
    });

    stop();
});

test("request single resource", function () {
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

test("request multiple resources", function () {
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


test("request multiple resources, correct order", function () {
    var loader = new pc.resources.ResourceLoader();
    var handler = new TestResourceHandler();
    loader.registerHandler(TestRequest, handler);
    
    var requests = [
        new TestRequest("delayed"),
        new TestRequest("http://abc.com/directory/resource/1"),
        new TestRequest("http://abc.com/directory/resource/2"),
        new TestRequest("http://abc.com/directory/resource/3")
    ];
    var p = loader.request(requests);
    
    p.then(function (resources) {
        equal(resources[0], "delayed-opened");
        equal(resources[1], "http://abc.com/directory/resource/1-opened");
        equal(resources[2], "http://abc.com/directory/resource/2-opened");
        equal(resources[3], "http://abc.com/directory/resource/3-opened");
        start();
    });

    stop();
});


test("two requests, same content, both callbacks called", 3, function () {
    var loader = new pc.resources.ResourceLoader();
    var handler = new TestResourceHandler();
    loader.registerHandler(TestRequest, handler);
    
    var p1 = loader.request(new TestRequest("delayed"));
    var p2 = loader.request(new TestRequest("delayed"));
        
    var count = 0;
    p1.then(function (resources) {
        equal(resources[0], "delayed-opened");
        count++;
    });
    
    p2.then(function (resources) {
        equal(resources[0], "delayed-opened");
        count++;
    });

    stop();
    setTimeout(function () {
        equal(count, 2);
        start();
    }, 1500);
});


test("Multiple requests for same content", 2, function () {
    var loader = new pc.resources.ResourceLoader();
    var handler = new TestResourceHandler();
    loader.registerHandler(TestRequest, handler);
    
    var p1 = loader.request([
        new TestRequest("delayed"),
        new TestRequest("delayed")
    ]);
        
    p1.then(function (resources) {
        equal(resources[0], "delayed-opened");
        equal(resources[1], "delayed-opened");
        start();
    });

    stop();
});

test("request called twice with different resources", function () {
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

test("request called twice with same resources", function () {
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

test("second request returned from cache", function () {
    var loader = new pc.resources.ResourceLoader();

    var handler = new TestResourceHandler();
    loader.registerHandler(TestRequest, handler);
    loader.registerHash('1234', 'http://abc.com/directory/resource/1');

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

test("request with no type is still cached", function () {
    var type = TestRequest.prototype.Type;
    TestRequest.prototype.Type = undefined;

    var loader = new pc.resources.ResourceLoader();

    var handler = new TestResourceHandler();
    loader.registerHandler(TestRequest, handler);
    loader.registerHash('1234', 'http://abc.com/directory/resource/1');

    var p = loader.request(new TestRequest('http://abc.com/directory/resource/1'));

    p.then(function (resource) {
        var p = loader.request(new TestRequest('http://abc.com/directory/resource/1'));
        p.then(function (resource) {
            equal(handler.loaded, 1);
            equal(handler.opened, 1);
            equal(resource, 'http://abc.com/directory/resource/1-opened');
            start();
            TestRequest.prototype.Type = type;
        });
    }, function (error) {
        asd;
    });

    stop();
});

test("request a hierarchical resource", 11, function () {
    var loader = new pc.resources.ResourceLoader();
    var handler = new ChildResourceHandler(1);
    loader.registerHandler(ChildRequest, handler);
        
    loader.registerHash('delay_1_1', 'delay_1_1');
    loader.registerHash('delay_2_1', 'delay_2_1');
    loader.registerHash('delay_3_1', 'delay_3_1');
    loader.registerHash('delay_4_1', 'delay_4_1');

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


test("request a deep hierarchical resource", 7, function () {
    var expectedMaxConcurrentRequests = 8;
    
    var loader = new pc.resources.ResourceLoader();
    var handler = new ChildResourceHandler(3);
    loader.registerHandler(ChildRequest, handler);
    
    loader.registerHash('delay_1_1', 'delay_1_1');
    loader.registerHash('delay_delay_1_2', 'delay_delay_1_2');
    loader.registerHash('delay_delay_delay_1_3', 'delay_delay_delay_1_3');

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

test("hierarchical request made in open()", function () {
    var loader = new pc.resources.ResourceLoader();
    var handler = new ChildResourceHandler(3, true);
    loader.registerHandler(ChildRequest, handler);
        
    loader.registerHash('delay_1_1', 'delay_1_1');
    loader.registerHash('delay_delay_1_3', 'delay_delay_1_2');
    loader.registerHash('delay_delay_delay_1_3', 'delay_delay_delay_1_3');
    
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


test("hierarchical request with child error", 2, function () {
    var loader = new pc.resources.ResourceLoader();

    loader.registerHandler(ChildRequest, new ChildResourceHandler(3, false, true));
    loader.registerHandler(ErrorRequest, new ErrorResourceHandler());
    var first = [
        new ChildRequest("1_0")
    ];
        
    var p = loader.request(first);
    p.then(function (resources) {
        ok(false);
    }, function (error) {
        equal(error, "An error occured");
    });

    loader.on("error", function (request, error) {
        equal(request.canonical, "error_1_1");
    });

    stop();
    setTimeout(start, 1000);
})

test("Progress event", 4, function () {
    var loader = new pc.resources.ResourceLoader();
    
    var handler = new TestResourceHandler();
    loader.registerHandler(TestRequest, handler);
    
    var requests = [
        new TestRequest("http://abc.com/directory/resource/1"),
        new TestRequest("http://abc.com/directory/resource/2"),
        new TestRequest("http://abc.com/directory/resource/3"),
        new TestRequest("http://abc.com/directory/resource/4")
    ];
    
    var promise = loader.request(requests);
    var count = 0;
    loader.on("progress", function (progress) {
        if (count === 0) {
            equal(progress, 0.25);
        } else if (count === 1) {
            equal(progress, 0.5);
        } else if (count === 2) {
            equal(progress, 0.75);
        } else if (count === 3) {
            equal(progress, 1);
            start();
        }
        count++;
    });

    stop();
});


test("Progress event with multiple batches", 4, function () {
    var loader = new pc.resources.ResourceLoader();
    
    var handler = new TestResourceHandler();
    loader.registerHandler(TestRequest, handler);
    
    var first = [
        new TestRequest("http://abc.com/directory/resource/1"),
        new TestRequest("http://abc.com/directory/resource/2"),
    ];
    
    var second = [
        new TestRequest("http://abc.com/directory/resource/3"),
        new TestRequest("http://abc.com/directory/resource/4")
    ];
    
    loader.request(first);
    loader.request(second);
    
    var count = 0;
    loader.on("progress", function (progress) {
        if (count === 0) {
            equal(progress, 0.25);
        } else if (count === 1) {
            equal(progress, 0.5);
        } else if (count === 2) {
            equal(progress, 0.75);
        } else if (count === 3) {
            equal(progress, 1);
            start();
        }
        count++;
    });

    stop();
});


test("resetProgress()", 4, function () {
    var loader = new pc.resources.ResourceLoader();
    
    var handler = new TestResourceHandler();
    loader.registerHandler(TestRequest, handler);
    
    var first = [
        new TestRequest("http://abc.com/directory/resource/1"),
        new TestRequest("http://abc.com/directory/resource/2"),
    ];
    
    var second = [
        new TestRequest("http://abc.com/directory/resource/3"),
        new TestRequest("http://abc.com/directory/resource/4")
    ];
    
    var p = loader.request(first);

    p.then(function (resources) {
        count = 0;
        loader.resetProgress();
        var p = loader.request(second);
        p.then(function (resources) {
            start();
        });
    })
    
    var count = 0;
    loader.on("progress", function (progress) {
        if (count === 0) {
            equal(progress, 0.5);
        } else if (count === 1) {
            equal(progress, 1);
        }
        count++;
    });

    stop();
});

test("Error while loading", 2, function () {
    var loader = new pc.resources.ResourceLoader();
    
    var handler = new ErrorResourceHandler();
    loader.registerHandler(TestRequest, new TestResourceHandler());
    loader.registerHandler(ErrorRequest, handler);
    
    var requests = [
        new TestRequest("http://abc.com/directory/resource/1"),
        new ErrorRequest("http://abc.com/directory/resource/2")
    ];
    
    var promise = loader.request(requests);

    promise.then(function (resources) {
        ok(false, "Request should error");
        start();
    }, function (error) {
        equal(error, "An error occured");
    });

    loader.on("error", function (request, error) {
        equal(request.canonical, "http://abc.com/directory/resource/2");
    });

    stop();
    setTimeout(start, 1000);
});

test("FillInRequest ", function () {
    var loader = new pc.resources.ResourceLoader();

    loader.registerHandler(FillInRequest, new FillInResourceHandler())

    var o = {
        value: null
    };

    var promise = loader.request(new FillInRequest("http://abc.com/directory/resources/1", null, o));

    promise.then(function (resources) {
        equal(resources[0].value, 'http://abc.com/directory/resources/1-opened')
        strictEqual(resources[0], o);
        start();
    });

    stop();
})

test("ClonedRequest returns clone", function () {
    var loader = new pc.resources.ResourceLoader();
    loader.registerHandler(ClonedRequest, new ClonedResourceHandler());
    loader.registerHash('123', "http://abc.com/directory/resource/1");

    var i, j;
    var res = [];
    loader.request(new ClonedRequest("http://abc.com/directory/resource/1")).then(function (resources) {
        res.push(resources[0]);
        loader.request(new ClonedRequest("http://abc.com/directory/resource/1")).then(function (resources) {
            res.push(resources[0]);
            for (i = 0; i < res.length; i++) {
                for (j = 0; j < res.length; j++) {
                    if (i === j) {
                        continue;
                    }
                    notStrictEqual(res[i], res[j]);
                }
            }
        });
        loader.request(new ClonedRequest("http://abc.com/directory/resource/1")).then(function (resources) {
            res.push(resources[0]);
            for (i = 0; i < res.length; i++) {
                for (j = 0; j < res.length; j++) {
                    if (i === j) {
                        continue;
                    }
                    notStrictEqual(res[i], res[j]);
                }
            }
        });
    })

    stop();
    setTimeout(start, 3000);
});

test("ClonedRequest simultaneous requests", function () {
    var loader = new pc.resources.ResourceLoader();
    loader.registerHandler(ClonedRequest, new ClonedResourceHandler());
    loader.registerHash('123', "http://abc.com/directory/resource/1");

    loader.request([
        new ClonedRequest("http://abc.com/directory/resource/1"),
        new ClonedRequest("http://abc.com/directory/resource/1")
    ]).then(function (resources) {
        notStrictEqual(resources[0], resources[1]);
        start();
    })

    stop();
});

test("request, load, progress events", function () {
    var loader = new pc.resources.ResourceLoader();
    loader.registerHandler(TestRequest, new TestResourceHandler());

    loader.on('request', function (request) {
        equal(request.id, 0);
        equal(request.identifier, 'http://abc.com/directory/resource/1');
    });
    loader.on('progress', function (value) {
        equal(value, 1);
    });
    loader.on('load', function (request, resource) {
        equal(request.id, 0);
        equal(request.identifier, 'http://abc.com/directory/resource/1');
        equal(resource, 'http://abc.com/directory/resource/1-opened');
        start();
    });

    loader.request([
        new TestRequest('http://abc.com/directory/resource/1')
    ]);

    stop();
});

test("request, load, progress events, simultaneous requests", function () {
    var loader = new pc.resources.ResourceLoader();
    loader.registerHandler(TestRequest, new TestResourceHandler());

    var request = 0;
    var progress = 0;
    var load = 0;

    loader.on('request', function (r) {
        request++;
    });
    loader.on('progress', function (value) {
        progress++;
    });
    loader.on('load', function (request, resource) {
        equal(request.identifier, 'http://abc.com/directory/resource/1');
        equal(resource, 'http://abc.com/directory/resource/1-opened');
    });

    loader.request([
        new TestRequest('http://abc.com/directory/resource/1'),
        new TestRequest('http://abc.com/directory/resource/1')
    ]);

    stop();
    setTimeout(function () {
        equal(request, 2);
        equal(progress, 2);
        start();
    }, 1000);
});


test("request, load, progress events, Child requests", function () {
    var loader = new pc.resources.ResourceLoader();
    loader.registerHandler(ChildRequest, new ChildResourceHandler(1));

    var request = 0;
    var progress = 0;
    var load = 0;

    loader.on('request', function (r) {
        request++;
    });
    loader.on('progress', function (value) {
        progress++;
    });
    loader.on('load', function (request, resource) {
        load++;
    });

    loader.request([
        new ChildRequest('1_0')
    ]);

    stop();
    setTimeout(function () {
        equal(request, 2);
        equal(progress, 2);
        equal(load, 2);
        start();
    }, 1000);
});

test("request, two identical children", function () {
    var loader = new pc.resources.ResourceLoader();
    loader.registerHandler(TestRequest, new TestResourceHandler());
    loader.registerHandler(DualChildRequest, new DualChildResourceHandler());

    loader.request([
        new DualChildRequest('parent')
    ]).then(function (responses) {
        equal(responses[0].responses[0], 'delay-abc-opened');
        equal(responses[0].responses[1], 'delay-abc-opened');
        start();
    });

    stop();
});

test("request, same url, different request type", function () {
    var loader = new pc.resources.ResourceLoader();
    loader.registerHandler(TestRequest, new TestResourceHandler());
    loader.registerHandler(FillInRequest, new FillInResourceHandler());
    loader.registerHash('abcdef', 'abcdef');

    var o = new FillInResult();
    o.value = null;

    loader.request([
        new TestRequest("abcdef")
    ]).then(function (resources) {
        // Load a different resource, but with the same identifier.
        // Loader should recognize this as a different type and ignore the cached value
        return loader.request([new FillInRequest("abcdef", null, o)]);
    }).then(function (resources) {
        // Expecting new 
        equal(resources[0].value, "abcdef-opened");
        start();
    });

    stop();
})

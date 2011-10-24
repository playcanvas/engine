module("pc.resources.ModelResourceHandler", {
	setup: function (){
		_http = pc.net.http;
	}, 
	
	teardown: function () {
		pc.net.http = _http;
		
		delete _http;
	}
});

test("create", function () {
	var manager = {};
	var mrh = new pc.resources.ModelResourceHandler(manager);
	
	ok(mrh);
	equal(mrh._manager, manager);
});


asyncTest("load: success", 3, function () {
	jack(function () {
		var resourceUrl = "http://abc.com/resource/file.json";
		var loader = {};
		var mrh = new pc.resources.ModelResourceHandler(loader);		
	
		pc.net = {};
		pc.net.http = jack.create('pc.net.http', ['get']);
		jack.expect('pc.net.http.get')
			.exactly('1 time')
			.mock(function (url, success) {
				equal(url, resourceUrl)
				success({mock: true});
			})
		
		mrh.open = function (data) {
			equal(data.mock, true)
			return {model:true};
		}
	
		mrh.load(resourceUrl, function (resource, options) {
			equal(resource.mock, true);
			equal(options.directory, "http://abc.com/resource");
            start();
		});
		
	});
});

asyncTest("open", 1, function () {
	jack(function () {
		var resourceUrl = "http://abc.com/directory/resource";
		var directory = "http://abc.com/directory";
		var data = {data:"abc"};
		
		var handler = new pc.resources.ModelResourceHandler({});
		handler._loadModel = function () {return {model: true}};
		
		var model = handler.open(data, function (model) {
            equal(model.model, true);       
	        start();	    
		}, null, null, {directory:directory});

	});	
});

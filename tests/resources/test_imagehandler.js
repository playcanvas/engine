module("pc.resources.ImageResourceHandler", {
	setup: function () {
		_Image = Image;
	}, 
	teardown: function () {
		Image = Image;
		delete _Image;
	}
});

test("create", function () {
	var loader = {};
	var handler = new pc.resources.ImageResourceHandler(loader);
	
	ok(handler);
});

test("load: success", 1, function () {
	jack(function () {
		var resourceUrl = "http://abc.com/resource";
		var loader = {};
		var handler = new pc.resources.ImageResourceHandler();		
		
		var spy = {mock:true};
		Image = function () { return spy; };
		
	
		handler.load(resourceUrl, function (resource) {
			equal(resource.mock, true);
		});
		
		spy.onload();
	});
});

test("open", 1, function () {
	
	jack(function () {
		var data = {data:"abc"};
			
		var handler = new pc.resources.ImageResourceHandler();
		var image = handler.open(data);
		
		equal(image.data, "abc");		
	});	
});

module('pc.resources.AssetHandler');

test('new AssetHandler', function () {
    var handler = new pc.resources.AssetResourceHandler();

    ok(handler);    
});

asyncTest('AssetHandler: request from pc.content.data', 2, function () {
	start();
	jack(function () {
		pc.content.data = {
			"A123": {
	            _id: "ABC",
	            resource_id: "A123",
	            file: {
	            	url: "file/1",
	            	asset: "A123",
	            	storage: "test",
	            	hash: "",
	            	size: ""
	            },
	            subasset_files: [{
	            	url: "file/2",
	            	asset: "A123",
	            	storage: "test",
	            	hash: "",
	            	size: ""
	            }, {
	            	url: "file/3",
	            	asset: "A123",
	            	storage: "test",
	            	hash: "",
	            	size: ""
	            }]
	        },
		};
		
		var handler = new pc.resources.AssetResourceHandler();
		var loader = new pc.resources.ResourceLoader();
		loader.registerHandler(pc.resources.AssetRequest, handler);
		
		loader.request([new pc.resources.AssetRequest('A123')], 1, function (resources) {
			var asset = resources['A123']; 
			ok(asset)
			equal(asset.getFileUrl(), "/api/file/1");
			stop();
		}, function (errors) {
			stop();
		}, function (progress) {
			stop();			
		});
	});
});

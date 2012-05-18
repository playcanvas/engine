module('pc.resources.ResourceRequest');


test('new ResourceRequest', function () {
	var request = new pc.resources.ResourceRequest();
	
	ok(request);
	equal(request.constructor.name, "ResourceRequest");
});

test('derived ResourceRequest', function () {
	var DerivedRequest = function DerivedRequest() {
		
	};
	DerivedRequest = pc.inherits(DerivedRequest, pc.resources.ResourceRequest);
	
	var request = new DerivedRequest();
	
	ok(request);
	equal(request.constructor.name, "DerivedRequest");
});

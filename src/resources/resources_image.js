pc.extend(pc.resources, function () {
	var ImageResourceHandler = function () {
	};
	ImageResourceHandler = pc.inherits(ImageResourceHandler, pc.resources.ResourceHandler);
	
    ImageResourceHandler.prototype.load = function (request, options) {
        var self = this;
        
        var promise = new RSVP.Promise(function (resolve, reject) {
            var image = new Image();
            // Call success callback after opening Image
            image.onload = function () {
                resolve(image);
            };

            // Call error callback with details.
            image.onerror = function (event) {
                var element = event.srcElement;
                reject(pc.string.format("Error loading Image from: '{0}'", element.src));
            };
            image.src = request.canonical;

        });

        return promise;
    };

    ImageResourceHandler.prototype.open = function (data, request, options) {
        return data;
    };
	
	var ImageRequest = function ImageRequest(identifier) {
	};
	ImageRequest = pc.inherits(ImageRequest, pc.resources.ResourceRequest);
	ImageRequest.prototype.type = "image";
	
	return {
		ImageResourceHandler: ImageResourceHandler,
		ImageRequest: ImageRequest
	};
}());
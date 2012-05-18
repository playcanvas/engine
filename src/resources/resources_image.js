pc.extend(pc.resources, function () {
	var ImageResourceHandler = function () {
	};
	ImageResourceHandler = pc.inherits(ImageResourceHandler, pc.resources.ResourceHandler);
	
    ImageResourceHandler.prototype.load = function (identifier, success, error, progress, options) {
        var image = new Image();
        var self = this;
	
		// Call success callback after opening Image
        image.onload = function () {
        	success(image);
        }

        // Call error callback with details.
        image.onerror = function (event) {
        	var element = event.srcElement;
        	error(pc.string.format("Error loading Image from: '{0}'", element.src));
        }
        image.src = identifier;
    };

    ImageResourceHandler.prototype.open = function (data, options) {
    	return data;
    };
	
	var ImageRequest = function ImageRequest(identifier) {
		
	};
	ImageRequest = pc.inherits(ImageRequest, pc.resources.ResourceRequest);
	ImageRequest.prototype.type = "image";
	
	return {
		ImageResourceHandler: ImageResourceHandler,
		ImageRequest: ImageRequest
	}	
}());

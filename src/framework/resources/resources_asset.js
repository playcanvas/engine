pc.extend(pc.resources, function () {
	var AssetResourceHandler = function (depot) {
		this._depot = depot;
	};
	AssetResourceHandler = pc.inherits(AssetResourceHandler, pc.resources.ResourceHandler);
	
	AssetResourceHandler.prototype.load = function (identifier, success, error, progress, options) {
		var guid = identifier;

		if(guid in pc.content.data) {
            setTimeout( function () {
                success(pc.content.data[guid], options);
            }, 0);
        } else {
            this._depot.assets.getOne(guid, function (asset) {
	            success(asset, options);
            }.bind(this));
        }		
	};
	
	AssetResourceHandler.prototype.open = function (data, options) {
	    var prefix = "";
        if (this._depot) {
            prefix = this._depot.assets.getServer().getBaseUrl();
        }
        return new pc.fw.Asset(prefix, data);
	};
	
	var AssetRequest = function AssetRequest(identifier) {
		
	};
	AssetRequest = pc.inherits(AssetRequest, pc.resources.ResourceRequest);
	AssetRequest.prototype.type = "asset";
	
	return {
		AssetRequest: AssetRequest,
		AssetResourceHandler: AssetResourceHandler
	};
}());

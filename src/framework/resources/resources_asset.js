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

        var asset = new pc.fw.Asset(prefix, data);

        this.registerAssetHashes(asset);

        return asset;
	};
	
    /**
    * @name pc.resources.AssetResourceHandler#registerAssetHashes
    * @description Add a file look up between file hash and file url into the resource loader. This can be uses to get resources from the case later
    */
    AssetResourceHandler.prototype.registerAssetHashes = function (asset) {
        this._loader.registerHash(asset.file.hash, asset.getFileUrl());

        var i, len = asset.subasset_files.length;
        for (i = 0; i < len; i++) {
            this._loader.registerHash(asset.subasset_files[i].hash, asset.getSubAssetFileUrl(i));
        }
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

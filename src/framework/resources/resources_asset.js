pc.extend(pc.resources, function () {
    /**
    * @name pc.resources.AssetResourceHandler
    * @extends pc.resources.ResourceHandler
    * @class `pc.resources.ResourceHandler for loading Assets from Database or exported data file
    * The AssetResourceHandler registers file hashes for loaded assets so local file caching works. 
    * `pc.fw.Application` has an AssetResourceHandler already registered to it's `ResourceLoader` so you won't need to.
    * However, if you are using a custom Application, this should be registered with a `pc.resources.ResourceLoader` 
    * in your main application.
    * @param depot A `DepotApi` from the corazon.js interface.
    * @example
    * var loader = new pc.resources.ResourceLoader();
    * loader.registerHandler(pc.resources.AssetRequest, new pc.resources.AssetResourceHandler(depot));
    */
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
    * @private
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

    /**
    * @name pc.resources.AssetRequest
    * @description Used to make a request for an Asset from the server or data file
    * @extends pc.resources.ResourceRequest
    * @example
    *   ... 
    *   var guid = "00000000-0000-0000-0000-000000000000";
    *   context.loader.request(guid, context, function (resources) {
    *       var asset = resources[guid];
    *   });
    */
	var AssetRequest = function AssetRequest(identifier) {
		
	};
	AssetRequest = pc.inherits(AssetRequest, pc.resources.ResourceRequest);
	AssetRequest.prototype.type = "asset";
	
	return {
		AssetRequest: AssetRequest,
		AssetResourceHandler: AssetResourceHandler
	};
}());

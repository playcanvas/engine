pc.extend(pc.asset, function () {
    /*
    * @name pc.asset.AssetRegistry
    * @class Container for all assets that are available to this application
    * @constructor Create an instance of an AssetRegistry. 
    * Note: PlayCanvas scripts are provided with an AssetRegistry instance as 'context.assets'.
    * @param {pc.resources.ResourceLoader} loader The ResourceLoader used to to load the asset files.
    * @param {String} prefix The prefix added to file urls before the loader tries to fetch them
    */
    var AssetRegistry = function (loader, prefix) {
        if (!loader) {
            throw new Error("Must provide a ResourceLoader instance for AssetRegistry");
        }

        this.loader = loader;
        this._prefix = prefix || "";

        this._cache = {};
        this._names = {};
    };

    AssetRegistry.prototype = {
        update: function (toc) {
            for (var resourceId in toc.assets) {
                var asset = this.getAssetByResourceId(resourceId);

                if (!asset) {
                    // Create assets for every entry in TOC and add to AssetCache
                    var assetData = toc.assets[resourceId];
                    asset = new pc.asset.Asset(resourceId, assetData.name, assetData.type, assetData.file, assetData.data, this._prefix);
                    this.addAsset(resourceId, asset);

                    // Register hashes with the resource loader
                    if (asset.file) {
                        this.loader.registerHash(asset.file.hash, asset.getFileUrl());
                    }
                } else {
                    // Update asset data
                    pc.extend(asset, toc.assets[resourceId]);
                }

            }
        },

        all: function () {
            return Object.keys(this._cache).map(function (resourceId) {
                return this.getAssetByResourceId(resourceId);
            }, this);
        },

        addAsset: function (resourceId, asset) {
            this._cache[resourceId] = asset;
            this._names[asset.name] = resourceId; // note, this overwrites any previous asset with same name
        },

        getAsset: function (name) {
            return this.getAssetByName(name);
        },

        getAssetByResourceId: function (resourceId) {
            return this._cache[resourceId];
        },

        getAssetByName: function (name) {
            var id = this._names[name];
            if (id && this._cache[id]) {
                return this._cache[id];
            } else {
                return null;
            }
        },

        load: function (assets, results, options) {
            if (!assets.length) {
                assets = [assets];
            }
            
            if (typeof(options) === 'undefined') {
                // shift arguments
                options = results;
                results = [];
            }

            var requests = []

            assets.forEach(function (asset, index) {
                var existing = this.getAsset(asset.resourceId);
                if (!existing) {
                    // If the asset isn't in the registry then add it.
                    this.addAsset(asset.resourceId, asset);
                }

                switch(asset.type) {
                    case pc.asset.ASSET_TYPE_MODEL:
                        requests.push(this._createModelRequest(asset));
                        break;
                    case pc.asset.ASSET_TYPE_TEXTURE:
                        requests.push(this._createTextureRequest(asset, results[index]));
                        break;
                    default: {
                        var request = this._createAssetRequest(asset);
                        if (request) {
                            requests.push(request);
                        }
                        break;
                    }
                }

            }, this);

            // request all assets
            return this.loader.request(requests, options).then(null, function (error) {
                // Ensure exceptions while loading are thrown and not swallowed by promises
                setTimeout(function () {
                    throw error;
                }, 0)
            });
        },

        _createAssetRequest: function (asset, result) {
            var url = asset.getFileUrl();
            if (url) {
                return this.loader.createFileRequest(url, asset.type);
            } else {
                return null;
            }
            
        },

        _createModelRequest: function (asset) {
            var url = asset.getFileUrl();
            var mapping = (asset.data && asset.data.mapping) ? asset.data.mapping : [];

            return new pc.resources.ModelRequest(url, mapping);
        },

        _createTextureRequest: function (asset, texture) {
            return new pc.resources.TextureRequest(asset.getFileUrl(), null, texture);
        }
    };

    return {
        AssetRegistry: AssetRegistry
    };
}())
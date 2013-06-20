pc.extend(pc.fw, function () {
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
                var asset = this.getAsset(resourceId);

                if (!asset) {
                    // Create assets for every entry in TOC and add to AssetCache
                    asset = new pc.fw.Asset(resourceId, toc.assets[resourceId], this._prefix);
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
                return this.getAsset(resourceId);
            }, this);
        },

        addAsset: function (resourceId, asset) {
            this._cache[resourceId] = asset;
            this._names[asset.name] = resourceId;
        },

        getAsset: function (resourceId) {
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
                switch(asset.type) {
                    case pc.fw.ASSET_TYPE_MODEL:
                        requests.push(this._createModelRequest(asset));
                        break;
                    case pc.fw.ASSET_TYPE_TEXTURE:
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
pc.extend(pc.fw, function () {
    var AssetCache = function (prefix) {
        this._cache = {};
        this._names = {};
        this._prefix = prefix || "";
    };

    AssetCache.prototype = {
        update: function (toc, loader) {
            for (var resourceId in toc.assets) {
                var asset = this.getAsset(resourceId);

                if (!asset) {
                    // Create assets for every entry in TOC and add to AssetCache
                    asset = new pc.fw.Asset(resourceId, toc.assets[resourceId], this._prefix);
                    this.addAsset(resourceId, asset);

                    // Register hashes with the resource loader
                    if (loader && asset.file) {
                        loader.registerHash(asset.file.hash, asset.getFileUrl());
                        asset.subfiles.forEach(function (file, i) {
                            loader.registerHash(file.hash, asset.getSubAssetFileUrl(i));
                        });
                    }
                } else {
                    // Update asset data
                    pc.extend(asset, toc.assets[resourceId]);
                }

            }
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
        }
    };

    return {
        AssetCache: AssetCache
    };
}());
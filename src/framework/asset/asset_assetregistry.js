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
        },

        load: function (asset, options) {
            switch(asset.type) {
                case 'model':
                    return this.loadModel(asset, options);
                case 'texture':
                    return this.loadTexture(asset, options);
            }
        },

        loadModel: function (asset, options) {
            var url = asset.getFileUrl();
            var mapping = asset.data;

            var request = new pc.resources.ModelRequest(url, asset.data);
            return this.loader.request(request, options);
        },

        loadTexture: function (asset, texture, options) {
            var url = asset.getFileUrl();

            var request = new pc.resources.TextureRequest(url, null, texture);
            return this.loader.request(request, options);
        }
    };

    return {
        AssetRegistry: AssetRegistry
    };
}())
pc.extend(pc.fw, function () {
    var AssetCache = function () {
        this._cache = {};
        this._names = {};
    };

    AssetCache.prototype = {
        addAsset: function (identifier, asset) {
            this._cache[identifier] = asset;
            this._names[asset.name] = identifier;
        },

        getAsset: function (identifier) {
            return this._cache[identifier];
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
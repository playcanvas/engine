pc.extend(pc, function () {
    /**
    * @name pc.asset.AssetRegistry
    * @class Container for all assets that are available to this application
    * @constructor Create an instance of an AssetRegistry.
    * Note: PlayCanvas scripts are provided with an AssetRegistry instance as 'app.assets'.
    * @param {pc.ResourceLoader} loader The ResourceLoader used to to load the asset files.
    */
    var AssetRegistry = function (loader) {
        this._loader = loader;

        this._assets = []; // list of all assets
        this._cache = {}; // index for looking up assets by id
        this._names = {}; // index for looking up assets by name
        this._urls = {}; // index for looking up assets by url

        pc.extend(this, pc.events);
    };

    AssetRegistry.prototype = {
        list: function (filters) {
            filters = filters || {};
            return this._assets.filter(function (asset) {
                var include = true;
                if (filters.preload !== undefined) {
                    include = (asset.preload === filters.preload);
                }
                return include;
            });
        },

        add: function(asset) {
            var index = this._assets.push(asset) - 1;
            this._cache[asset.id] = index;
            if (!this._names[asset.name]) {
                this._names[asset.name] = [];
            }
            this._names[asset.name].push(index);
            if (asset.file) {
                this._urls[asset.getFileUrl()] = index;
                asset.on('change', this._onAssetChanged, this);
            }

            this.fire("add", asset);
            this.fire("add:" + asset.id, asset);
        },

        remove: function (asset) {
            delete this._cache[asset.id];
            delete this._names[asset.name];
            if (asset.file) {
                asset.off('change', this._onAssetChanged, this);
                delete this._urls[asset.file.url];
            }

            this.fire("remove", asset);
            this.fire("remove:" + asset.id, asset);
        },

        clear: function (asset) {

        },

        get: function (id) {
            var idx = this._cache[id];
            return this._assets[idx];
        },

        getByUrl: function (url) {
            var idx = this._urls[url];
            return this._assets[idx];
        },

        load: function (asset) {
            var self = this;

            var load = !!(asset.file);
            var open = !load;

            // check for special case for cubemaps
            if (asset.file && asset.type === "cubemap") {
                load = false;
                open = false;
                // loading prefiltered cubemap data
                this._loader.load(asset.file.url, "texture", function (err, texture) {
                    if (!err) {
                        // store in asset data
                        asset.data.dds = texture;
                        _open();
                    } else {
                        self.fire("error", err, asset);
                        self.fire("error:" + asset.id, err, asset);
                        asset.fire("error", err, asset);
                        return;
                    }
                });
            }

            var _load = function () {
                self._loader.load(asset.file.url, asset.type, function (err, resource) {
                    if (err) {
                        self.fire("error", err, asset);
                        self.fire("error:" + asset.id, err, asset);
                        asset.fire("error", err, asset);
                        return;
                    }
                    if (resource instanceof Array) {
                        asset.resources = resource;
                    } else {
                        asset.resource = resource;
                    }
                    asset.loaded = true;

                    self._loader.patch(asset, self);

                    self.fire("load", asset);
                    self.fire("load:" + asset.id, asset);
                    asset.fire("load", asset);
                });
            };

            var _open = function () {
                var resource = self._loader.open(asset.type, asset.data);
                if (resource instanceof Array) {
                    asset.resources = resource;
                } else {
                    asset.resource = resource;
                }
                asset.loaded = true;

                self._loader.patch(asset, self);

                self.fire("load", asset);
                self.fire("load:" + asset.id, asset);
                asset.fire("load", asset);
            };

            if (!asset.file) {
                _open();
            } else if (load) {
                _load();
            }
        },

        loadFromUrl: function (url, type) {
        },

        /**
        * @function
        * @name pc.asset.AssetRegistry#findAll
        * @description Return all Assets with the specified name and type found in the registry
        * @param {String} name The name of the Assets to find
        * @param {String} [type] The type of the Assets to find
        * @returns {[pc.asset.Asset]} A list of all Assets found
        * @example
        * var assets = app.assets.findAll("myTextureAsset", pc.asset.ASSET_TEXTURE);
        * console.log("Found " + assets.length + " assets called " + name);
        */
        findAll: function (name, type) {
            var self = this;
            var idxs = this._names[name];
            var assets;
            if (idxs) {
                assets = idxs.map(function (idx) {
                    return self._assets[idx];
                });

                if (type) {
                    return assets.filter(function (asset) {
                        return (asset.type === type);
                    });
                } else {
                    return assets;
                }
            } else {
                return [];
            }
        },

        /**
        * @function
        * @name pc.asset.AssetRegistry#find
        * @description Return the first Asset with the specified name and type found in the registry
        * @param {String} name The name of the Asset to find
        * @param {String} [type] The type of the Asset to find
        * @returns {pc.asset.Asset} A single Asset or null if no Asset is found
        * @example
        * var asset = app.assets.find("myTextureAsset", pc.asset.ASSET_TEXTURE);
        */
        find: function (name, type) {
            var asset = this.findAll(name, type);
            return asset ? asset[0] : null;
        },

        _onAssetChanged: function (asset, attribute, _new, _old) {

        },

        // backwards compatibility
        getAssetById: function (id) {
            console.warn("DEPRECATED: getAssetById");
            return this.get(id);
        }

    };

    return {
        AssetRegistry: AssetRegistry
    }
}());

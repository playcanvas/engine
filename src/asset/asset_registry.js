pc.extend(pc, function () {
    /**
    * @name pc.AssetRegistry
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
        /**
        * @function
        * @name pc.AssetRegistry#list
        * @description Create a filtered list of assets from the registry
        * @param {Object} filters Properties to filter on, currently supports: 'preload: true|false'
        **/
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

        /**
        * @function
        * @name pc.AssetRegistry#add
        * @description Add an asset to the registry
        * @param {pc.Asset} asset The asset to add
        * @example
        * var asset = new pc.Asset("My Asset", "texture", {url: "../path/to/image.jpg"});
        * app.assets.add(asset);
        **/
        add: function(asset) {
            var index = this._assets.push(asset) - 1;
            var url;
            this._cache[asset.id] = index;
            if (!this._names[asset.name]) {
                this._names[asset.name] = [];
            }
            this._names[asset.name].push(index);
            if (asset.file) {
                url = asset.getFileUrl();
                this._urls[url] = index;
            }

            this.fire("add", asset);
            this.fire("add:" + asset.id, asset);
            if (url) {
                this.fire("add:url:" + url, asset);
            }
        },

        /**
        * @function
        * @name pc.AssetRegistry#remove
        * @description Remove an asset from the registry
        * @param {pc.Asset} asset The asset to remove
        * @example
        * var asset = app.assets.get(100);
        * app.assets.remove(asset);
        **/
        remove: function (asset) {
            delete this._cache[asset.id];
            delete this._names[asset.name];
            var url = asset.getFileUrl();
            if (url) {
                delete this._urls[url];
            }

            asset.fire("remove", asset);
            this.fire("remove", asset);
            this.fire("remove:" + asset.id, asset);
            if (url) {
                this.fire("remove:url:" + url, asset);
            }
        },

        /**
        * @function
        * @name pc.AssetRegistry#get
        * @description Retrieve an asset from the registry by its id field
        * @param {int} id the id of the asset to get
        * @example
        * var asset = app.assets.get(100);
        **/
        get: function (id) {
            var idx = this._cache[id];
            return this._assets[idx];
        },

        /**
        * @function
        * @name pc.AssetRegistry#getByUrl
        * @description Retrieve an asset from the registry by it's file's URL field
        * @param {string} url The url of the asset to get
        * @example
        * var asset = app.assets.getByUrl("../path/to/image.jpg");
        **/
        getByUrl: function (url) {
            var idx = this._urls[url];
            return this._assets[idx];
        },

        _compatibleLoad: function (assets) {
            var self = this;
            console.warn("DEPRECATED: Loading arrays of assets is deprecated. Call assets.load with single assets.");
            var promise = new pc.promise.Promise(function (resolve, reject) {
                var count = assets.length;
                assets.forEach(function (a, index) {
                    a.ready(function (asset) {
                        count--;
                        if (count === 0) {
                            var resources = assets.map(function (asset) {
                                return asset.resource;
                            });
                            resolve(resources);
                        }
                    });
                    self.load(a);
                });
            });

            return promise;
        },

        /**
        * @function
        * @name pc.AssetRegistry#load
        * @description Load the asset's file from a remote source. Listen for "load" events on the asset to find out when it is loaded
        * @param {pc.Asset} asset The asset to load
        * @example
        * // load some assets
        * var toload = [app.assets.find("My Asset"), app.assets.find("Another Asset")]
        * var count = 0;
        * for (var i = 0; i < toload.length; i++) {
        *     var asset = toload[i];
        *     asset.ready(function (asset) {
        *         count++;
        *         if (count === toload.length) {
        *             // done
        *         }
        *     });
        *     app.assets.load(asset)
        * }
        **/
        load: function (asset) {
            if (asset instanceof Array) {
                return this._compatibleLoad(asset);
            }

            var self = this;

            // do nothing if asset is already loaded
            // note: lots of code calls assets.load() assuming this check is present
            // don't remove it without updating calls to assets.load() with checks for the asset.loaded state
            if (asset.loaded) {
                return;
            }

            var load = !!(asset.file);
            var open = !load;

            // check for special case for cubemaps
            if (asset.file && asset.type === "cubemap") {
                load = false;
                open = false;
                // loading prefiltered cubemap data
                this._loader.load(asset.file.url, "texture", function (err, texture) {
                    if (!err) {
                        // Fudging an asset so that we can apply texture settings from the cubemap to the DDS texture
                        self._loader.patch({
                            resource: texture,
                            type: "texture",
                            data: asset.data
                        }, self);

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
                var url = asset.file.url;

                // add file hash as timestamp to avoid
                // image caching
                if (asset.type === 'texture') {
                    url += '?t=' + asset.file.hash;
                }

                self._loader.load(url, asset.type, function (err, resource) {
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

        /**
        * @function
        * @name pc.AssetRegistry#loadFromUrl
        * @description Use this to load and create an asset if you don't have assets created. Usually you would only use this
        * if you are not integrated with the PlayCanvas Editor
        * @param {String} url The url to load
        * @param {String} type The type of asset to load
        * @param {Function} callback Function called when asset is loaded, passed (err, asset), where err is null if no errors were encountered
        * @example
        * app.assets.loadFromUrl("../path/to/texture.jpg", "texture", function (err, asset) {
        *     var texture = asset.resource;
        * });
        */
        loadFromUrl: function (url, type, callback) {
            var self = this;

            var name = pc.path.getBasename(url);

            var file = {
                url: url
            };
            var data = {};

            var asset = self.getByUrl(url);
            if (!asset) {
                asset = new pc.Asset(name, type, file, data);
            }
            self.add(asset);

            if (type === 'model') {
                self._loadModel(asset, callback);
                return;
            }

            asset.once("load", function (asset) {
                callback(null, asset);
            });
            asset.once("error", function (err) {
                callback(err);
            });
            self.load(asset);
        },

        // private method used for engine-only loading of model data
        _loadModel: function (asset, callback) {
            var self = this;

            var url = asset.getFileUrl();
            var dir = pc.path.getDirectory(url);
            var basename = pc.path.getBasename(url);
            var name = basename.replace(".json", "");

            var mappingUrl = pc.path.join(dir, basename.replace(".json", ".mapping.json"));

            this._loader.load(mappingUrl, 'json', function (err, data) {
                if (err) {
                    callback(err);
                    return;
                }

                self._loadMaterials(dir, data, function (err, materials) {
                    asset.data = data;

                    asset.once("load", function (asset) {
                        callback(null, asset);
                    });
                    asset.once("error", function (err) {
                        callback(err);
                    });
                    self.load(asset);
                });
            });
        },

        // private method used for engine-only loading of model data
        _loadMaterials: function (dir, mapping, callback) {
            var self = this;
            var i;
            var count = mapping.mapping.length;
            var materials = [];
            for(i = 0; i < mapping.mapping.length; i++) {
                var path = mapping.mapping[i].path;
                if (path) {
                    self.loadFromUrl(pc.path.join(dir, path), "material", function (err, asset) {
                        materials.push(asset);
                        count--;
                        if (count === 0) {
                            done(null, materials);
                        }
                    });
                }
            }

            var done = function (err, materials) {
                self._loadTextures(materials, function (err, textures) {
                    callback(null, materials);
                });
            };
        },

        // private method used for engine-only loading of model data
        _loadTextures: function (materials, callback) {
            var self = this;
            var i, j;
            var urls = [];
            var textures = [];
            var count = 0;
            for (i = 0; i < materials.length; i++) {
                var params = materials[i].data.parameters
                for (j = 0; j < params.length; j++) {
                    if (params[j].type === "texture") {
                        var dir = pc.path.getDirectory(materials[i].getFileUrl());
                        var url = pc.path.join(dir, params[j].data);
                        urls.push(url);
                        count++;
                    }
                }
            }

            for (i = 0; i < urls.length; i++) {
                self.loadFromUrl(urls[i], "texture", function (err, texture) {
                    textures.push(texture);
                    count--;
                    if (count === 0) {
                        callback(null, textures);
                    }
                });
            }

        },

        /**
        * @function
        * @name pc.AssetRegistry#findAll
        * @description Return all Assets with the specified name and type found in the registry
        * @param {String} name The name of the Assets to find
        * @param {String} [type] The type of the Assets to find
        * @returns {[pc.Asset]} A list of all Assets found
        * @example
        * var assets = app.assets.findAll("myTextureAsset", "texture");
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
        * @name pc.AssetRegistry#find
        * @description Return the first Asset with the specified name and type found in the registry
        * @param {String} name The name of the Asset to find
        * @param {String} [type] The type of the Asset to find
        * @returns {pc.Asset} A single Asset or null if no Asset is found
        * @example
        * var asset = app.assets.find("myTextureAsset", "texture");
        */
        find: function (name, type) {
            var asset = this.findAll(name, type);
            return asset ? asset[0] : null;
        },

        // backwards compatibility
        getAssetById: function (id) {
            console.warn("DEPRECATED: getAssetById() use get() instead");
            return this.get(id);
        }

    };

    return {
        AssetRegistry: AssetRegistry
    };
}());

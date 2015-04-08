pc.extend(pc.asset, function () {
    /**
    * @name pc.asset.AssetRegistry
    * @class Container for all assets that are available to this application
    * @constructor Create an instance of an AssetRegistry.
    * Note: PlayCanvas scripts are provided with an AssetRegistry instance as 'app.assets'.
    * @param {pc.resources.ResourceLoader} loader The ResourceLoader used to to load the asset files.
    */
    var AssetRegistry = function (loader) {
        if (!loader) {
            throw new Error("Must provide a ResourceLoader instance for AssetRegistry");
        }

        this.loader = loader;

        this._cache = {}; // main asset cache, keyed by id
        this._names = {}; // index for looking up assets by name
        this._urls = {}; // index for looking up assets by url

        this._groups = {};
    };

    AssetRegistry.prototype = {
        /**
        * @private
        * @function
        * @name pc.asset.AssetRegistry#addGroup
        * @description Take a set of asset data (usually from the content file (data.js) or the API)
        * and create pc.asset.Asset instance for each entry. Group these Assets by name so they can be
        * loaded in a batch later.
        * @param {String} name The name of the group to store Assets under
        * @param {Object} toc The data source for getting the asset data. Should be an object keyed on asset resource ids.
        */
        addGroup: function (name, toc) {
            if (!this._groups[name]) {
                this._groups[name] = [];
            }

            for (var id in toc.assets) {
                var asset = this.getAssetById(id);

                if (!asset) {
                    // Create assets for every entry in TOC and add to AssetRegistry
                    var assetData = toc.assets[id];
                    asset = this.createAndAddAsset(id, assetData);
                } else {
                    // Update asset data
                    pc.extend(asset, toc.assets[id]);
                }

                this._groups[name].push(asset.id);
            }
        },

        /**
        * @private
        */
        createAndAddAsset: function (id, assetData) {
            var asset = new pc.asset.Asset(assetData.name, assetData.type, assetData.file, assetData.data);
            asset.id = parseInt(id);

            this.addAsset(asset);

            if (asset.file) {
                this.loader.registerHash(asset.file.hash, asset.getFileUrl());
            }

            return asset;
        },

        /**
        * @private
        * @deprecated
        * @function
        * @name pc.asset.AssetRegistry#all
        * @description Return a list of all assets in the registry
        * @returns [pc.asset.Asset] List of all assets in the registry
        */
        all: function () {
            return Object.keys(this._cache).map(function (id) {
                return this.getAssetById(id);
            }, this);
        },

        /**
        * @function
        * @name pc.asset.AssetRegisty#list
        * @description Generate a list of all assets in a group (or all assets if no group name is supplied)
        * @param {String} groupName The name of the group to get the asset list from
        * @returns [pc.asset.Asset] List of all assets in the group
        */
        list: function (groupName) {
            if (groupName) {
                // return assets from the group
                if (this._groups[groupName]) {
                    return this._groups[groupName].map(function (id) {
                        return this.getAssetById(id);
                    }, this);
                }
            } else {
                // Return all assets
                return Object.keys(this._cache).map(function (id) {
                    return this.getAssetById(id);
                }, this);
            }
        },

        /**
        * @function
        * @name pc.asset.AssetRegistry#addAsset
        * @description Add a new asset to the registry
        * @param {pc.asset.Asset} asset The asset to add to the registry
        */
        addAsset: function (asset) {
            this._cache[asset.id] = asset;
            if (!this._names[asset.name]) {
                this._names[asset.name] = [];
            }
            this._names[asset.name].push(asset.id);
            if (asset.file) {
                this._urls[asset.getFileUrl()] = asset.id;
            }

            if (asset.type !== 'cubemap')
                asset.on('change', this._onAssetChanged, this);
        },

        /**
        * @function
        * @name pc.asset.AssetRegistry#removeAsset
        * @description Removes an asset from the registry
        * @param {pc.asset.Asset} asset The asset to remove
        */
        removeAsset: function (asset) {
            delete this._cache[asset.id];
            delete this._names[asset.name];
            asset.fire('remove', asset);
            if (asset.file) {
                delete this._urls[asset.file.url];
            }

            if (asset.type !== 'cubemap')
                asset.off('change', this._onAssetChanged, this);
        },

        /**
        * @private
        * @function
        * @name pc.asset.AssetRegistry#_onAssetChanged
        * @description Takes care of reloading an asset file if it has changed
        */
        _onAssetChanged: function (asset, attribute, newValue, oldValue) {
            var url;
            if (attribute === 'file') {
                if (oldValue) {
                    // get old asset url
                    url = oldValue.url;

                    // remove old url connections
                    delete this._urls[url];
                    this.loader.removeFromCache(url);
                    this.loader.unregisterHash(url);
                }

                if (newValue) {
                    // get new asset url
                    url = asset.getFileUrl();

                    // register new url
                    this._urls[url] = asset.id;
                    this.loader.registerHash(newValue.hash, url);

                    // reload asset resource
                    var oldResource = asset.resource;
                    this.load([asset]).then(function (resources) {
                        asset.fire('change', asset, 'resource', resources[0], oldResource);
                    });
                }
            }
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
            var ids = this._names[name];
            var assets;
            if (ids) {
                assets = ids.map(function (id) {
                    return self._cache[id];
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

        getAssetByResourceId: function (id) {
            console.warn("WARNING: getAssetByResourceId: Function is deprecated. Use getAssetById() instead.");
            return this._cache[id];
        },

        /**
        * @function
        * @name pc.asset.AssetRegistry#getAssetById
        * @description Return the {@link pc.asset.Asset} object in the AssetRegistry with the id provided
        * @param {Number} id The id of the Asset to return
        * @returns {pc.asset.Asset} The Asset or null if no Asset is found.
        */
        getAssetById: function (id) {
            return this._cache[id];
        },

        getAssetByUrl: function (url) {
            var id = this._urls[url];
            return this._cache[id];
        },

        /**
        * @private
        */
        getAssetByName: function (name) {
            console.warn("WARNING: getAssetByName: Function is deprecated. Use find() or findAll() instead.");
            return this.find(name);
        },

        /**
        * @function
        * @name pc.asset.AssetRegistry#load
        * @description Load the resources for a set of assets and return a promise the resources that they load.
        * If the asset type doesn't have file (e.g. Material Asset) then a resource is not returned (the resource list is shorter)
        * NOTE: Usually you won't have to call load() directly as Assets will be loaded as part of the Pack loading process. This is only
        * required if you are loading assets manually without using the PlayCanvas tools.
        * @param {[pc.Asset]} assets The list of assets to load
        * @param {[Object]} [results] List of results for the resources to be stored in. This is usually not required
        * @param {Object} [options] Options to pass on to the loader
        * @returns {Promise} A Promise to the resources
        * @example
        * var asset = new pc.asset.Asset("My Texture", "texture", {
        *   url: "/example/mytexture.jpg"
        * });
        */
        load: function (assets, results, options) {
            if (assets && pc.type(assets) !== 'array') {
                assets = [assets];
            }

            if (options === undefined) {
                // shift arguments
                options = results;
                results = [];
            }

            var requests = [];
            assets.forEach(function (asset, index) {
                var existing = this.getAssetById(asset.id);
                if (!existing) {
                    // If the asset isn't in the registry then add it.
                    this.addAsset(asset);
                }

                switch(asset.type) {
                    case pc.asset.ASSET_MODEL:
                        requests.push(this._createModelRequest(asset));
                        break;
                    case pc.asset.ASSET_TEXTURE:
                        requests.push(this._createTextureRequest(asset, results[index]));
                        break;
                    case pc.asset.ASSET_CUBEMAP:
                        requests.push(this._createCubemapRequest(asset, results[index]));
                        break;
                    case pc.asset.ASSET_MATERIAL:
                        requests.push(this._createMaterialRequest(asset));
                        break;
                    default: {
                        requests.push(this._createAssetRequest(asset));
                        break;
                    }
                }
            }, this);

            // request all assets, then attach loaded resources onto asset
            return this.loader.request(requests.filter(function (r) { return r !== null; }), options).then(function (resources) {
                var promise = new pc.promise.Promise(function (resolve, reject) {
                    var index = 0;
                    requests.forEach(function (r, i) {
                        if (r) {
                            assets[i].resources = resources[index++];
                        }
                    });
                    resolve(resources);
                });
                return promise;
            }, function (error) {
                // Ensure exceptions while loading are thrown and not swallowed by promises
                setTimeout(function () {
                    throw error;
                }, 0)
            });
        },

        /**
        * @function
        * @name pc.asset.AssetRegistry#loadFromUrl
        * @description Load the resources for an asset by its URL and return a promise that will be resolved
        * when the asset is loaded.
        * @param  {String} url  The URL of the asset
        * @param  {String} type The type of the asset
        * @return {Promise} A Promise to the resources
        * @example
        * var url = "../assets/statue/Statue_1.json";
        *    application.assets.loadFromUrl(url, "model").then(function (results) {
        *    var model = results.resource;
        *    var asset = results.asset;
        *
        *    entity = new pc.Entity();
        *     application.systems.model.addComponent(entity, {
        *        type: "asset",
        *        asset: asset
        *    });
        *    application.root.addChild(entity);
        * });
        */
        loadFromUrl: function (url, type) {
            if (!type) {
                throw Error("type required")
            }

            if (type === "model") {
                return this._loadModel(url);
            }

            var dir = pc.path.getDirectory(url);
            var basename = pc.path.getBasename(url);
            var name = basename.replace(".json", "");

            var asset = new pc.asset.Asset(name, type, {
                url: url
            });

            var promise = new pc.promise.Promise(function (resolve, reject) {
                this.load(asset).then(function (resource) {
                    resolve({
                        resource: resource,
                        asset: asset
                    });
                });
            }.bind(this));

            return promise;
        },


        _loadModel: function (url) {
            var self = this;

            var dir = pc.path.getDirectory(url);
            var basename = pc.path.getBasename(url);

            var name = basename.replace(".json", "");
            var mappingUrl = pc.path.join(dir, basename.replace(".json", ".mapping.json"));

            // Create Model Asset
            var modelAsset = new pc.asset.Asset(name, "model", {
                url: url
            });

            // Create Mapping Asset
            var mappingAsset = new pc.asset.Asset(name + ".mapping", "json", {
                url: mappingUrl
            });

            var promise = new pc.promise.Promise(function (resolve, reject) {
                // Load Model and Mapping
                self.load([modelAsset, mappingAsset]).then(function (resources) {
                    var model = resources[0];
                    var mapping = resources[1];

                    modelAsset.data = mapping; // Update model asset with mapping data

                    var materialAssets = [];
                    mapping.mapping.forEach(function (map) {
                        materialAssets.push(new pc.asset.Asset(pc.path.getBasename(map.path), "material", {
                            url: pc.path.join(dir, map.path)
                        }));
                    });

                    if (materialAssets.length) {
                        var promise = self.load(materialAssets)

                        promise.then(function (materials) {
                            for(var i = 0, n = model.meshInstances.length; i < n; i++) {
                                model.meshInstances[i].material = materials[i];
                            }
                            resolve({
                                resource: model,
                                asset: modelAsset
                            });
                        });

                        return promise;
                    } else {
                        resolve({
                            resource: model,
                            asset: modelAsset
                        });
                    }

                });
            });

            return promise;
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
            var mapping = (asset.data && asset.data.mapping) ? asset.data.mapping: [];

            return new pc.resources.ModelRequest(url, mapping);
        },

        _createTextureRequest: function (asset, texture) {
            return new pc.resources.TextureRequest(asset.getFileUrl(), null, texture);
        },

        _createCubemapRequest: function (asset, texture) {
            var url = asset.getFileUrl();
            if (!url || !pc.string.endsWith(url.toLowerCase(), '.json')) {
                url = "asset://" + asset.id;
            }

            return new pc.resources.CubemapRequest(url, null, texture);
        },

        _createMaterialRequest: function (asset) {
            var url = asset.getFileUrl();
            if (url) {
                return new pc.resources.MaterialRequest(url);
            } else {
                return new pc.resources.MaterialRequest("asset://" + asset.id);
            }

        }
    };

    return {
        AssetRegistry: AssetRegistry
    };
}())

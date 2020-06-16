import { path } from '../core/path.js';
import { EventHandler } from '../core/event-handler.js';
import { TagsCache } from '../core/tags.js';

import { StandardMaterial } from '../scene/materials/standard-material.js';

import { script } from '../framework/script.js';

import { Asset } from './asset.js';

/**
 * @class
 * @name pc.AssetRegistry
 * @augments pc.EventHandler
 * @classdesc Container for all assets that are available to this application.
 * @description Create an instance of an AssetRegistry.
 * Note: PlayCanvas scripts are provided with an AssetRegistry instance as 'app.assets'.
 * @param {pc.ResourceLoader} loader - The ResourceLoader used to load the asset files.
 * @property {string} prefix A URL prefix that will be added to all asset loading requests.
 */
function AssetRegistry(loader) {
    EventHandler.call(this);

    this._loader = loader;

    this._assets = []; // list of all assets
    this._cache = {}; // index for looking up assets by id
    this._names = {}; // index for looking up assets by name
    this._tags = new TagsCache('_id'); // index for looking up by tags
    this._urls = {}; // index for looking up assets by url

    this.prefix = null;
}
AssetRegistry.prototype = Object.create(EventHandler.prototype);
AssetRegistry.prototype.constructor = AssetRegistry;

/**
 * @event
 * @name pc.AssetRegistry#load
 * @description Fired when an asset completes loading.
 * @param {pc.Asset} asset - The asset that has just loaded.
 * @example
 * app.assets.on("load", function (asset) {
 *     console.log("asset loaded: " + asset.name);
 * });
 */

/**
 * @event
 * @name pc.AssetRegistry#load:[id]
 * @description Fired when an asset completes loading.
 * @param {pc.Asset} asset - The asset that has just loaded.
 * @example
 * var id = 123456;
 * var asset = app.assets.get(id);
 * app.assets.on("load:" + id, function (asset) {
 *     console.log("asset loaded: " + asset.name);
 * });
 * app.assets.load(asset);
 */

/**
 * @event
 * @name pc.AssetRegistry#load:url:[url]
 * @description Fired when an asset completes loading.
 * @param {pc.Asset} asset - The asset that has just loaded.
 * @example
 * var id = 123456;
 * var asset = app.assets.get(id);
 * app.assets.on("load:url:" + asset.file.url, function (asset) {
 *     console.log("asset loaded: " + asset.name);
 * });
 * app.assets.load(asset);
 */

/**
 * @event
 * @name pc.AssetRegistry#add
 * @description Fired when an asset is added to the registry.
 * @param {pc.Asset} asset - The asset that was added.
 * @example
 * app.assets.on("add", function (asset) {
 *     console.log("New asset added: " + asset.name);
 * });
 */

/**
 * @event
 * @name pc.AssetRegistry#add:[id]
 * @description Fired when an asset is added to the registry.
 * @param {pc.Asset} asset - The asset that was added.
 * @example
 * var id = 123456;
 * app.assets.on("add:" + id, function (asset) {
 *     console.log("Asset 123456 loaded");
 * });
 */

/**
 * @event
 * @name pc.AssetRegistry#add:url:[url]
 * @description Fired when an asset is added to the registry.
 * @param {pc.Asset} asset - The asset that was added.
 */

/**
 * @event
 * @name pc.AssetRegistry#remove
 * @description Fired when an asset is removed from the registry.
 * @param {pc.Asset} asset - The asset that was removed.
 * @example
 * app.assets.on("remove", function (aseet) {
 *     console.log("Asset removed: " + asset.name);
 * });
 */

/**
 * @event
 * @name pc.AssetRegistry#remove:[id]
 * @description Fired when an asset is removed from the registry.
 * @param {pc.Asset} asset - The asset that was removed.
 * @example
 * var id = 123456;
 * app.assets.on("remove:" + id, function (asset) {
 *     console.log("Asset removed: " + asset.name);
 * });
 */

/**
 * @event
 * @name pc.AssetRegistry#remove:url:[url]
 * @description Fired when an asset is removed from the registry.
 * @param {pc.Asset} asset - The asset that was removed.
 */

/**
 * @event
 * @name pc.AssetRegistry#error
 * @description Fired when an error occurs during asset loading.
 * @param {string} err - The error message.
 * @param {pc.Asset} asset - The asset that generated the error.
 * @example
 * var id = 123456;
 * var asset = app.assets.get(id);
 * app.assets.on("error", function (err, asset) {
 *     console.error(err);
 * });
 * app.assets.load(asset);
 */

/**
 * @event
 * @name pc.AssetRegistry#error:[id]
 * @description Fired when an error occurs during asset loading.
 * @param {pc.Asset} asset - The asset that generated the error.
 * @example
 * var id = 123456;
 * var asset = app.assets.get(id);
 * app.assets.on("error:" + id, function (err, asset) {
 *     console.error(err);
 * });
 * app.assets.load(asset);
 */

Object.assign(AssetRegistry.prototype, {
    /**
     * @function
     * @name pc.AssetRegistry#list
     * @description Create a filtered list of assets from the registry.
     * @param {object} filters - Properties to filter on, currently supports: 'preload: true|false'.
     * @returns {pc.Asset[]} The filtered list of assets.
     */
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
     * @description Add an asset to the registry.
     * @param {pc.Asset} asset - The asset to add.
     * @example
     * var asset = new pc.Asset("My Asset", "texture", {
     *     url: "../path/to/image.jpg"
     * });
     * app.assets.add(asset);
     */
    add: function (asset) {
        var index = this._assets.push(asset) - 1;
        var url;

        // id cache
        this._cache[asset.id] = index;
        if (!this._names[asset.name])
            this._names[asset.name] = [];

        // name cache
        this._names[asset.name].push(index);
        if (asset.file) {
            url = asset.file.url;
            this._urls[url] = index;
        }
        asset.registry = this;

        // tags cache
        this._tags.addItem(asset);
        asset.tags.on('add', this._onTagAdd, this);
        asset.tags.on('remove', this._onTagRemove, this);

        this.fire("add", asset);
        this.fire("add:" + asset.id, asset);
        if (url)
            this.fire("add:url:" + url, asset);

        if (asset.preload)
            this.load(asset);
    },

    /**
     * @function
     * @name pc.AssetRegistry#remove
     * @description Remove an asset from the registry.
     * @param {pc.Asset} asset - The asset to remove.
     * @returns {boolean} True if the asset was successfully removed and false otherwise.
     * @example
     * var asset = app.assets.get(100);
     * app.assets.remove(asset);
     */
    remove: function (asset) {
        var idx = this._cache[asset.id];
        var url = asset.file ? asset.file.url : null;

        if (idx !== undefined) {
            // remove from list
            this._assets.splice(idx, 1);

            // remove id -> index cache
            delete this._cache[asset.id];

            // name cache needs to be completely rebuilt
            this._names = {};

            // urls cache needs to be completely rebuilt
            this._urls = [];

            // update id cache and rebuild name cache
            for (var i = 0, l = this._assets.length; i < l; i++) {
                var a = this._assets[i];

                this._cache[a.id] = i;
                if (!this._names[a.name]) {
                    this._names[a.name] = [];
                }
                this._names[a.name].push(i);

                if (a.file) {
                    this._urls[a.file.url] = i;
                }
            }

            // tags cache
            this._tags.removeItem(asset);
            asset.tags.off('add', this._onTagAdd, this);
            asset.tags.off('remove', this._onTagRemove, this);

            asset.fire("remove", asset);
            this.fire("remove", asset);
            this.fire("remove:" + asset.id, asset);
            if (url)
                this.fire("remove:url:" + url, asset);

            return true;
        }

        // asset not in registry
        return false;
    },

    /**
     * @function
     * @name pc.AssetRegistry#get
     * @description Retrieve an asset from the registry by its id field.
     * @param {number} id - The id of the asset to get.
     * @returns {pc.Asset} The asset.
     * @example
     * var asset = app.assets.get(100);
     */
    get: function (id) {
        var idx = this._cache[id];
        return this._assets[idx];
    },

    /**
     * @function
     * @name pc.AssetRegistry#getByUrl
     * @description Retrieve an asset from the registry by it's file's URL field.
     * @param {string} url - The url of the asset to get.
     * @returns {pc.Asset} The asset.
     * @example
     * var asset = app.assets.getByUrl("../path/to/image.jpg");
     */
    getByUrl: function (url) {
        var idx = this._urls[url];
        return this._assets[idx];
    },

    /**
     * @function
     * @name pc.AssetRegistry#load
     * @description Load the asset's file from a remote source. Listen for "load" events on the asset to find out when it is loaded.
     * @param {pc.Asset} asset - The asset to load.
     * @example
     * // load some assets
     * var assetsToLoad = [
     *     app.assets.find("My Asset"),
     *     app.assets.find("Another Asset")
     * ];
     * var count = 0;
     * assetsToLoad.forEach(function (assetToLoad) {
     *     assetToLoad.ready(function (asset) {
     *         count++;
     *         if (count === assetsToLoad.length) {
     *             // done
     *         }
     *     });
     *     app.assets.load(assetToLoad);
     * });
     */
    load: function (asset) {
        if (asset.loading)
            return;

        var self = this;

        // do nothing if asset is already loaded
        // note: lots of code calls assets.load() assuming this check is present
        // don't remove it without updating calls to assets.load() with checks for the asset.loaded state
        if (asset.loaded) {
            if (asset.type === 'cubemap')
                self._loader.patch(asset, this);
            return;
        }

        var file = asset.getPreferredFile();
        var load = !!file;

        // open has completed on the resource
        var _opened = function (resource) {
            if (resource instanceof Array) {
                asset.resources = resource;
            } else {
                asset.resource = resource;
            }

            self._loader.patch(asset, self);

            self.fire("load", asset);
            self.fire("load:" + asset.id, asset);
            if (file && file.url)
                self.fire("load:url:" + file.url, asset);
            asset.fire("load", asset);
        };

        var _load = function () {
            var url = asset.getFileUrl();

            asset.loading = true;

            self._loader.load(url, asset.type, function (err, resource, extra) {
                asset.loaded = true;
                asset.loading = false;

                if (err) {
                    self.fire("error", err, asset);
                    self.fire("error:" + asset.id, err, asset);
                    asset.fire("error", err, asset);
                    return;
                }

                if (!script.legacy && asset.type === 'script') {
                    var loader = self._loader.getHandler('script');

                    if (loader._cache[asset.id] && loader._cache[asset.id].parentNode === document.head) {
                        // remove old element
                        document.head.removeChild(loader._cache[asset.id]);
                    }

                    loader._cache[asset.id] = extra;
                }

                _opened(resource);
            }, asset);
        };

        var _open = function () {
            var resource = self._loader.open(asset.type, asset.data);
            asset.loaded = true;
            _opened(resource);
        };

        // check for special case for cubemaps
        if (file && asset.type === "cubemap") {
            load = false;
            // loading prefiltered cubemap data
            var url = asset.getFileUrl();

            this._loader.load(url, "texture", function (err, texture) {
                if (!err) {
                    // Fudging an asset so that we can apply texture settings from the cubemap to the DDS texture
                    self._loader.patch({
                        resource: texture,
                        type: "texture",
                        data: asset.data
                    }, self);

                    // store in asset data
                    asset._dds = texture;
                    _open();
                } else {
                    self.fire("error", err, asset);
                    self.fire("error:" + asset.id, err, asset);
                    asset.fire("error", err, asset);
                }
            });
        }

        if (!file) {
            _open();
        } else if (load) {
            this.fire("load:start", asset);
            this.fire("load:" + asset.id + ":start", asset);
            _load();
        }
    },

    /**
     * @function
     * @name pc.AssetRegistry#loadFromUrl
     * @description Use this to load and create an asset if you don't have assets created. Usually you would only use this
     * if you are not integrated with the PlayCanvas Editor.
     * @param {string} url - The url to load.
     * @param {string} type - The type of asset to load.
     * @param {pc.callbacks.LoadAsset} callback - Function called when asset is loaded, passed (err, asset), where err is null if no errors were encountered.
     * @example
     * app.assets.loadFromUrl("../path/to/texture.jpg", "texture", function (err, asset) {
     *     var texture = asset.resource;
     * });
     */
    loadFromUrl: function (url, type, callback) {
        this.loadFromUrlAndFilename(url, null, type, callback);
    },

    /**
     * @function
     * @name pc.AssetRegistry#loadFromUrlAndFilename
     * @description Use this to load and create an asset when both the URL and filename are required. For example, use this function when loading
     * BLOB assets, where the URL does not adequately identify the file.
     * @param {string} url - The url to load.
     * @param {string} filename - The filename of the asset to load.
     * @param {string} type - The type of asset to load.
     * @param {pc.callbacks.LoadAsset} callback - Function called when asset is loaded, passed (err, asset), where err is null if no errors were encountered.
     * @example
     * var file = magicallyAttainAFile();
     * app.assets.loadFromUrlAndFilename(URL.createObjectURL(file), "texture.png", "texture", function (err, asset) {
     *     var texture = asset.resource;
     * });
     */
    loadFromUrlAndFilename: function (url, filename, type, callback) {
        var self = this;

        var name = path.getBasename(filename || url);

        var file = {
            filename: filename || name,
            url: url
        };

        var asset = self.getByUrl(url);
        if (!asset) {
            asset = new Asset(name, type, file);
            self.add(asset);
        }

        var startLoad = function (asset) {
            asset.once("load", function (loadedAsset) {
                callback(null, loadedAsset);
            });
            asset.once("error", function (err) {
                callback(err);
            });
            self.load(asset);
        };

        if (asset.resource) {
            callback(null, asset);
        } else if (type === 'model') {
            self._loadModel(asset, startLoad);
        } else {
            startLoad(asset);
        }
    },

    // private method used for engine-only loading of model data
    _loadModel: function (modelAsset, continuation) {
        var self = this;

        var url = modelAsset.getFileUrl();
        var ext = path.getExtension(url);

        if (ext === '.json' || ext === '.glb') {
            var dir = path.getDirectory(url);
            var basename = path.getBasename(url);

            // playcanvas model format supports material mapping file
            var mappingUrl = path.join(dir, basename.replace(ext, ".mapping.json"));
            this._loader.load(mappingUrl, 'json', function (err, data) {
                if (err) {
                    modelAsset.data = { mapping: [] };
                    continuation(modelAsset);
                } else {
                    self._loadMaterials(modelAsset, data, function (e, materials) {
                        modelAsset.data = data;
                        continuation(modelAsset);
                    });
                }
            });
        } else {
            // other model format (e.g. obj)
            continuation(modelAsset);
        }
    },

    // private method used for engine-only loading of model materials
    _loadMaterials: function (modelAsset, mapping, callback) {
        var self = this;
        var materials = [];
        var count = 0;

        var onMaterialLoaded = function (err, materialAsset) {
            // load dependent textures
            self._loadTextures(materialAsset, function (err, textures) {
                materials.push(materialAsset);
                if (materials.length === count) {
                    callback(null, materials);
                }
            });
        };

        for (var i = 0; i < mapping.mapping.length; i++) {
            var path = mapping.mapping[i].path;
            if (path) {
                count++;
                self.loadFromUrl(modelAsset.getAbsoluteUrl(path), "material", onMaterialLoaded);
            }
        }

        if (count === 0) {
            callback(null, materials);
        }
    },

    // private method used for engine-only loading of the textures referenced by
    // the material asset
    _loadTextures: function (materialAsset, callback) {
        var self = this;
        var textures = [];
        var count = 0;

        var data = materialAsset.data;
        if (data.mappingFormat !== 'path') {
            // #ifdef DEBUG
            console.warn('Skipping: ' + materialAsset.name + ', material files must be mappingFormat: "path" to be loaded from URL');
            // #endif
            callback(null, textures);
            return;
        }

        var onTextureLoaded = function (err, texture) {
            if (err) console.error(err);
            textures.push(texture);
            if (textures.length === count) {
                callback(null, textures);
            }
        };

        var texParams = StandardMaterial.TEXTURE_PARAMETERS;
        for (var i = 0; i < texParams.length; i++) {
            var path = data[texParams[i]];
            if (path && typeof(path) === 'string') {
                count++;
                self.loadFromUrl(materialAsset.getAbsoluteUrl(path), "texture", onTextureLoaded);
            }
        }

        if (count === 0) {
            callback(null, textures);
        }
    },

    /**
     * @function
     * @name pc.AssetRegistry#findAll
     * @description Return all Assets with the specified name and type found in the registry.
     * @param {string} name - The name of the Assets to find.
     * @param {string} [type] - The type of the Assets to find.
     * @returns {pc.Asset[]} A list of all Assets found.
     * @example
     * var assets = app.assets.findAll("myTextureAsset", "texture");
     * console.log("Found " + assets.length + " assets called " + name);
     */
    findAll: function (name, type) {
        var self = this;
        var idxs = this._names[name];
        if (idxs) {
            var assets = idxs.map(function (idx) {
                return self._assets[idx];
            });

            if (type) {
                return assets.filter(function (asset) {
                    return (asset.type === type);
                });
            }

            return assets;
        }

        return [];
    },

    _onTagAdd: function (tag, asset) {
        this._tags.add(tag, asset);
    },

    _onTagRemove: function (tag, asset) {
        this._tags.remove(tag, asset);
    },

    /**
     * @function
     * @name pc.AssetRegistry#findByTag
     * @description Return all Assets that satisfy the search query.
     * Query can be simply a string, or comma separated strings,
     * to have inclusive results of assets that match at least one query.
     * A query that consists of an array of tags can be used to match assets that have each tag of array.
     * @param {...*} query - Name of a tag or array of tags.
     * @returns {pc.Asset[]} A list of all Assets matched query.
     * @example
     * var assets = app.assets.findByTag("level-1");
     * // returns all assets that tagged by `level-1`
     * @example
     * var assets = app.assets.findByTag("level-1", "level-2");
     * // returns all assets that tagged by `level-1` OR `level-2`
     * @example
     * var assets = app.assets.findByTag(["level-1", "monster"]);
     * // returns all assets that tagged by `level-1` AND `monster`
     * @example
     * var assets = app.assets.findByTag(["level-1", "monster"], ["level-2", "monster"]);
     * // returns all assets that tagged by (`level-1` AND `monster`) OR (`level-2` AND `monster`)
     */
    findByTag: function () {
        return this._tags.find(arguments);
    },

    /**
     * @function
     * @name pc.AssetRegistry#filter
     * @description Return all Assets that satisfy filter callback.
     * @param {pc.callbacks.FilterAsset} callback - The callback function that is used to filter assets, return `true` to include asset to result list.
     * @returns {pc.Asset[]} A list of all Assets found.
     * @example
     * var assets = app.assets.filter(function (asset) {
     *     return asset.name.indexOf('monster') !== -1;
     * });
     * console.log("Found " + assets.length + " assets, where names contains 'monster'");
     */
    filter: function (callback) {
        var items = [];
        for (var i = 0, len = this._assets.length; i < len; i++) {
            if (callback(this._assets[i]))
                items.push(this._assets[i]);
        }
        return items;
    },

    /**
     * @function
     * @name pc.AssetRegistry#find
     * @description Return the first Asset with the specified name and type found in the registry.
     * @param {string} name - The name of the Asset to find.
     * @param {string} [type] - The type of the Asset to find.
     * @returns {pc.Asset} A single Asset or null if no Asset is found.
     * @example
     * var asset = app.assets.find("myTextureAsset", "texture");
     */
    find: function (name, type) {
        var asset = this.findAll(name, type);
        return asset ? asset[0] : null;
    }
});

export { AssetRegistry };

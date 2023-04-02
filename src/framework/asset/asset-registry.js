import { path } from '../../core/path.js';
import { Debug } from '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { TagsCache } from '../../core/tags-cache.js';

import { standardMaterialTextureParameters } from '../../scene/materials/standard-material-parameters.js';

import { script } from '../script.js';

import { Asset } from './asset.js';

/**
 * Callback used by {@link AssetRegistry#filter} to filter assets.
 *
 * @callback FilterAssetCallback
 * @param {Asset} asset - The current asset to filter.
 * @returns {boolean} Return `true` to include asset to result list.
 */

/**
 * Callback used by {@link AssetRegistry#loadFromUrl} and called when an asset is loaded (or an
 * error occurs).
 *
 * @callback LoadAssetCallback
 * @param {string|null} err - The error message is null if no errors were encountered.
 * @param {Asset} [asset] - The loaded asset if no errors were encountered.
 */

/**
 * Container for all assets that are available to this application. Note that PlayCanvas scripts
 * are provided with an AssetRegistry instance as `app.assets`.
 *
 * @augments EventHandler
 */
class AssetRegistry extends EventHandler {
    /**
     * Create an instance of an AssetRegistry.
     *
     * @param {import('../handlers/loader.js').ResourceLoader} loader - The ResourceLoader used to
     * load the asset files.
     */
    constructor(loader) {
        super();

        this._loader = loader;

        this._assets = []; // list of all assets
        this._cache = {}; // index for looking up assets by id
        this._names = {}; // index for looking up assets by name
        this._tags = new TagsCache('_id'); // index for looking up by tags
        this._urls = {}; // index for looking up assets by url

        /**
         * A URL prefix that will be added to all asset loading requests.
         *
         * @type {string}
         */
        this.prefix = null;
    }

    /**
     * Fired when an asset completes loading.
     *
     * @event AssetRegistry#load
     * @param {Asset} asset - The asset that has just loaded.
     * @example
     * app.assets.on("load", function (asset) {
     *     console.log("asset loaded: " + asset.name);
     * });
     */

    /**
     * Fired when an asset completes loading.
     *
     * @event AssetRegistry#load:[id]
     * @param {Asset} asset - The asset that has just loaded.
     * @example
     * const id = 123456;
     * const asset = app.assets.get(id);
     * app.assets.on("load:" + id, function (asset) {
     *     console.log("asset loaded: " + asset.name);
     * });
     * app.assets.load(asset);
     */

    /**
     * Fired when an asset completes loading.
     *
     * @event AssetRegistry#load:url:[url]
     * @param {Asset} asset - The asset that has just loaded.
     * @example
     * const id = 123456;
     * const asset = app.assets.get(id);
     * app.assets.on("load:url:" + asset.file.url, function (asset) {
     *     console.log("asset loaded: " + asset.name);
     * });
     * app.assets.load(asset);
     */

    /**
     * Fired when an asset is added to the registry.
     *
     * @event AssetRegistry#add
     * @param {Asset} asset - The asset that was added.
     * @example
     * app.assets.on("add", function (asset) {
     *     console.log("New asset added: " + asset.name);
     * });
     */

    /**
     * Fired when an asset is added to the registry.
     *
     * @event AssetRegistry#add:[id]
     * @param {Asset} asset - The asset that was added.
     * @example
     * const id = 123456;
     * app.assets.on("add:" + id, function (asset) {
     *     console.log("Asset 123456 loaded");
     * });
     */

    /**
     * Fired when an asset is added to the registry.
     *
     * @event AssetRegistry#add:url:[url]
     * @param {Asset} asset - The asset that was added.
     */

    /**
     * Fired when an asset is removed from the registry.
     *
     * @event AssetRegistry#remove
     * @param {Asset} asset - The asset that was removed.
     * @example
     * app.assets.on("remove", function (asset) {
     *     console.log("Asset removed: " + asset.name);
     * });
     */

    /**
     * Fired when an asset is removed from the registry.
     *
     * @event AssetRegistry#remove:[id]
     * @param {Asset} asset - The asset that was removed.
     * @example
     * const id = 123456;
     * app.assets.on("remove:" + id, function (asset) {
     *     console.log("Asset removed: " + asset.name);
     * });
     */

    /**
     * Fired when an asset is removed from the registry.
     *
     * @event AssetRegistry#remove:url:[url]
     * @param {Asset} asset - The asset that was removed.
     */

    /**
     * Fired when an error occurs during asset loading.
     *
     * @event AssetRegistry#error
     * @param {string} err - The error message.
     * @param {Asset} asset - The asset that generated the error.
     * @example
     * const id = 123456;
     * const asset = app.assets.get(id);
     * app.assets.on("error", function (err, asset) {
     *     console.error(err);
     * });
     * app.assets.load(asset);
     */

    /**
     * Fired when an error occurs during asset loading.
     *
     * @event AssetRegistry#error:[id]
     * @param {Asset} asset - The asset that generated the error.
     * @example
     * const id = 123456;
     * const asset = app.assets.get(id);
     * app.assets.on("error:" + id, function (err, asset) {
     *     console.error(err);
     * });
     * app.assets.load(asset);
     */

    /**
     * Create a filtered list of assets from the registry.
     *
     * @param {object} filters - Properties to filter on, currently supports: 'preload: true|false'.
     * @returns {Asset[]} The filtered list of assets.
     */
    list(filters) {
        filters = filters || {};
        return this._assets.filter((asset) => {
            let include = true;
            if (filters.preload !== undefined) {
                include = (asset.preload === filters.preload);
            }
            return include;
        });
    }

    /**
     * Add an asset to the registry.
     *
     * @param {Asset} asset - The asset to add.
     * @example
     * const asset = new pc.Asset("My Asset", "texture", {
     *     url: "../path/to/image.jpg"
     * });
     * app.assets.add(asset);
     */
    add(asset) {
        const index = this._assets.push(asset) - 1;
        let url;

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

        this.fire('add', asset);
        this.fire('add:' + asset.id, asset);
        if (url)
            this.fire('add:url:' + url, asset);

        if (asset.preload)
            this.load(asset);
    }

    /**
     * Remove an asset from the registry.
     *
     * @param {Asset} asset - The asset to remove.
     * @returns {boolean} True if the asset was successfully removed and false otherwise.
     * @example
     * const asset = app.assets.get(100);
     * app.assets.remove(asset);
     */
    remove(asset) {
        const idx = this._cache[asset.id];
        const url = asset.file ? asset.file.url : null;

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
            for (let i = 0, l = this._assets.length; i < l; i++) {
                const a = this._assets[i];

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

            asset.fire('remove', asset);
            this.fire('remove', asset);
            this.fire('remove:' + asset.id, asset);
            if (url)
                this.fire('remove:url:' + url, asset);

            return true;
        }

        // asset not in registry
        return false;
    }

    /**
     * Retrieve an asset from the registry by its id field.
     *
     * @param {number} id - The id of the asset to get.
     * @returns {Asset} The asset.
     * @example
     * const asset = app.assets.get(100);
     */
    get(id) {
        const idx = this._cache[id];
        return this._assets[idx];
    }

    /**
     * Retrieve an asset from the registry by its file's URL field.
     *
     * @param {string} url - The url of the asset to get.
     * @returns {Asset} The asset.
     * @example
     * const asset = app.assets.getByUrl("../path/to/image.jpg");
     */
    getByUrl(url) {
        const idx = this._urls[url];
        return this._assets[idx];
    }

    /**
     * Load the asset's file from a remote source. Listen for "load" events on the asset to find
     * out when it is loaded.
     *
     * @param {Asset} asset - The asset to load.
     * @example
     * // load some assets
     * const assetsToLoad = [
     *     app.assets.find("My Asset"),
     *     app.assets.find("Another Asset")
     * ];
     * let count = 0;
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
    load(asset) {
        // do nothing if asset is already loaded
        // note: lots of code calls assets.load() assuming this check is present
        // don't remove it without updating calls to assets.load() with checks for the asset.loaded state
        if (asset.loading || asset.loaded) {
            return;
        }

        const file = asset.file;

        // open has completed on the resource
        const _opened = (resource) => {
            if (resource instanceof Array) {
                asset.resources = resource;
            } else {
                asset.resource = resource;
            }

            // let handler patch the resource
            this._loader.patch(asset, this);

            this.fire('load', asset);
            this.fire('load:' + asset.id, asset);
            if (file && file.url)
                this.fire('load:url:' + file.url, asset);
            asset.fire('load', asset);
        };

        // load has completed on the resource
        const _loaded = (err, resource, extra) => {
            asset.loaded = true;
            asset.loading = false;

            if (err) {
                this.fire('error', err, asset);
                this.fire('error:' + asset.id, err, asset);
                asset.fire('error', err, asset);
            } else {
                if (!script.legacy && asset.type === 'script') {
                    const handler = this._loader.getHandler('script');
                    if (handler._cache[asset.id] && handler._cache[asset.id].parentNode === document.head) {
                        // remove old element
                        document.head.removeChild(handler._cache[asset.id]);
                    }
                    handler._cache[asset.id] = extra;
                }

                _opened(resource);
            }
        };

        if (file || asset.type === 'cubemap') {
            // start loading the resource
            this.fire('load:start', asset);
            this.fire('load:' + asset.id + ':start', asset);

            asset.loading = true;
            this._loader.load(asset.getFileUrl(), asset.type, _loaded, asset);
        } else {
            // asset has no file to load, open it directly
            const resource = this._loader.open(asset.type, asset.data);
            asset.loaded = true;
            _opened(resource);
        }
    }

    /**
     * Use this to load and create an asset if you don't have assets created. Usually you would
     * only use this if you are not integrated with the PlayCanvas Editor.
     *
     * @param {string} url - The url to load.
     * @param {string} type - The type of asset to load.
     * @param {LoadAssetCallback} callback - Function called when asset is loaded, passed (err,
     * asset), where err is null if no errors were encountered.
     * @example
     * app.assets.loadFromUrl("../path/to/texture.jpg", "texture", function (err, asset) {
     *     const texture = asset.resource;
     * });
     */
    loadFromUrl(url, type, callback) {
        this.loadFromUrlAndFilename(url, null, type, callback);
    }

    /**
     * Use this to load and create an asset when both the URL and filename are required. For
     * example, use this function when loading BLOB assets, where the URL does not adequately
     * identify the file.
     *
     * @param {string} url - The url to load.
     * @param {string} filename - The filename of the asset to load.
     * @param {string} type - The type of asset to load.
     * @param {LoadAssetCallback} callback - Function called when asset is loaded, passed (err,
     * asset), where err is null if no errors were encountered.
     * @example
     * const file = magicallyAttainAFile();
     * app.assets.loadFromUrlAndFilename(URL.createObjectURL(file), "texture.png", "texture", function (err, asset) {
     *     const texture = asset.resource;
     * });
     */
    loadFromUrlAndFilename(url, filename, type, callback) {
        const name = path.getBasename(filename || url);

        const file = {
            filename: filename || name,
            url: url
        };

        let asset = this.getByUrl(url);
        if (!asset) {
            asset = new Asset(name, type, file);
            this.add(asset);
        } else if (asset.loaded) {
            // asset is already loaded
            callback(asset.loadFromUrlError || null, asset);
            return;
        }

        const startLoad = (asset) => {
            asset.once('load', (loadedAsset) => {
                if (type === 'material') {
                    this._loadTextures(loadedAsset, (err, textures) => {
                        callback(err, loadedAsset);
                    });
                } else {
                    callback(null, loadedAsset);
                }
            });
            asset.once('error', (err) => {
                // store the error on the asset in case user requests this asset again
                if (err) {
                    this.loadFromUrlError = err;
                }
                callback(err, asset);
            });
            this.load(asset);
        };

        if (asset.resource) {
            callback(null, asset);
        } else if (type === 'model') {
            this._loadModel(asset, startLoad);
        } else {
            startLoad(asset);
        }
    }

    // private method used for engine-only loading of model data
    _loadModel(modelAsset, continuation) {
        const url = modelAsset.getFileUrl();
        const ext = path.getExtension(url);

        if (ext === '.json' || ext === '.glb') {
            const dir = path.getDirectory(url);
            const basename = path.getBasename(url);

            // PlayCanvas model format supports material mapping file
            const mappingUrl = path.join(dir, basename.replace(ext, '.mapping.json'));
            this._loader.load(mappingUrl, 'json', (err, data) => {
                if (err) {
                    modelAsset.data = { mapping: [] };
                    continuation(modelAsset);
                } else {
                    this._loadMaterials(modelAsset, data, (e, materials) => {
                        modelAsset.data = data;
                        continuation(modelAsset);
                    });
                }
            });
        } else {
            // other model format (e.g. obj)
            continuation(modelAsset);
        }
    }

    // private method used for engine-only loading of model materials
    _loadMaterials(modelAsset, mapping, callback) {
        const materials = [];
        let count = 0;

        const onMaterialLoaded = (err, materialAsset) => {
            // load dependent textures
            this._loadTextures(materialAsset, (err, textures) => {
                materials.push(materialAsset);
                if (materials.length === count) {
                    callback(null, materials);
                }
            });
        };

        for (let i = 0; i < mapping.mapping.length; i++) {
            const path = mapping.mapping[i].path;
            if (path) {
                count++;
                const url = modelAsset.getAbsoluteUrl(path);
                this.loadFromUrl(url, 'material', onMaterialLoaded);
            }
        }

        if (count === 0) {
            callback(null, materials);
        }
    }

    // private method used for engine-only loading of the textures referenced by
    // the material asset
    _loadTextures(materialAsset, callback) {
        const textures = [];
        let count = 0;

        const data = materialAsset.data;
        if (data.mappingFormat !== 'path') {
            Debug.warn(`Skipping: ${materialAsset.name}, material files must be mappingFormat: "path" to be loaded from URL`);
            callback(null, textures);
            return;
        }

        const onTextureLoaded = (err, texture) => {
            if (err) console.error(err);
            textures.push(texture);
            if (textures.length === count) {
                callback(null, textures);
            }
        };

        const texParams = standardMaterialTextureParameters;
        for (let i = 0; i < texParams.length; i++) {
            const path = data[texParams[i]];
            if (path && typeof path === 'string') {
                count++;
                const url = materialAsset.getAbsoluteUrl(path);
                this.loadFromUrl(url, 'texture', onTextureLoaded);
            }
        }

        if (count === 0) {
            callback(null, textures);
        }
    }

    /**
     * Return all Assets with the specified name and type found in the registry.
     *
     * @param {string} name - The name of the Assets to find.
     * @param {string} [type] - The type of the Assets to find.
     * @returns {Asset[]} A list of all Assets found.
     * @example
     * const assets = app.assets.findAll("myTextureAsset", "texture");
     * console.log("Found " + assets.length + " assets called " + name);
     */
    findAll(name, type) {
        const idxs = this._names[name];
        if (idxs) {
            const assets = idxs.map((idx) => {
                return this._assets[idx];
            });

            if (type) {
                return assets.filter((asset) => {
                    return (asset.type === type);
                });
            }

            return assets;
        }

        return [];
    }

    _onTagAdd(tag, asset) {
        this._tags.add(tag, asset);
    }

    _onTagRemove(tag, asset) {
        this._tags.remove(tag, asset);
    }

    /**
     * Return all Assets that satisfy the search query. Query can be simply a string, or comma
     * separated strings, to have inclusive results of assets that match at least one query. A
     * query that consists of an array of tags can be used to match assets that have each tag of
     * array.
     *
     * @param {...*} query - Name of a tag or array of tags.
     * @returns {Asset[]} A list of all Assets matched query.
     * @example
     * const assets = app.assets.findByTag("level-1");
     * // returns all assets that tagged by `level-1`
     * @example
     * const assets = app.assets.findByTag("level-1", "level-2");
     * // returns all assets that tagged by `level-1` OR `level-2`
     * @example
     * const assets = app.assets.findByTag(["level-1", "monster"]);
     * // returns all assets that tagged by `level-1` AND `monster`
     * @example
     * const assets = app.assets.findByTag(["level-1", "monster"], ["level-2", "monster"]);
     * // returns all assets that tagged by (`level-1` AND `monster`) OR (`level-2` AND `monster`)
     */
    findByTag() {
        return this._tags.find(arguments);
    }

    /**
     * Return all Assets that satisfy a filter callback.
     *
     * @param {FilterAssetCallback} callback - The callback function that is used to filter assets.
     * Return `true` to include an asset in the returned array.
     * @returns {Asset[]} A list of all Assets found.
     * @example
     * const assets = app.assets.filter(function (asset) {
     *     return asset.name.indexOf('monster') !== -1;
     * });
     * console.log("Found " + assets.length + " assets, where names contains 'monster'");
     */
    filter(callback) {
        return this._assets.filter(asset => callback(asset));
    }

    /**
     * Return the first Asset with the specified name and type found in the registry.
     *
     * @param {string} name - The name of the Asset to find.
     * @param {string} [type] - The type of the Asset to find.
     * @returns {Asset|null} A single Asset or null if no Asset is found.
     * @example
     * const asset = app.assets.find("myTextureAsset", "texture");
     */
    find(name, type) {
        // findAll returns an empty array the if the asset cannot be found so `asset` is
        // never null/undefined
        const asset = this.findAll(name, type);
        return asset.length > 0 ? asset[0] : null;
    }
}

export { AssetRegistry };

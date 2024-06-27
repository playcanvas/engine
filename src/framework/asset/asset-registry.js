import { path } from '../../core/path.js';
import { Debug } from '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { TagsCache } from '../../core/tags-cache.js';

import { standardMaterialTextureParameters } from '../../scene/materials/standard-material-parameters.js';

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
 * Callback used by {@link ResourceLoader#load} and called when an asset is choosing a bundle
 * to load from. Return a single bundle to ensure asset is loaded from it.
 *
 * @callback BundlesFilterCallback
 * @param {import('../bundle/bundle.js').Bundle[]} bundles - List of bundles which contain the asset.
 */

/**
 * Container for all assets that are available to this application. Note that PlayCanvas scripts
 * are provided with an AssetRegistry instance as `app.assets`.
 *
 * @category Asset
 */
class AssetRegistry extends EventHandler {
    /**
     * Fired when an asset completes loading. This event is available in three forms. They are as
     * follows:
     *
     * 1. `load` - Fired when any asset finishes loading.
     * 2. `load:[id]` - Fired when a specific asset has finished loading, where `[id]` is the
     * unique id of the asset.
     * 3. `load:url:[url]` - Fired when an asset finishes loading whose URL matches `[url]`, where
     * `[url]` is the URL of the asset.
     *
     * @event
     * @example
     * app.assets.on('load', (asset) => {
     *     console.log(`Asset loaded: ${asset.name}`);
     * });
     * @example
     * const id = 123456;
     * const asset = app.assets.get(id);
     * app.assets.on('load:' + id, (asset) => {
     *     console.log(`Asset loaded: ${asset.name}`);
     * });
     * app.assets.load(asset);
     * @example
     * const id = 123456;
     * const asset = app.assets.get(id);
     * app.assets.on('load:url:' + asset.file.url, (asset) => {
     *     console.log(`Asset loaded: ${asset.name}`);
     * });
     * app.assets.load(asset);
     */
    static EVENT_LOAD = 'load';

    /**
     * Fired when an asset is added to the registry. This event is available in three forms. They
     * are as follows:
     *
     * 1. `add` - Fired when any asset is added to the registry.
     * 2. `add:[id]` - Fired when an asset is added to the registry, where `[id]` is the unique id
     * of the asset.
     * 3. `add:url:[url]` - Fired when an asset is added to the registry and matches the URL
     * `[url]`, where `[url]` is the URL of the asset.
     *
     * @event
     * @example
     * app.assets.on('add', (asset) => {
     *    console.log(`Asset added: ${asset.name}`);
     * });
     * @example
     * const id = 123456;
     * app.assets.on('add:' + id, (asset) => {
     *    console.log(`Asset added: ${asset.name}`);
     * });
     * @example
     * const id = 123456;
     * const asset = app.assets.get(id);
     * app.assets.on('add:url:' + asset.file.url, (asset) => {
     *    console.log(`Asset added: ${asset.name}`);
     * });
     */
    static EVENT_ADD = 'add';

    /**
     * Fired when an asset is removed from the registry. This event is available in three forms.
     * They are as follows:
     *
     * 1. `remove` - Fired when any asset is removed from the registry.
     * 2. `remove:[id]` - Fired when an asset is removed from the registry, where `[id]` is the
     * unique id of the asset.
     * 3. `remove:url:[url]` - Fired when an asset is removed from the registry and matches the
     * URL `[url]`, where `[url]` is the URL of the asset.
     *
     * @event
     * @param {Asset} asset - The asset that was removed.
     * @example
     * app.assets.on('remove', (asset) => {
     *    console.log(`Asset removed: ${asset.name}`);
     * });
     * @example
     * const id = 123456;
     * app.assets.on('remove:' + id, (asset) => {
     *    console.log(`Asset removed: ${asset.name}`);
     * });
     * @example
     * const id = 123456;
     * const asset = app.assets.get(id);
     * app.assets.on('remove:url:' + asset.file.url, (asset) => {
     *    console.log(`Asset removed: ${asset.name}`);
     * });
     */
    static EVENT_REMOVE = 'remove';

    /**
     * Fired when an error occurs during asset loading. This event is available in two forms. They
     * are as follows:
     *
     * 1. `error` - Fired when any asset reports an error in loading.
     * 2. `error:[id]` - Fired when an asset reports an error in loading, where `[id]` is the
     * unique id of the asset.
     *
     * @event
     * @example
     * const id = 123456;
     * const asset = app.assets.get(id);
     * app.assets.on('error', (err, asset) => {
     *     console.error(err);
     * });
     * app.assets.load(asset);
     * @example
     * const id = 123456;
     * const asset = app.assets.get(id);
     * app.assets.on('error:' + id, (err, asset) => {
     *     console.error(err);
     * });
     * app.assets.load(asset);
     */
    static EVENT_ERROR = 'error';

    /**
     * @type {Set<Asset>}
     * @private
     */
    _assets = new Set();

    /**
     * @type {Map<number, Asset>}
     * @private
     */
    _idToAsset = new Map();

    /**
     * @type {Map<string, Asset>}
     * @private
     */
    _urlToAsset = new Map();

    /**
     * @type {Map<string, Set<Asset>>}
     * @private
     */
    _nameToAsset = new Map();

    /**
     * Index for looking up by tags.
     *
     * @private
     */
    _tags = new TagsCache('_id');

    /**
     * A URL prefix that will be added to all asset loading requests.
     *
     * @type {string|null}
     */
    prefix = null;

    /**
     * BundleRegistry
     *
     * @type {import('../bundle/bundle-registry.js').BundleRegistry|null}
     */
    bundles = null;

    /**
     * Create an instance of an AssetRegistry.
     *
     * @param {import('../handlers/loader.js').ResourceLoader} loader - The ResourceLoader used to
     * load the asset files.
     */
    constructor(loader) {
        super();

        this._loader = loader;
    }

    /**
     * Create a filtered list of assets from the registry.
     *
     * @param {object} filters - Properties to filter on, currently supports: 'preload: true|false'.
     * @returns {Asset[]} The filtered list of assets.
     */
    list(filters = {}) {
        const assets = Array.from(this._assets);
        if (filters.preload !== undefined) {
            return assets.filter(asset => asset.preload === filters.preload);
        }
        return assets;
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
        if (this._assets.has(asset)) return;

        this._assets.add(asset);

        this._idToAsset.set(asset.id, asset);

        if (asset.file?.url) {
            this._urlToAsset.set(asset.file.url, asset);
        }

        if (!this._nameToAsset.has(asset.name))
            this._nameToAsset.set(asset.name, new Set());

        this._nameToAsset.get(asset.name).add(asset);

        asset.on('name', this._onNameChange, this);

        asset.registry = this;

        // tags cache
        this._tags.addItem(asset);
        asset.tags.on('add', this._onTagAdd, this);
        asset.tags.on('remove', this._onTagRemove, this);

        this.fire('add', asset);
        this.fire('add:' + asset.id, asset);
        if (asset.file?.url) {
            this.fire('add:url:' + asset.file.url, asset);
        }

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
        if (!this._assets.has(asset)) return false;

        this._assets.delete(asset);

        this._idToAsset.delete(asset.id);

        if (asset.file?.url) {
            this._urlToAsset.delete(asset.file.url);
        }

        asset.off('name', this._onNameChange, this);

        if (this._nameToAsset.has(asset.name)) {
            const items = this._nameToAsset.get(asset.name);
            items.delete(asset);
            if (items.size === 0) {
                this._nameToAsset.delete(asset.name);
            }
        }

        // tags cache
        this._tags.removeItem(asset);
        asset.tags.off('add', this._onTagAdd, this);
        asset.tags.off('remove', this._onTagRemove, this);

        asset.fire('remove', asset);
        this.fire('remove', asset);
        this.fire('remove:' + asset.id, asset);
        if (asset.file?.url) {
            this.fire('remove:url:' + asset.file.url, asset);
        }

        return true;
    }

    /**
     * Retrieve an asset from the registry by its id field.
     *
     * @param {number} id - The id of the asset to get.
     * @returns {Asset|undefined} The asset.
     * @example
     * const asset = app.assets.get(100);
     */
    get(id) {
        // Since some apps incorrectly pass the id as a string, force a conversion to a number
        return this._idToAsset.get(Number(id));
    }

    /**
     * Retrieve an asset from the registry by its file's URL field.
     *
     * @param {string} url - The url of the asset to get.
     * @returns {Asset|undefined} The asset.
     * @example
     * const asset = app.assets.getByUrl("../path/to/image.jpg");
     */
    getByUrl(url) {
        return this._urlToAsset.get(url);
    }

    /**
     * Load the asset's file from a remote source. Listen for "load" events on the asset to find
     * out when it is loaded.
     *
     * @param {Asset} asset - The asset to load.
     * @param {object} [options] - Options for asset loading.
     * @param {boolean} [options.bundlesIgnore] - If set to true, then asset will not try to load
     * from a bundle. Defaults to false.
     * @param {boolean} [options.force] - If set to true, then the check of asset being loaded or
     * is already loaded is bypassed, which forces loading of asset regardless.
     * @param {BundlesFilterCallback} [options.bundlesFilter] - A callback that will be called
     * when loading an asset that is contained in any of the bundles. It provides an array of
     * bundles and will ensure asset is loaded from bundle returned from a callback. By default
     * smallest filesize bundle is choosen.
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
    load(asset, options) {
        // do nothing if asset is already loaded
        // note: lots of code calls assets.load() assuming this check is present
        // don't remove it without updating calls to assets.load() with checks for the asset.loaded state
        if ((asset.loading || asset.loaded) && !options?.force) {
            return;
        }

        const file = asset.file;

        const _fireLoad = () => {
            this.fire('load', asset);
            this.fire('load:' + asset.id, asset);
            if (file && file.url)
                this.fire('load:url:' + file.url, asset);
            asset.fire('load', asset);
        };

        // open has completed on the resource
        const _opened = (resource) => {
            if (resource instanceof Array) {
                asset.resources = resource;
            } else {
                asset.resource = resource;
            }

            // let handler patch the resource
            this._loader.patch(asset, this);

            if (asset.type === 'bundle') {
                const assetIds = asset.data.assets;
                for (let i = 0; i < assetIds.length; i++) {
                    const assetInBundle = this._idToAsset.get(assetIds[i]);
                    if (assetInBundle && !assetInBundle.loaded) {
                        this.load(assetInBundle, { force: true });
                    }
                }

                if (asset.resource.loaded) {
                    _fireLoad();
                } else {
                    this.fire('load:start', asset);
                    this.fire('load:start:' + asset.id, asset);
                    if (file && file.url)
                        this.fire('load:start:url:' + file.url, asset);
                    asset.fire('load:start', asset);
                    asset.resource.on('load', _fireLoad);
                }
            } else {
                _fireLoad();
            }
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
                if (asset.type === 'script') {
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

            const fileUrl = asset.getFileUrl();

            // mark bundle assets as loading
            if (asset.type === 'bundle') {
                const assetIds = asset.data.assets;
                for (let i = 0; i < assetIds.length; i++) {
                    const assetInBundle = this._idToAsset.get(assetIds[i]);
                    if (!assetInBundle)
                        continue;

                    if (assetInBundle.loaded || assetInBundle.resource || assetInBundle.loading)
                        continue;

                    assetInBundle.loading = true;
                }
            }


            this._loader.load(fileUrl, asset.type, _loaded, asset, options);
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
     * const file = magicallyObtainAFile();
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

    _onTagAdd(tag, asset) {
        this._tags.add(tag, asset);
    }

    _onTagRemove(tag, asset) {
        this._tags.remove(tag, asset);
    }

    _onNameChange(asset, name, nameOld) {
        // remove
        if (this._nameToAsset.has(nameOld)) {
            const items = this._nameToAsset.get(nameOld);
            items.delete(asset);
            if (items.size === 0) {
                this._nameToAsset.delete(nameOld);
            }
        }

        // add
        if (!this._nameToAsset.has(asset.name))
            this._nameToAsset.set(asset.name, new Set());

        this._nameToAsset.get(asset.name).add(asset);
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
     * const assets = app.assets.filter(asset => asset.name.includes('monster'));
     * console.log(`Found ${assets.length} assets with a name containing 'monster'`);
     */
    filter(callback) {
        return Array.from(this._assets).filter(asset => callback(asset));
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
        const items = this._nameToAsset.get(name);
        if (!items) return null;

        for (const asset of items) {
            if (!type || asset.type === type) {
                return asset;
            }
        }

        return null;
    }

    /**
     * Return all Assets with the specified name and type found in the registry.
     *
     * @param {string} name - The name of the Assets to find.
     * @param {string} [type] - The type of the Assets to find.
     * @returns {Asset[]} A list of all Assets found.
     * @example
     * const assets = app.assets.findAll('brick', 'texture');
     * console.log(`Found ${assets.length} texture assets named 'brick'`);
     */
    findAll(name, type) {
        const items = this._nameToAsset.get(name);
        if (!items) return [];
        const results = Array.from(items);
        if (!type) return results;
        return results.filter(asset => asset.type === type);
    }
}

export { AssetRegistry };

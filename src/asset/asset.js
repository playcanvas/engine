import { path } from '../core/path.js';
import { Tags } from '../core/tags.js';

import { EventHandler } from '../core/event-handler.js';

import { findAvailableLocale } from '../i18n/utils.js';

import { ABSOLUTE_URL } from './constants.js';
import { AssetVariants } from './asset-variants.js';
import { getApplication } from '../framework/globals.js';

// auto incrementing number for asset ids
var assetIdCounter = -1;

const VARIANT_SUPPORT = {
    pvr: 'extCompressedTexturePVRTC',
    dxt: 'extCompressedTextureS3TC',
    etc2: 'extCompressedTextureETC',
    etc1: 'extCompressedTextureETC1',
    basis: 'canvas' // dummy, basis is always supported
};

const VARIANT_DEFAULT_PRIORITY = ['pvr', 'dxt', 'etc2', 'etc1', 'basis'];

/**
 * @class
 * @name Asset
 * @augments EventHandler
 * @classdesc An asset record of a file or data resource that can be loaded by the engine.
 * The asset contains three important fields:
 *
 * * `file`: contains the details of a file (filename, url) which contains the resource data, e.g. an image file for a texture asset.
 * * `data`: contains a JSON blob which contains either the resource data for the asset (e.g. material data) or additional data for the file (e.g. material mappings for a model).
 * * `options`: contains a JSON blob with handler-specific load options.
 * * `resource`: contains the final resource when it is loaded. (e.g. a {@link StandardMaterial} or a {@link Texture}).
 *
 * See the {@link AssetRegistry} for details on loading resources from assets.
 * @description Create a new Asset record. Generally, Assets are created in the loading process and you won't need to create them by hand.
 * @param {string} name - A non-unique but human-readable name which can be later used to retrieve the asset.
 * @param {string} type - Type of asset. One of ["animation", "audio", "binary", "container", cubemap", "css", "font", "json", "html", "material", "model", "script", "shader", "sprite", "template", text", "texture"]
 * @param {object} [file] - Details about the file the asset is made from. At the least must contain the 'url' field. For assets that don't contain file data use null.
 * @example
 * var file = {
 *     filename: "filename.txt",
 *     url: "/example/filename.txt"
 * };
 * @param {object} [data] - JSON object with additional data about the asset. (e.g. for texture and model assets) or contains the asset data itself (e.g. in the case of materials)
 * @param {object} [options] - The asset handler options. For container options see {@link ContainerHandler}
 * @param {boolean} [options.crossOrigin] - For use with texture resources. For browser-supported image formats only, enable cross origin.
 * @example
 * var asset = new pc.Asset("a texture", "texture", {
 *     url: "http://example.com/my/assets/here/texture.png"
 * });
 * @property {string} name The name of the asset
 * @property {number} id The asset id
 * @property {("animation"|"audio"|"binary"|"container"|"cubemap"|"css"|"font"|"json"|"html"|"material"|"model"|"script"|"shader"|"sprite"|"template"|"text"|"texture")} type The type of the asset. One of ["animation", "audio", "binary", "container", "cubemap", "css", "font", "json", "html", "material", "model", "script", "shader", "sprite", "template", "text", "texture"]
 * @property {Tags} tags Interface for tagging. Allows to find assets by tags using {@link AssetRegistry#findByTag} method.
 * @property {object} file The file details or null if no file
 * @property {string} [file.url] The URL of the resource file that contains the asset data
 * @property {string} [file.filename] The filename of the resource file or null if no filename was set (e.g from using {@link AssetRegistry#loadFromUrl})
 * @property {number} [file.size] The size of the resource file or null if no size was set (e.g from using {@link AssetRegistry#loadFromUrl})
 * @property {string} [file.hash] The MD5 hash of the resource file data and the Asset data field or null if hash was set (e.g from using {@link AssetRegistry#loadFromUrl})
 * @property {ArrayBuffer} [file.contents] Optional file contents. This is faster than wrapping the data
 * in a (base64 encoded) blob. Currently only used by container assets.
 * @property {object} [data] Optional JSON data that contains either the complete resource data. (e.g. in the case of a material) or additional data (e.g. in the case of a model it contains mappings from mesh to material)
 * @property {object} [options] - Optional JSON data that contains the asset handler options.
 * @property {object} resource A reference to the resource when the asset is loaded. e.g. a {@link Texture} or a {@link Model}
 * @property {Array} resources A reference to the resources of the asset when it's loaded. An asset can hold more runtime resources than one e.g. cubemaps
 * @property {boolean} preload If true the asset will be loaded during the preload phase of application set up.
 * @property {boolean} loaded True if the resource is loaded. e.g. if asset.resource is not null
 * @property {boolean} loading True if the resource is currently being loaded
 * @property {AssetRegistry} registry The asset registry that this Asset belongs to
 */
class Asset extends EventHandler {
    constructor(name, type, file, data, options) {
        super();

        this._id = assetIdCounter--;

        this.name = name || '';
        this.type = type;
        this.tags = new Tags(this);
        this._preload = false;

        this.variants = new AssetVariants(this);

        this._file = null;
        this._data = data || { };
        this.options = options || { };

        // This is where the loaded resource(s) will be
        this._resources = [];

        // a string-assetId dictionary that maps
        // locale to asset id
        this._i18n = {};

        // Is resource loaded
        this.loaded = false;
        this.loading = false;

        this.registry = null;

        if (file) this.file = file;
    }

    /**
     * @event
     * @name Asset#load
     * @description Fired when the asset has completed loading.
     * @param {Asset} asset - The asset that was loaded.
     */

    /**
     * @event
     * @name Asset#unload
     * @description Fired just before the asset unloads the resource. This allows for the opportunity to prepare for an asset that will be unloaded. E.g. Changing the texture of a model to a default before the one it was using is unloaded.
     * @param {Asset} asset - The asset that is due to be unloaded.
     */

    /**
     * @event
     * @name Asset#remove
     * @description Fired when the asset is removed from the asset registry.
     * @param {Asset} asset - The asset that was removed.
     */

    /**
     * @event
     * @name Asset#error
     * @description Fired if the asset encounters an error while loading.
     * @param {string} err - The error message.
     * @param {Asset} asset - The asset that generated the error.
     */

    /**
     * @event
     * @name Asset#change
     * @description Fired when one of the asset properties `file`, `data`, `resource` or `resources` is changed.
     * @param {Asset} asset - The asset that was loaded.
     * @param {string} property - The name of the property that changed.
     * @param {*} value - The new property value.
     * @param {*} oldValue - The old property value.
     */

    /**
     * @event
     * @name Asset#add:localized
     * @description Fired when we add a new localized asset id to the asset.
     * @param {string} locale - The locale.
     * @param {number} assetId - The asset id we added.
     */

    /**
     * @event
     * @name Asset#remove:localized
     * @description Fired when we remove a localized asset id from the asset.
     * @param {string} locale - The locale.
     * @param {number} assetId - The asset id we removed.
     */

    /**
     * @name Asset#getFileUrl
     * @function
     * @description Return the URL required to fetch the file for this asset.
     * @returns {string} The URL.
     * @example
     * var assets = app.assets.find("My Image", "texture");
     * var img = "&lt;img src='" + assets[0].getFileUrl() + "'&gt;";
     */
    getFileUrl() {
        var file = this.getPreferredFile();

        if (!file || !file.url)
            return null;

        var url = file.url;

        if (this.registry && this.registry.prefix && !ABSOLUTE_URL.test(url))
            url = this.registry.prefix + url;

        // add file hash to avoid hard-caching problems
        if (this.type !== 'script' && file.hash) {
            var separator = url.indexOf('?') !== -1 ? '&' : '?';
            url += separator + 't=' + file.hash;
        }

        return url;
    }

    getPreferredFile() {
        if (!this.file)
            return null;

        if (this.type === 'texture' || this.type === 'textureatlas' || this.type === 'bundle') {
            var app = this.registry?._loader?._app || getApplication();
            var device = app?.graphicsDevice;
            if (device) {
                for (var i = 0, len = VARIANT_DEFAULT_PRIORITY.length; i < len; i++) {
                    var variant = VARIANT_DEFAULT_PRIORITY[i];
                    // if the device supports the variant
                    if (! device[VARIANT_SUPPORT[variant]]) continue;

                    // if the variant exists in the asset then just return it
                    if (this.file.variants[variant]) {
                        return this.file.variants[variant];
                    }

                    // if the variant does not exist but the asset is in a bundle
                    // and the bundle contain assets with this variant then return the default
                    // file for the asset
                    if (app.enableBundles) {
                        var bundles = app.bundles.listBundlesForAsset(this);
                        if (! bundles) continue;

                        for (var j = 0, len2 = bundles.length; j < len2; j++) {
                            if (bundles[j].file && bundles[j].file.variants && bundles[j].file.variants[variant]) {
                                return this.file;
                            }
                        }
                    }
                }
            }
        }

        return this.file;
    }

    /**
     * @private
     * @function
     * @name Asset#getAbsoluteUrl
     * @description Construct an asset URL from this asset's location and a relative path. If the relativePath is a
     * blob or Base64 URI, then return that instead.
     * @param {string} relativePath - The relative path to be concatenated to this asset's base url.
     * @returns {string} Resulting URL of the asset.
     */
    getAbsoluteUrl(relativePath) {
        if (relativePath.startsWith('blob:') || relativePath.startsWith('data:')) {
            return relativePath;
        }

        var base = path.getDirectory(this.file.url);
        return path.join(base, relativePath);
    }

    /**
     * @private
     * @function
     * @name Asset#getLocalizedAssetId
     * @param {string} locale - The desired locale e.g. Ar-AR.
     * @description Returns the asset id of the asset that corresponds to the specified locale.
     * @returns {number} An asset id or null if there is no asset specified for the desired locale.
     */
    getLocalizedAssetId(locale) {
        // tries to find either the desired locale or a fallback locale
        locale = findAvailableLocale(locale, this._i18n);
        return this._i18n[locale] || null;
    }

    /**
     * @private
     * @function
     * @name Asset#addLocalizedAssetId
     * @param {string} locale - The locale e.g. Ar-AR.
     * @param {number} assetId - The asset id.
     * @description Adds a replacement asset id for the specified locale. When the locale in {@link Application#i18n} changes then
     * references to this asset will be replaced with the specified asset id. (Currently only supported by the {@link ElementComponent}).
     */
    addLocalizedAssetId(locale, assetId) {
        this._i18n[locale] = assetId;
        this.fire('add:localized', locale, assetId);
    }

    /**
     * @private
     * @function
     * @name Asset#removeLocalizedAssetId
     * @param {string} locale - The locale e.g. Ar-AR.
     * @description Removes a localized asset.
     */
    removeLocalizedAssetId(locale) {
        var assetId = this._i18n[locale];
        if (assetId) {
            delete this._i18n[locale];
            this.fire('remove:localized', locale, assetId);
        }
    }

    /**
     * @function
     * @name Asset#ready
     * @description Take a callback which is called as soon as the asset is loaded. If the asset is already loaded the callback is called straight away.
     * @param {callbacks.AssetReady} callback - The function called when the asset is ready. Passed the (asset) arguments.
     * @param {object} [scope] - Scope object to use when calling the callback.
     * @example
     * var asset = app.assets.find("My Asset");
     * asset.ready(function (asset) {
     *   // asset loaded
     * });
     * app.assets.load(asset);
     */
    ready(callback, scope) {
        scope = scope || this;

        if (this.resource) {
            callback.call(scope, this);
        } else {
            this.once("load", function (asset) {
                callback.call(scope, asset);
            });
        }
    }

    reload() {
        // no need to be reloaded
        if (this.loaded) {
            this.loaded = false;
            this.registry.load(this);
        }
    }

    /**
     * @function
     * @name Asset#unload
     * @description Destroys the associated resource and marks asset as unloaded.
     * @example
     * var asset = app.assets.find("My Asset");
     * asset.unload();
     * // asset.resource is null
     */
    unload() {
        if (!this.loaded && this._resources.length === 0)
            return;

        this.fire('unload', this);
        this.registry.fire('unload:' + this.id, this);

        var old = this._resources;

        // clear resources on the asset
        this.resources = [];
        this.loaded = false;

        // remove resource from loader cache
        if (this.file) {
            this.registry._loader.clearCache(this.getFileUrl(), this.type);
        }

        // destroy resources
        for (var i = 0; i < old.length; ++i) {
            var resource = old[i];
            if (resource && resource.destroy) {
                resource.destroy();
            }
        }
    }

    get id() {
        return this._id;
    }

    set id(value) {
        this._id = value;
    }

    get file() {
        return this._file;
    }

    set file(value) {
        // fire change event when the file changes
        // so that we reload it if necessary
        // set/unset file property of file hash been changed
        var key;
        var valueAsBool = !!value;
        var fileAsBool = !!this._file;
        if (valueAsBool !== fileAsBool || (value && this._file && value.hash !== this._file)) {
            if (value) {
                if (!this._file)
                    this._file = { };

                this._file.url = value.url;
                this._file.filename = value.filename;
                this._file.hash = value.hash;
                this._file.size = value.size;
                this._file.variants = this.variants;
                this._file.contents = value.contents;

                if (value.hasOwnProperty('variants')) {
                    this.variants.clear();

                    if (value.variants) {
                        for (key in value.variants) {
                            if (!value.variants[key])
                                continue;

                            this.variants[key] = value.variants[key];
                        }
                    }
                }

                this.fire('change', this, 'file', this._file, this._file);
                this.reload();
            } else {
                this._file = null;
                this.variants.clear();
            }
        } else if (value && this._file && value.hasOwnProperty('variants')) {
            this.variants.clear();

            if (value.variants) {
                for (key in value.variants) {
                    if (!value.variants[key])
                        continue;

                    this.variants[key] = value.variants[key];
                }
            }
        }
    }

    get data() {
        return this._data;
    }

    set data(value) {
        // fire change event when data changes
        // because the asset might need reloading if that happens
        var old = this._data;
        this._data = value;
        if (value !== old) {
            this.fire('change', this, 'data', value, old);

            if (this.loaded)
                this.registry._loader.patch(this, this.registry);
        }
    }

    get resource() {
        return this._resources[0];
    }

    set resource(value) {
        var _old = this._resources[0];
        this._resources[0] = value;
        this.fire('change', this, 'resource', value, _old);
    }

    get resources() {
        return this._resources;
    }

    set resources(value) {
        var _old = this._resources;
        this._resources = value;
        this.fire('change', this, 'resources', value, _old);
    }

    get preload() {
        return this._preload;
    }

    set preload(value) {
        value = !!value;
        if (this._preload === value)
            return;

        this._preload = value;
        if (this._preload && !this.loaded && !this.loading && this.registry)
            this.registry.load(this);
    }

    get loadFaces() {
        return this._loadFaces;
    }

    set loadFaces(value) {
        value = !!value;
        if (!this.hasOwnProperty('_loadFaces') || value !== this._loadFaces) {
            this._loadFaces = value;

            // the loadFaces property should be part of the asset data block
            // because changing the flag should result in asset patch being invoked.
            // here we must invoke it manually instead.
            if (this.loaded)
                this.registry._loader.patch(this, this.registry);
        }
    }
}

export { Asset };

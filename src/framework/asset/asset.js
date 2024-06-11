import { path } from '../../core/path.js';
import { Tags } from '../../core/tags.js';

import { EventHandler } from '../../core/event-handler.js';

import { findAvailableLocale } from '../i18n/utils.js';

import { ABSOLUTE_URL } from './constants.js';
import { AssetFile } from './asset-file.js';
import { getApplication } from '../globals.js';
import { http } from '../../platform/net/http.js';

// auto incrementing number for asset ids
let assetIdCounter = -1;

const VARIANT_SUPPORT = {
    pvr: 'extCompressedTexturePVRTC',
    dxt: 'extCompressedTextureS3TC',
    etc2: 'extCompressedTextureETC',
    etc1: 'extCompressedTextureETC1',
    basis: 'canvas' // dummy, basis is always supported
};

const VARIANT_DEFAULT_PRIORITY = ['pvr', 'dxt', 'etc2', 'etc1', 'basis'];

/**
 * Callback used by {@link Asset#ready} and called when an asset is ready.
 *
 * @callback AssetReadyCallback
 * @param {Asset} asset - The ready asset.
 */

/**
 * An asset record of a file or data resource that can be loaded by the engine. The asset contains
 * four important fields:
 *
 * - `file`: contains the details of a file (filename, url) which contains the resource data, e.g.
 * an image file for a texture asset.
 * - `data`: contains a JSON blob which contains either the resource data for the asset (e.g.
 * material data) or additional data for the file (e.g. material mappings for a model).
 * - `options`: contains a JSON blob with handler-specific load options.
 * - `resource`: contains the final resource when it is loaded. (e.g. a {@link StandardMaterial} or
 * a {@link Texture}).
 *
 * See the {@link AssetRegistry} for details on loading resources from assets.
 *
 * @category Asset
 */
class Asset extends EventHandler {
    /**
     * Fired when the asset has completed loading.
     *
     * @event
     * @example
     * asset.on('load', (asset) => {
     *     console.log(`Asset loaded: ${asset.name}`);
     * });
     */
    static EVENT_LOAD = 'load';

    /**
     * Fired just before the asset unloads the resource. This allows for the opportunity to prepare
     * for an asset that will be unloaded. E.g. Changing the texture of a model to a default before
     * the one it was using is unloaded.
     *
     * @event
     * @example
     * asset.on('unload', (asset) => {
     *    console.log(`Asset about to unload: ${asset.name}`);
     * });
     */
    static EVENT_UNLOAD = 'unload';

    /**
     * Fired when the asset is removed from the asset registry.
     *
     * @event
     * @example
     * asset.on('remove', (asset) => {
     *    console.log(`Asset removed: ${asset.name}`);
     * });
     */
    static EVENT_REMOVE = 'remove';

    /**
     * Fired if the asset encounters an error while loading.
     *
     * @event
     * @example
     * asset.on('error', (err, asset) => {
     *    console.error(`Error loading asset ${asset.name}: ${err}`);
     * });
     */
    static EVENT_ERROR = 'error';

    /**
     * Fired when one of the asset properties `file`, `data`, `resource` or `resources` is changed.
     *
     * @event
     * @example
     * asset.on('change', (asset, property, newValue, oldValue) => {
     *    console.log(`Asset ${asset.name} has property ${property} changed from ${oldValue} to ${newValue}`);
     * });
     */
    static EVENT_CHANGE = 'change';

    /**
     * Fired when we add a new localized asset id to the asset.
     *
     * @event
     * @example
     * asset.on('add:localized', (locale, assetId) => {
     *    console.log(`Asset ${asset.name} has added localized asset ${assetId} for locale ${locale}`);
     * });
     */
    static EVENT_ADDLOCALIZED = 'add:localized';

    /**
     * Fired when we remove a localized asset id from the asset.
     *
     * @event
     * @example
     * asset.on('remove:localized', (locale, assetId) => {
     *   console.log(`Asset ${asset.name} has removed localized asset ${assetId} for locale ${locale}`);
     * });
     */
    static EVENT_REMOVELOCALIZED = 'remove:localized';

    /**
     * Create a new Asset record. Generally, Assets are created in the loading process and you
     * won't need to create them by hand.
     *
     * @param {string} name - A non-unique but human-readable name which can be later used to
     * retrieve the asset.
     * @param {string} type - Type of asset. One of ["animation", "audio", "binary", "bundle", "container",
     * "cubemap", "css", "font", "json", "html", "material", "model", "script", "shader", "sprite",
     * "template", text", "texture", "textureatlas"]
     * @param {object} [file] - Details about the file the asset is made from. At the least must
     * contain the 'url' field. For assets that don't contain file data use null.
     * @param {string} [file.url] - The URL of the resource file that contains the asset data.
     * @param {string} [file.filename] - The filename of the resource file or null if no filename
     * was set (e.g from using {@link AssetRegistry#loadFromUrl}).
     * @param {number} [file.size] - The size of the resource file or null if no size was set
     * (e.g. from using {@link AssetRegistry#loadFromUrl}).
     * @param {string} [file.hash] - The MD5 hash of the resource file data and the Asset data
     * field or null if hash was set (e.g from using {@link AssetRegistry#loadFromUrl}).
     * @param {ArrayBuffer} [file.contents] - Optional file contents. This is faster than wrapping
     * the data in a (base64 encoded) blob. Currently only used by container assets.
     * @param {object|string} [data] - JSON object or string with additional data about the asset.
     * (e.g. for texture and model assets) or contains the asset data itself (e.g. in the case of
     * materials).
     * @param {object} [options] - The asset handler options. For container options see
     * {@link ContainerHandler}.
     * @param {'anonymous'|'use-credentials'|null} [options.crossOrigin] - For use with texture assets
     * that are loaded using the browser. This setting overrides the default crossOrigin specifier.
     * For more details on crossOrigin and its use, see
     * https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/crossOrigin.
     * @example
     * const asset = new pc.Asset("a texture", "texture", {
     *     url: "http://example.com/my/assets/here/texture.png"
     * });
     */
    constructor(name, type, file, data, options) {
        super();

        this._id = assetIdCounter--;
        this._name = name || '';

        /**
         * The type of the asset. One of ["animation", "audio", "binary", "container", "cubemap",
         * "css", "font", "json", "html", "material", "model", "render", "script", "shader", "sprite",
         * "template", "text", "texture", "textureatlas"]
         *
         * @type {("animation"|"audio"|"binary"|"container"|"cubemap"|"css"|"font"|"json"|"html"|"material"|"model"|"render"|"script"|"shader"|"sprite"|"template"|"text"|"texture"|"textureatlas")}
         */
        this.type = type;

        /**
         * Asset tags. Enables finding of assets by tags using the {@link AssetRegistry#findByTag} method.
         *
         * @type {Tags}
         */
        this.tags = new Tags(this);

        this._preload = false;
        this._file = null;
        this._data = data || { };

        /**
         * Optional JSON data that contains the asset handler options.
         *
         * @type {object}
         */
        this.options = options || { };

        // This is where the loaded resource(s) will be
        this._resources = [];

        this.urlObject = null;

        // a string-assetId dictionary that maps
        // locale to asset id
        this._i18n = {};

        /**
         * True if the asset has finished attempting to load the resource. It is not guaranteed
         * that the resources are available as there could have been a network error.
         *
         * @type {boolean}
         */
        this.loaded = false;

        /**
         * True if the resource is currently being loaded.
         *
         * @type {boolean}
         */
        this.loading = false;

        /**
         * The asset registry that this Asset belongs to.
         *
         * @type {import('./asset-registry.js').AssetRegistry|null}
         */
        this.registry = null;

        if (file) this.file = file;
    }

    /**
     * Sets the asset id.
     *
     * @type {number}
     */
    set id(value) {
        this._id = value;
    }

    /**
     * Gets the asset id.
     *
     * @type {number}
     */
    get id() {
        return this._id;
    }

    /**
     * Sets the asset name.
     *
     * @type {string}
     */
    set name(value) {
        if (this._name === value)
            return;
        const old = this._name;
        this._name = value;
        this.fire('name', this, this._name, old);
    }

    /**
     * Gets the asset name.
     *
     * @type {string}
     */
    get name() {
        return this._name;
    }

    /**
     * Sets the file details or null if no file.
     *
     * @type {object}
     */
    set file(value) {
        // if value contains variants, choose the correct variant first
        if (value && value.variants && ['texture', 'textureatlas', 'bundle'].indexOf(this.type) !== -1) {
            // search for active variant
            const app = this.registry?._loader?._app || getApplication();
            const device = app?.graphicsDevice;
            if (device) {
                for (let i = 0, len = VARIANT_DEFAULT_PRIORITY.length; i < len; i++) {
                    const variant = VARIANT_DEFAULT_PRIORITY[i];
                    // if the device supports the variant
                    if (value.variants[variant] && device[VARIANT_SUPPORT[variant]]) {
                        value = value.variants[variant];
                        break;
                    }

                    // if the variant does not exist but the asset is in a bundle
                    // and the bundle contain assets with this variant then return the default
                    // file for the asset
                    if (app.enableBundles) {
                        const bundles = app.bundles.listBundlesForAsset(this);
                        if (bundles && bundles.find((b) => {
                            return b?.file?.variants[variant];
                        })) {
                            break;
                        }
                    }
                }
            }
        }

        const oldFile = this._file;
        const newFile = value ? new AssetFile(value.url, value.filename, value.hash, value.size, value.opt, value.contents) : null;

        if (!!newFile !== !!oldFile || (newFile && !newFile.equals(oldFile))) {
            this._file = newFile;
            this.fire('change', this, 'file', newFile, oldFile);
            this.reload();
        }
    }

    /**
     * Gets the file details or null if no file.
     *
     * @type {object}
     */
    get file() {
        return this._file;
    }

    /**
     * Sets optional asset JSON data. This contains either the complete resource data (such as in
     * the case of a material) or additional data (such as in the case of a model which contains
     * mappings from mesh to material).
     *
     * @type {object}
     */
    set data(value) {
        // fire change event when data changes
        // because the asset might need reloading if that happens
        const old = this._data;
        this._data = value;
        if (value !== old) {
            this.fire('change', this, 'data', value, old);

            if (this.loaded)
                this.registry._loader.patch(this, this.registry);
        }
    }

    /**
     * Gets optional asset JSON data.
     *
     * @type {object}
     */
    get data() {
        return this._data;
    }

    /**
     * Sets the asset resource. For example, a {@link Texture} or a {@link Model}.
     *
     * @type {object}
     */
    set resource(value) {
        const _old = this._resources[0];
        this._resources[0] = value;
        this.fire('change', this, 'resource', value, _old);
    }

    /**
     * Gets the asset resource.
     *
     * @type {object}
     */
    get resource() {
        return this._resources[0];
    }

    /**
     * Sets the asset resources. Some assets can hold more than one runtime resource (cube maps,
     * for example).
     *
     * @type {object[]}
     */
    set resources(value) {
        const _old = this._resources;
        this._resources = value;
        this.fire('change', this, 'resources', value, _old);
    }

    /**
     * Gets the asset resources.
     *
     * @type {object[]}
     */
    get resources() {
        return this._resources;
    }

    /**
     * Sets whether to preload an asset. If true, the asset will be loaded during the preload phase
     * of application set up.
     *
     * @type {boolean}
     */
    set preload(value) {
        value = !!value;
        if (this._preload === value)
            return;

        this._preload = value;
        if (this._preload && !this.loaded && !this.loading && this.registry)
            this.registry.load(this);
    }

    /**
     * Gets whether to preload an asset.
     *
     * @type {boolean}
     */
    get preload() {
        return this._preload;
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

    get loadFaces() {
        return this._loadFaces;
    }

    /**
     * Return the URL required to fetch the file for this asset.
     *
     * @returns {string|null} The URL. Returns null if the asset has no associated file.
     * @example
     * const assets = app.assets.find("My Image", "texture");
     * const img = "&lt;img src='" + assets[0].getFileUrl() + "'&gt;";
     */
    getFileUrl() {
        const file = this.file;

        if (!file || !file.url)
            return null;

        let url = file.url;

        if (this.registry && this.registry.prefix && !ABSOLUTE_URL.test(url))
            url = this.registry.prefix + url;

        // add file hash to avoid hard-caching problems
        if (this.type !== 'script' && file.hash) {
            const separator = url.indexOf('?') !== -1 ? '&' : '?';
            url += separator + 't=' + file.hash;
        }

        return url;
    }

    /**
     * Construct an asset URL from this asset's location and a relative path. If the relativePath
     * is a blob or Base64 URI, then return that instead.
     *
     * @param {string} relativePath - The relative path to be concatenated to this asset's base url.
     * @returns {string} Resulting URL of the asset.
     * @ignore
     */
    getAbsoluteUrl(relativePath) {
        if (relativePath.startsWith('blob:') || relativePath.startsWith('data:')) {
            return relativePath;
        }

        const base = path.getDirectory(this.file.url);
        return path.join(base, relativePath);
    }

    /**
     * Returns the asset id of the asset that corresponds to the specified locale.
     *
     * @param {string} locale - The desired locale e.g. Ar-AR.
     * @returns {number} An asset id or null if there is no asset specified for the desired locale.
     * @ignore
     */
    getLocalizedAssetId(locale) {
        // tries to find either the desired locale or a fallback locale
        locale = findAvailableLocale(locale, this._i18n);
        return this._i18n[locale] || null;
    }

    /**
     * Adds a replacement asset id for the specified locale. When the locale in
     * {@link Application#i18n} changes then references to this asset will be replaced with the
     * specified asset id. (Currently only supported by the {@link ElementComponent}).
     *
     * @param {string} locale - The locale e.g. Ar-AR.
     * @param {number} assetId - The asset id.
     * @ignore
     */
    addLocalizedAssetId(locale, assetId) {
        this._i18n[locale] = assetId;
        this.fire('add:localized', locale, assetId);
    }

    /**
     * Removes a localized asset.
     *
     * @param {string} locale - The locale e.g. Ar-AR.
     * @ignore
     */
    removeLocalizedAssetId(locale) {
        const assetId = this._i18n[locale];
        if (assetId) {
            delete this._i18n[locale];
            this.fire('remove:localized', locale, assetId);
        }
    }

    /**
     * Take a callback which is called as soon as the asset is loaded. If the asset is already
     * loaded the callback is called straight away.
     *
     * @param {AssetReadyCallback} callback - The function called when the asset is ready. Passed
     * the (asset) arguments.
     * @param {object} [scope] - Scope object to use when calling the callback.
     * @example
     * const asset = app.assets.find("My Asset");
     * asset.ready(function (asset) {
     *   // asset loaded
     * });
     * app.assets.load(asset);
     */
    ready(callback, scope) {
        scope = scope || this;

        if (this.loaded) {
            callback.call(scope, this);
        } else {
            this.once('load', function (asset) {
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
     * Destroys the associated resource and marks asset as unloaded.
     *
     * @example
     * const asset = app.assets.find("My Asset");
     * asset.unload();
     * // asset.resource is null
     */
    unload() {
        if (!this.loaded && this._resources.length === 0)
            return;

        this.fire('unload', this);
        this.registry.fire('unload:' + this.id, this);

        const old = this._resources;

        if (this.urlObject) {
            URL.revokeObjectURL(this.urlObject);
            this.urlObject = null;
        }

        // clear resources on the asset
        this.resources = [];
        this.loaded = false;

        // remove resource from loader cache
        if (this.file) {
            this.registry._loader.clearCache(this.getFileUrl(), this.type);
        }

        // destroy resources
        for (let i = 0; i < old.length; ++i) {
            const resource = old[i];
            if (resource && resource.destroy) {
                resource.destroy();
            }
        }
    }

    /**
     * Helper function to resolve asset file data and return the contents as an ArrayBuffer. If the
     * asset file contents are present, that is returned. Otherwise the file data is be downloaded
     * via http.
     *
     * @param {string} loadUrl - The URL as passed into the handler
     * @param {import('../handlers/loader.js').ResourceLoaderCallback} callback - The callback
     * function to receive results.
     * @param {Asset} [asset] - The asset
     * @param {number} maxRetries - Number of retries if http download is required
     * @ignore
     */
    static fetchArrayBuffer(loadUrl, callback, asset, maxRetries = 0) {
        if (asset?.file?.contents) {
            // asset file contents were provided
            setTimeout(() => {
                callback(null, asset.file.contents);
            });
        } else {
            // asset contents must be downloaded
            http.get(loadUrl, {
                cache: true,
                responseType: 'arraybuffer',
                retry: maxRetries > 0,
                maxRetries: maxRetries
            }, callback);
        }
    }
}

export { Asset };

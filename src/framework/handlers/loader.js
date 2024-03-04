import { Debug } from '../../core/debug.js';

/**
 * Callback used by {@link ResourceLoader#load} when a resource is loaded (or an error occurs).
 *
 * @callback ResourceLoaderCallback
 * @param {string|null} err - The error message in the case where the load fails.
 * @param {*} [resource] - The resource that has been successfully loaded.
 */

/**
 * Load resource data, potentially from remote sources. Caches resource on load to prevent multiple
 * requests. Add ResourceHandlers to handle different types of resources.
 */
class ResourceLoader {
    /**
     * Create a new ResourceLoader instance.
     *
     * @param {import('../app-base.js').AppBase} app - The application.
     */
    constructor(app) {
        this._handlers = {};
        this._requests = {};
        this._cache = {};
        this._app = app;
    }

    /**
     * Add a {@link ResourceHandler} for a resource type. Handler should support at least `load()`
     * and `open()`. Handlers can optionally support patch(asset, assets) to handle dependencies on
     * other assets.
     *
     * @param {string} type - The name of the resource type that the handler will be registered
     * with. Can be:
     *
     * - {@link ASSET_ANIMATION}
     * - {@link ASSET_AUDIO}
     * - {@link ASSET_IMAGE}
     * - {@link ASSET_JSON}
     * - {@link ASSET_MODEL}
     * - {@link ASSET_MATERIAL}
     * - {@link ASSET_TEXT}
     * - {@link ASSET_TEXTURE}
     * - {@link ASSET_CUBEMAP}
     * - {@link ASSET_SHADER}
     * - {@link ASSET_CSS}
     * - {@link ASSET_HTML}
     * - {@link ASSET_SCRIPT}
     * - {@link ASSET_CONTAINER}
     *
     * @param {import('./handler.js').ResourceHandler} handler - An instance of a resource handler
     * supporting at least `load()` and `open()`.
     * @example
     * const loader = new ResourceLoader();
     * loader.addHandler("json", new pc.JsonHandler());
     */
    addHandler(type, handler) {
        this._handlers[type] = handler;
        handler._loader = this;
    }

    /**
     * Remove a {@link ResourceHandler} for a resource type.
     *
     * @param {string} type - The name of the type that the handler will be removed.
     */
    removeHandler(type) {
        delete this._handlers[type];
    }

    /**
     * Get a {@link ResourceHandler} for a resource type.
     *
     * @param {string} type - The name of the resource type that the handler is registered with.
     * @returns {import('./handler.js').ResourceHandler|undefined} The registered handler, or
     * undefined if the requested handler is not registered.
     */
    getHandler(type) {
        return this._handlers[type];
    }

    static makeKey(url, type) {
        return `${url}-${type}`;
    }

    /**
     * Make a request for a resource from a remote URL. Parse the returned data using the handler
     * for the specified type. When loaded and parsed, use the callback to return an instance of
     * the resource.
     *
     * @param {string} url - The URL of the resource to load.
     * @param {string} type - The type of resource expected.
     * @param {ResourceLoaderCallback} callback - The callback used when the resource is loaded or
     * an error occurs. Passed (err, resource) where err is null if there are no errors.
     * @param {import('../asset/asset.js').Asset} [asset] - Optional asset that is passed into
     * handler.
     * @param {object} [options] - Additional options for loading.
     * @param {boolean} [options.bundlesIgnore] - If set to true, then asset will not try to load
     * from a bundle. Defaults to false.
     * @param {import('../asset/asset-registry.js').BundlesFilterCallback} [options.bundlesFilter] - A callback that will be called
     * when loading an asset that is contained in any of the bundles. It provides an array of
     * bundles and will ensure asset is loaded from bundle returned from a callback. By default
     * smallest filesize bundle is choosen.
     * @example
     * app.loader.load("../path/to/texture.png", "texture", function (err, texture) {
     *     // use texture here
     * });
     */
    load(url, type, callback, asset, options) {
        const handler = this._handlers[type];
        if (!handler) {
            const err = `No resource handler for asset type: '${type}' when loading [${url}]`;
            Debug.errorOnce(err);
            callback(err);
            return;
        }

        // handle requests with null file
        if (!url) {
            this._loadNull(handler, callback, asset);
            return;
        }

        const key = ResourceLoader.makeKey(url, type);

        if (this._cache[key] !== undefined) {
            // in cache
            callback(null, this._cache[key]);
        } else if (this._requests[key]) {
            // existing request
            this._requests[key].push(callback);
        } else {
            // new request
            this._requests[key] = [callback];

            const self = this;

            const handleLoad = function (err, urlObj) {
                if (err) {
                    self._onFailure(key, err);
                    return;
                }

                if (urlObj.load instanceof DataView) {
                    if (handler.openBinary) {
                        if (!self._requests[key])
                            return;

                        try {
                            const data = handler.openBinary(urlObj.load);
                            self._onSuccess(key, data);
                        } catch (err) {
                            self._onFailure(key, err);
                        }
                        return;
                    }

                    urlObj.load = URL.createObjectURL(new Blob([urlObj.load]));
                    if (asset) {
                        if (asset.urlObject)
                            URL.revokeObjectURL(asset.urlObject);
                        asset.urlObject = urlObj.load;
                    }
                }

                handler.load(urlObj, function (err, data, extra) {
                    // make sure key exists because loader
                    // might have been destroyed by now
                    if (!self._requests[key]) {
                        return;
                    }

                    if (err) {
                        self._onFailure(key, err);
                        return;
                    }

                    try {
                        self._onSuccess(key, handler.open(urlObj.original, data, asset), extra);
                    } catch (e) {
                        self._onFailure(key, e);
                    }
                }, asset);
            };

            const normalizedUrl = url.split('?')[0];
            if (this._app.enableBundles && this._app.bundles.hasUrl(normalizedUrl) && !(options && options.bundlesIgnore)) {
                // if there is no loaded bundle with asset, then start loading a bundle
                if (!this._app.bundles.urlIsLoadedOrLoading(normalizedUrl)) {
                    const bundles = this._app.bundles.listBundlesForAsset(asset);
                    let bundle;

                    if (options && options.bundlesFilter) {
                        bundle = options.bundlesFilter(bundles);
                    }

                    if (!bundle) {
                        // prioritize smallest bundle
                        bundles?.sort((a, b) => {
                            return a.file.size - b.file.size;
                        });
                        bundle = bundles?.[0];
                    }

                    if (bundle) this._app.assets?.load(bundle);
                }

                this._app.bundles.loadUrl(normalizedUrl, function (err, fileUrlFromBundle) {
                    handleLoad(err, {
                        load: fileUrlFromBundle,
                        original: normalizedUrl
                    });
                });
            } else {
                handleLoad(null, {
                    load: url,
                    original: asset && asset.file.filename || url
                });
            }
        }
    }

    // load an asset with no url, skipping bundles and caching
    _loadNull(handler, callback, asset) {
        const onLoad = function (err, data, extra) {
            if (err) {
                callback(err);
            } else {
                try {
                    callback(null, handler.open(null, data, asset), extra);
                } catch (e) {
                    callback(e);
                }
            }
        };
        handler.load(null, onLoad, asset);
    }

    _onSuccess(key, result, extra) {
        if (result !== null) {
            this._cache[key] = result;
        } else {
            delete this._cache[key];
        }
        for (let i = 0; i < this._requests[key].length; i++) {
            this._requests[key][i](null, result, extra);
        }
        delete this._requests[key];
    }

    _onFailure(key, err) {
        console.error(err);
        if (this._requests[key]) {
            for (let i = 0; i < this._requests[key].length; i++) {
                this._requests[key][i](err);
            }
            delete this._requests[key];
        }
    }

    /**
     * Convert raw resource data into a resource instance. E.g. Take 3D model format JSON and
     * return a {@link Model}.
     *
     * @param {string} type - The type of resource.
     * @param {*} data - The raw resource data.
     * @returns {*} The parsed resource data.
     */
    open(type, data) {
        const handler = this._handlers[type];
        if (!handler) {
            console.warn('No resource handler found for: ' + type);
            return data;
        }

        return handler.open(null, data);

    }

    /**
     * Perform any operations on a resource, that requires a dependency on its asset data or any
     * other asset data.
     *
     * @param {import('../asset/asset.js').Asset} asset - The asset to patch.
     * @param {import('../asset/asset-registry.js').AssetRegistry} assets - The asset registry.
     */
    patch(asset, assets) {
        const handler = this._handlers[asset.type];
        if (!handler)  {
            console.warn('No resource handler found for: ' + asset.type);
            return;
        }

        if (handler.patch) {
            handler.patch(asset, assets);
        }
    }

    /**
     * Remove resource from cache.
     *
     * @param {string} url - The URL of the resource.
     * @param {string} type - The type of resource.
     */
    clearCache(url, type) {
        const key = ResourceLoader.makeKey(url, type);
        delete this._cache[key];
    }

    /**
     * Check cache for resource from a URL. If present, return the cached value.
     *
     * @param {string} url - The URL of the resource to get from the cache.
     * @param {string} type - The type of the resource.
     * @returns {*} The resource loaded from the cache.
     */
    getFromCache(url, type) {
        const key = ResourceLoader.makeKey(url, type);
        if (this._cache[key]) {
            return this._cache[key];
        }
        return undefined;
    }

    /**
     * Enables retrying of failed requests when loading assets.
     *
     * @param {number} maxRetries - The maximum number of times to retry loading an asset. Defaults
     * to 5.
     * @ignore
     */
    enableRetry(maxRetries = 5) {
        maxRetries = Math.max(0, maxRetries) || 0;

        for (const key in this._handlers) {
            this._handlers[key].maxRetries = maxRetries;
        }
    }

    /**
     * Disables retrying of failed requests when loading assets.
     *
     * @ignore
     */
    disableRetry() {
        for (const key in this._handlers) {
            this._handlers[key].maxRetries = 0;
        }
    }

    /**
     * Destroys the resource loader.
     */
    destroy() {
        this._handlers = {};
        this._requests = {};
        this._cache = {};
    }
}

export { ResourceLoader };

/**
 * @class
 * @name pc.ResourceLoader
 * @param {pc.Application} app - The application.
 * @classdesc Load resource data, potentially from remote sources. Caches resource on load to prevent
 * multiple requests. Add ResourceHandlers to handle different types of resources.
 */
class ResourceLoader {
    constructor(app) {
        this._handlers = {};
        this._requests = {};
        this._cache = {};
        this._app = app;
    }

    /**
     * @function
     * @name pc.ResourceLoader#addHandler
     * @description Add a {@link pc.ResourceHandler} for a resource type. Handler should support atleast load() and open().
     * Handlers can optionally support patch(asset, assets) to handle dependencies on other assets.
     * @param {string} type - The name of the resource type that the handler will be registered with. Can be:
     *
     * * {@link pc.ASSET_ANIMATION}
     * * {@link pc.ASSET_AUDIO}
     * * {@link pc.ASSET_IMAGE}
     * * {@link pc.ASSET_JSON}
     * * {@link pc.ASSET_MODEL}
     * * {@link pc.ASSET_MATERIAL}
     * * {@link pc.ASSET_TEXT}
     * * {@link pc.ASSET_TEXTURE}
     * * {@link pc.ASSET_CUBEMAP}
     * * {@link pc.ASSET_SHADER}
     * * {@link pc.ASSET_CSS}
     * * {@link pc.ASSET_HTML}
     * * {@link pc.ASSET_SCRIPT}
     * * {@link pc.ASSET_CONTAINER}
     *
     * @param {pc.ResourceHandler} handler - An instance of a resource handler supporting atleast load() and open().
     * @example
     * var loader = new ResourceLoader();
     * loader.addHandler("json", new pc.JsonHandler());
     */
    addHandler(type, handler) {
        this._handlers[type] = handler;
        handler._loader = this;
    }

    /**
     * @function
     * @name pc.ResourceLoader#removeHandler
     * @description Remove a {@link pc.ResourceHandler} for a resource type.
     * @param {string} type - The name of the type that the handler will be removed.
     */
    removeHandler(type) {
        delete this._handlers[type];
    }

    /**
     * @function
     * @name pc.ResourceLoader#getHandler
     * @description Get a {@link pc.ResourceHandler} for a resource type.
     * @param {string} type - The name of the resource type that the handler is registered with.
     * @returns {pc.ResourceHandler} The registered handler.
     */
    getHandler(type) {
        return this._handlers[type];
    }

    /**
     * @function
     * @name pc.ResourceLoader#load
     * @description Make a request for a resource from a remote URL. Parse the returned data using the
     * handler for the specified type. When loaded and parsed, use the callback to return an instance of
     * the resource.
     * @param {string} url - The URL of the resource to load.
     * @param {string} type - The type of resource expected.
     * @param {pc.callbacks.ResourceLoader} callback - The callback used when the resource is loaded or an error occurs.
     * @param {pc.Asset} [asset] - Optional asset that is passed into handler
     * Passed (err, resource) where err is null if there are no errors.
     * @example
     * app.loader.load("../path/to/texture.png", "texture", function (err, texture) {
     *     // use texture here
     * });
     */
    load(url, type, callback, asset) {
        var handler = this._handlers[type];
        if (!handler) {
            var err = "No handler for asset type: " + type;
            callback(err);
            return;
        }

        // handle requests with null file
        if (!url) {
            this._loadNull(handler, callback, asset);
            return;
        }

        var key = url + type;

        if (this._cache[key] !== undefined) {
            // in cache
            callback(null, this._cache[key]);
        } else if (this._requests[key]) {
            // existing request
            this._requests[key].push(callback);
        } else {
            // new request
            this._requests[key] = [callback];

            var self = this;

            var handleLoad = function (err, urlObj) {
                if (err) {
                    self._onFailure(key, err);
                    return;
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

            var normalizedUrl = url.split('?')[0];
            if (this._app.enableBundles && this._app.bundles.hasUrl(normalizedUrl)) {
                if (!this._app.bundles.canLoadUrl(normalizedUrl)) {
                    handleLoad('Bundle for ' + url + ' not loaded yet');
                    return;
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
                    original: asset && asset.getPreferredFile().filename || url
                });
            }
        }
    }

    // load an asset with no url, skipping bundles and caching
    _loadNull(handler, callback, asset) {
        var onLoad = function (err, data, extra) {
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
        this._cache[key] = result;
        for (var i = 0; i < this._requests[key].length; i++) {
            this._requests[key][i](null, result, extra);
        }
        delete this._requests[key];
    }

    _onFailure(key, err) {
        console.error(err);
        if (this._requests[key]) {
            for (var i = 0; i < this._requests[key].length; i++) {
                this._requests[key][i](err);
            }
            delete this._requests[key];
        }
    }

    /**
     * @function
     * @name pc.ResourceLoader#open
     * @description Convert raw resource data into a resource instance. E.g. Take 3D model format JSON and return a pc.Model.
     * @param {string} type - The type of resource.
     * @param {*} data - The raw resource data.
     * @returns {*} The parsed resource data.
     */
    open(type, data) {
        var handler = this._handlers[type];
        if (!handler) {
            console.warn("No resource handler found for: " + type);
            return data;
        }

        return handler.open(null, data);

    }

    /**
     * @function
     * @name pc.ResourceLoader#patch
     * @description Perform any operations on a resource, that requires a dependency on its asset data
     * or any other asset data.
     * @param {pc.Asset} asset - The asset to patch.
     * @param {pc.AssetRegistry} assets - The asset registry.
     */
    patch(asset, assets) {
        var handler = this._handlers[asset.type];
        if (!handler)  {
            console.warn("No resource handler found for: " + asset.type);
            return;
        }

        if (handler.patch) {
            handler.patch(asset, assets);
        }
    }

    /**
     * @function
     * @name pc.ResourceLoader#clearCache
     * @description Remove resource from cache.
     * @param {string} url - The URL of the resource.
     * @param {string} type - The type of resource.
     */
    clearCache(url, type) {
        delete this._cache[url + type];
    }

    /**
     * @function
     * @name pc.ResourceLoader#getFromCache
     * @description Check cache for resource from a URL. If present, return the cached value.
     * @param {string} url - The URL of the resource to get from the cache.
     * @param {string} type - The type of the resource.
     * @returns {*} The resource loaded from the cache.
     */
    getFromCache(url, type) {
        if (this._cache[url + type]) {
            return this._cache[url + type];
        }
    }

    /**
     * @private
     * @function
     * @name pc.ResourceLoader#enableRetry
     * @param {number} maxRetries - The maximum number of times to retry loading an asset. Defaults to 5.
     * @description Enables retrying of failed requests when loading assets.
     */
    enableRetry(maxRetries = 5) {
        maxRetries = Math.max(0, maxRetries) || 0;

        for (var key in this._handlers) {
            this._handlers[key].maxRetries = maxRetries;
        }
    }

    /**
     * @private
     * @function
     * @name pc.ResourceLoader#disableRetry
     * @description Disables retrying of failed requests when loading assets.
     */
    disableRetry() {
        for (var key in this._handlers) {
            this._handlers[key].maxRetries = 0;
        }
    }

    /**
     * @function
     * @name pc.ResourceLoader#destroy
     * @description Destroys the resource loader.
     */
    destroy() {
        this._handlers = {};
        this._requests = {};
        this._cache = {};
    }
}

export { ResourceLoader };

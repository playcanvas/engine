Object.assign(pc, function () {
    'use strict';

    /**
     * @constructor
     * @name pc.ResourceLoader
     * @param {pc.Application} app The application
     * @classdesc Load resource data, potentially from remote sources. Caches resource on load to prevent
     * multiple requests. Add ResourceHandlers to handle different types of resources.
     */
    var ResourceLoader = function (app) {
        this._handlers = {};
        this._requests = {};
        this._cache = {};
        this._app = app;
    };

    Object.assign(ResourceLoader.prototype, {
        /**
         * @function
         * @name pc.ResourceLoader#addHandler
         * @description Add a {@link pc.ResourceHandler} for a resource type. Handler should support atleast load() and open().
         * Handlers can optionally support patch(asset, assets) to handle dependencies on other assets.
         * @param {String} type The name of the resource type that the handler will be registerd with. Can be:
         * <ul>
         *     <li>{@link pc.ASSET_ANIMATION}</li>
         *     <li>{@link pc.ASSET_AUDIO}</li>
         *     <li>{@link pc.ASSET_IMAGE}</li>
         *     <li>{@link pc.ASSET_JSON}</li>
         *     <li>{@link pc.ASSET_MODEL}</li>
         *     <li>{@link pc.ASSET_MATERIAL}</li>
         *     <li>{@link pc.ASSET_TEXT}</li>
         *     <li>{@link pc.ASSET_TEXTURE}</li>
         *     <li>{@link pc.ASSET_CUBEMAP}</li>
         *     <li>{@link pc.ASSET_SHADER}</li>
         *     <li>{@link pc.ASSET_CSS}</li>
         *     <li>{@link pc.ASSET_HTML}</li>
         *     <li>{@link pc.ASSET_SCRIPT}</li>
         * </ul>
         * @param {pc.ResourceHandler} handler An instance of a resource handler supporting atleast load() and open().
         * @example
         * var loader = new ResourceLoader();
         * loader.addHandler("json", new pc.JsonHandler());
         */
        addHandler: function (type, handler) {
            this._handlers[type] = handler;
            handler._loader = this;
        },

        /**
         * @function
         * @name pc.ResourceLoader#removeHandler
         * @description Remove a {@link pc.ResourceHandler} for a resource type.
         * @param {String} type The name of the type that the handler will be removed.
         */
        removeHandler: function (type) {
            delete this._handlers[type];
        },

        /**
         * @function
         * @name pc.ResourceLoader#getHandler
         * @description Get a {@link pc.ResourceHandler} for a resource type.
         * @param {String} type The name of the resource type that the handler is registerd with.
         * @returns {pc.ResourceHandler} The registerd handler.
         */
        getHandler: function (type) {
            return this._handlers[type];
        },

        /**
         * @callback pc.ResourceLoader.loadCallback
         * @description Callback function used by {@link pc.ResourceLoader#load} when a resource is loaded (or an error occurs).
         * @param {String|Null} err The error message in the case where the load fails.
         * @param {*} [resource] The resource that has been successfully loaded.
         */

        /**
         * @function
         * @name pc.ResourceLoader#load
         * @description Make a request for a resource from a remote URL. Parse the returned data using the
         * handler for the specified type. When loaded and parsed, use the callback to return an instance of
         * the resource.
         * @param {String} url The URL of the resource to load.
         * @param {String} type The type of resource expected.
         * @param {pc.ResourceLoader.loadCallback} callback The callback used when the resource is loaded or an error occurs.
         * @param {pc.Asset} [asset] Optional asset that is passed into handler
         * Passed (err, resource) where err is null if there are no errors.
         * @example
         * app.loader.load("../path/to/texture.png", "texture", function (err, texture) {
         *     // use texture here
         * });
         */
        load: function (url, type, callback, asset) {
            var handler = this._handlers[type];
            if (!handler) {
                var err = "No handler for asset type: " + type;
                callback(err);
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

                var handleLoad = function (err, urlObj) {
                    if (err) {
                        console.error(err);
                        if (this._requests[key]) {
                            for (var i = 0, len = this._requests[key].length; i < len; i++) {
                                this._requests[key][i](err);
                            }
                        }
                        delete this._requests[key];
                        return;
                    }

                    handler.load(urlObj, function (err, data, extra) {
                        // make sure key exists because loader
                        // might have been destroyed by now
                        if (!this._requests[key])
                            return;

                        var i, len = this._requests[key].length;

                        var resource;
                        if (! err) {
                            try {
                                resource = handler.open(urlObj.original, data, asset);
                            } catch (ex) {
                                err = ex;
                            }
                        }

                        if (!err) {
                            this._cache[key] = resource;
                            for (i = 0; i < len; i++)
                                this._requests[key][i](null, resource, extra);
                        } else {
                            console.error(err);
                            for (i = 0; i < len; i++)
                                this._requests[key][i](err);
                        }
                        delete this._requests[key];
                    }.bind(this), asset);
                }.bind(this);

                var normalizedUrl = url.split('?')[0];
                if (this._app.enableBundles && this._app.bundles.hasUrl(normalizedUrl)) {
                    if (!this._app.bundles.canLoadUrl(normalizedUrl)) {
                        handleLoad('Bundle for ' + url + ' not loaded yet');
                        return;
                    }

                    this._app.bundles.loadUrl(normalizedUrl, function (err, fileUrlFromBundle) {
                        handleLoad(err, { load: fileUrlFromBundle, original: url });
                    });
                } else {
                    handleLoad(null, { load: url, original: url });
                }

            }
        },

        /**
         * @function
         * @name pc.ResourceLoader#open
         * @description Convert raw resource data into a resource instance. e.g. take 3D model format JSON and return a pc.Model.
         * @param {String} type The type of resource.
         * @param {*} data The raw resource data.
         * @returns {*} The parsed resource data.
         */
        open: function (type, data) {
            var handler = this._handlers[type];
            if (!handler) {
                console.warn("No resource handler found for: " + type);
                return data;
            }

            return handler.open(null, data);

        },

        /**
         * @function
         * @name pc.ResourceLoader#patch
         * @description Perform any operations on a resource, that requires a dependency on its asset data
         * or any other asset data.
         * @param {pc.Asset} asset The asset to patch.
         * @param {pc.AssetRegistry} assets The asset registry.
         */
        patch: function (asset, assets) {
            var handler = this._handlers[asset.type];
            if (!handler)  {
                console.warn("No resource handler found for: " + asset.type);
                return;
            }

            if (handler.patch) {
                handler.patch(asset, assets);
            }
        },

        /**
         * @function
         * @name pc.ResourceLoader#clearCache
         * @description Remove resource from cache.
         * @param {String} url The URL of the resource.
         * @param {String} type The type of resource.
         */
        clearCache: function (url, type) {
            delete this._cache[url + type];
        },

        /**
         * @function
         * @name pc.ResourceLoader#getFromCache
         * @description Check cache for resource from a URL. If present, return the cached value.
         * @param {String} url The URL of the resource to get from the cache.
         * @param {String} type The type of the resource.
         * @returns {*} The resource loaded from the cache.
         */
        getFromCache: function (url, type) {
            if (this._cache[url + type]) {
                return this._cache[url + type];
            }
        },

        /**
         * @private
         * @function
         * @name pc.ResourceLoader#enableRetry
         * @description Enables retrying of failed requests when loading assets.
         */
        enableRetry: function () {
            for (var key in this._handlers) {
                this._handlers[key].retryRequests = true;
            }
        },

        /**
         * @private
         * @function
         * @name pc.ResourceLoader#disableRetry
         * @description Disables retrying of failed requests when loading assets.
         */
        disableRetry: function () {
            for (var key in this._handlers) {
                this._handlers[key].retryRequests = false;
            }
        },

        /**
         * @function
         * @name pc.ResourceLoader#destroy
         * @description Destroys the resource loader.
         */
        destroy: function () {
            this._handlers = {};
            this._requests = {};
            this._cache = {};
        }
    });

    return {
        ResourceLoader: ResourceLoader
    };
}());

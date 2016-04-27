pc.extend(pc, function () {
    'use strict';

    /**
    * @name pc.ResourceLoader
    * @class Load resource data, potentially from remote sources. Caches resource on load to prevent multiple requests
    * Add ResourceHandlers to handle different types of resources
    */
    var ResourceLoader = function () {
        this._handlers = {};
        this._requests = {};
        this._cache = {};
    };

    ResourceLoader.prototype = {
        /**
        * @function
        * @name pc.ResourceLoader#addHandler
        * @description Add a handler for a resource type. Handler should support: load(url, callback) and open(url, data).
        * Handlers can optionally support patch(asset, assets) to handle dependencies on other assets
        * @param {String} type The name of the type that the handler will load
        * @param {pc.ResourceHandler} handler An instance of a resource handler supporting load() and open().
        * @example
        * var loader = new ResourceLoader();
        * loader.addHandler("json", new pc.JsonHandler());
        */
        addHandler: function (type, handler) {
            this._handlers[type] = handler;
            handler._loader = this;
        },

        removeHandler: function (type) {
            delete this._handlers[type];
        },

        getHandler: function (type) {
            return this._handlers[type];
        },

        /**
        * @function
        * @name pc.ResourceLoader#load
        * @description Make a request for a resource from a remote URL. Parse the returned data using the handler for the specified type
        * When loaded and parsed use the callback to return an instance of the resource. Handles multiple requests for
        * @param {String} url The URL of the resource to load
        * @param {String} type The type of resource expected
        * @param {Function} callback The callback used when the resource is loaded or an error occurs. Passed (err, resource) where err is null if there are no errors
        * @example
        * app.loader.load("../path/to/texture.png", "texture", function (err, texture) {
        *     // use texture here
        * });
        */
        load: function(url, type, callback) {
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
                handler.load(url, function (err, data, extra) {
                    // make sure key exists because loader
                    // might have been destroyed by now
                    if (!this._requests[key])
                        return;

                    var i, len = this._requests[key].length;
                    if (!err) {
                        var resource = handler.open(url, data);
                        this._cache[key] = resource;
                        for (i = 0; i < len; i++)
                            this._requests[key][i](null, resource, extra);
                    } else {
                        for (i = 0; i < len; i++)
                            this._requests[key][i](err);
                    }
                    delete this._requests[key];
                }.bind(this));
            }
        },

        /**
        * @function
        * @name pc.ResourceLoader#open
        * @description Convert raw resource data into a resource instance. e.g. take 3D model format JSON and return a pc.Model.
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
        * @description Perform any operations on a resource, that requires a dependency on it's asset data or any other asset data
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

        clearCache: function (url, type) {
            delete this._cache[url + type];
        },

        /**
        * @function
        * @name pc.ResourceLoader#getFromCache
        * @description Check cache for resource from a URL. If present return the cached value
        */
        getFromCache: function (url, type) {
            if (this._cache[url + type]) {
                return this._cache[url + type];
            }
        },

        /**
        * @function
        * @name  pc.ResourceLoader#destroy
        * @description Destroys resource loader
        */
        destroy: function () {
            this._handlers = {};
            this._requests = {};
            this._cache = {};
        }
    };

    return {
        ResourceLoader: ResourceLoader
    };
}());

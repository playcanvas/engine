Object.assign(pc, function () {
    'use strict';

    /**
     * @constructor
     * @name pc.BundleRegistry
     * @classdesc Contains and loads bundle resource data, potentially from remote sources.
     */
    var BundleRegistry = function () {
        // contains bundles indexed by name
        this._bundles = {};
        // contains requests to load file URLs indexed by URL
        this._fileRequests = {};
        // if true then this registry has been destroyed already
        this._destroyed = false;

        // this is an event emitter
        Object.assign(this, pc.events);
    };

    Object.assign(BundleRegistry.prototype, {
        /**
         * @function
         * @name pc.BundleRegistry#add
         * @description Adds a {@link pc.Bundle} to the registry.
         * @param {pc.Bundle} bundle The bundle
         * @example
         * var bundle = new pc.Bundle(name, url, fileUrls, preload);
         * this.app.bundles.add(bundle);
         */
        add: function (bundle) {
            // If already added, ignore
            if (this._bundles[bundle.name]) return;

            this._bundles[bundle.name] = bundle;

            this._fireAddEvents(bundle);
        },

        /**
         * @function
         * @name pc.BundleRegistry#get
         * @description Gets a {@link pc.Bundle} by name.
         * @param {String} name The bundle name.
         * @returns {pc.Bundle} The bundle or null if it doesn't exist.
         * @example
         * var bundle = this.app.bundles.get(name);
         */
        get: function (name) {
            return this._bundles[bundle.name] || null;
        },

        /**
         * @function
         * @name pc.BundleRegistry#list
         * @description Lists all of the available bundles.
         * @returns {pc.Bundle[]} An array of bundles.
         * @example
         * var bundles = this.app.bundles.list();
         */
        list: function () {
            var result = [];
            for (var key in this._bundles) {
                result.push(this._bundles[key]);
            }

            return result;
        },

        /**
         * @function
         * @name pc.BundleRegistry#load
         * @description Loads a bundle by name.
         * @param {String} name The bundle name
         * @example
         * this.app.bundles.on('load:bundleName', function (bundle) {
         *   // do stuff with loaded bundle
         * });
         * this.app.bundles.load('bundleName');
         */
        load: function (name) {
            var bundle = this._bundles[name];
            if (!bundle) {
                this._fireErrorEvents('No bundle found with name: ' + name, name);
                return;
            }

            if (bundle.loaded) {
                // in cache
                this._fireLoadEvents(bundle);
            } else if (! bundle.loading) {
                // new request
                bundle.loading = true;

                var options = {
                    cache: true,
                    responseType: "blob"
                };

                pc.http.get(bundle.url, options, function (err, response) {
                    if (this._destroyed || !bundle.loading) {
                        return;
                    }

                    if (err) {
                        bundle.loading = false;

                        // if there are no more bundles than can resolve
                        // any pending file requests for this bundle, then fail
                        // those file requests
                        this._failFileRequestsIfNecessary(bundle.files, err);

                        return;
                    }

                    this._loadBundleBlob(response, function (files) {
                        if (this._destroyed || !bundle.loading) return;

                        var i, url;
                        for (i in files) {
                            url = files[i].name; // todo: change this to relative url
                            if (!bundle.files[url]) {
                                bundle.files[url] = files[i].getBlobUrl();
                            }
                        }

                        bundle.loading = false;
                        bundle.loaded = true;

                        this._fireLoadEvents(bundle);

                        // Run callbacks waiting for a file to be loaded from the bundle.
                        this._resolveFileRequestsForBundle(bundle);
                    }.bind(this));

                }.bind(this));
            }
        },

        /**
         * @function
         * @name pc.BundleRegistry#unload
         * @description Unloads a bundle by name and releases its resources.
         * @param {String} name The bundle name
         * @example
         * this.app.bundles.unload(name);
         */
        unload: function (name) {
            // todo: Add enforceFileUnload logic to only unload files if there are no more references left or if user
            // explicitly asks everything to be forcefully deleted.
            var bundle = this._bundles[name];
            if (! bundle) return;

            var files = bundle.files;
            for (var url in files) {
                var blobUrl = files[url];
                if (blobUrl) {
                    URL.revokeObjectURL(blobUrl);
                }

                files[url] = null;
            }

            bundle.loaded = false;
            bundle.loading = false;
        },

        /**
         * @function
         * @name pc.BundleRegistry#hasFile
         * @description Returns true if the specified URL exists
         * in a bundle that is either loaded or is currently being loaded.
         * @param {String} url The URL. Make sure you are using a relative URL that does not contain any query parameters.
         * @returns {Boolean} True if the specified URL exists in a bundle that is either loaded
         * or is currently being loaded, false otherwise.
         * @example
         * this.app.bundles.hasFile(asset.getFileUrl());
         */
        hasFile: function (url) {
            for (i in this._bundles) {
                var bundle = this._bundles[i];
                if (bundle.loaded || bundle.loading) {
                    if (bundle.hasFile(url)) {
                        return true;
                    }
                }
            }

            return false;
        },

        /**
         * @function
         * @name pc.BundleRegistry#loadFile
         * @description Loads the specified file URL from a bundle that is either loaded or currently being loaded.
         * @param {String} url The URL. Make sure you are using a relative URL that does not contain any query parameters.
         * @param {Function} callback The callback is called when the file has been loaded or if an error occures. The callback
         * expects the first argment to be the error message (if any) and the second argument is the file blob URL.
         * @example
         * this.app.bundles.loadFile(asset.getFileUrl(), function (err, blobUrl) {
         *     // do something with the blob URL
         * });
         */
        loadFile: function (url, callback) {
            var bundle = this._findBundleForUrl(url);
            if (! bundle) {
                callback('URL ' + url + ' not found in any bundles');
                return;
            }

            // Only load files from bundles that're explicilty requested to be loaded.
            if (bundle.loaded) {
                callback(null, bundle.files[url]);
            } else if (this._fileRequests.hasOwnProperty(url)) {
                this._fileRequests[url].push(callback);
            } else {
                this._fileRequests[url] = [callback];
            }
        },

        /**
         * @function
         * @name pc.ResourceLoader#destroy
         * @description Destroys the registry, and releases its resources.
         */
        destroy: function () {
            if (this._destroyed) return;

            this._destroyed = true;
            this.off();

            for (i in this._bundles) {
                this.unload(i);
            }


            this._bundles = {};
            this._fileRequests = {};
        },

        // Fires error events for the specified bundle name and bundle. The
        // final bundle argument is optional
        _fireErrorEvents: function (err, bundleName, bundle) {
            this.fire("error", err, bundle);
            this.fire("error:" + bundleName, err, bundle);
            if (bundle) {
                bundle.fire("error", err, bundle);
            }
        },

        // Fires load events for the specified bundle
        _fireLoadEvents: function (bundle) {
            this.fire("load", bundle);
            this.fire("load:" + bundle.name, bundle);
            bundle.fire("load", bundle);
        },

        // Fires add events for the specified bundle
        _fireAddEvents: function (bundle) {
            this.fire("add", bundle);
            this.fire("add:" + bundle.name, bundle);
        },

        // Loads the Blob of a bundle as an arraybuffer
        // and extracts it using untar. The result from untar
        // is passed to the callback
        _loadBundleBlob: function (blob, callback) {
            var fileReader = new FileReader();
            fileReader.onload = function (event) {
                var arrayBuffer = event.target.result;
                untar(arrayBuffer).then(callback);
            };
            fileReader.readAsArrayBuffer(blob);
        },

        // Calls the callbacks of pending file requests for the
        // URLs of the specified bundle.
        _resolveFileRequestsForBundle: function (bundle) {
            for (url in bundle.files) {
                if (!this._fileRequests.hasOwnProperty(url)) continue;

                var requests = this._fileRequests[url];
                for (var i = 0, len = requests.length; i < len; i++) {
                    requests[i](null, bundle.files[url]);
                }

                delete this._fileRequests[url];
            }
        },

        // This is used for files that might exist in multiple bundles.
        // If a file fails to be loaded from a bundle than this function searches
        // for another bundle that can load the file (if such a bundle is currently
        // loaded or being loaded). If such a bundle is found then nothing will happen for that URL
        // otherwise the pending request will fail for that URL.
        _failFileRequestsIfNecessary: function (urls, err) {
            for (url in urls) {
                if (!this._fileRequests.hasOwnProperty(url)) continue;

                var bundle = this._findBundleForUrl(url);
                if (bundle) continue;

                var requests = this._fileRequests(url);
                for (var i = 0, len = requests.length; i < len; i++) {
                    requests[i](err);
                }

                delete this._fileRequests[url];
            }
        },

        // Finds a bundle that is either loaded or being loaded for
        // the specified URL. Returns null if no such bundle is found.
        // The function favors already loaded bundles first.
        _findBundleForUrl: function (url) {
            var name;
            var bundle;
            var result = null;

            // search loaded bundles first
            for (name in this._bundles) {
                bundle = this._bundles[name];
                if (bundle.loaded && bundle.hasFile(url)) {
                    result = bundle;
                    break;
                }
            }

            // if found return
            if (result) return result;

            // if not found yet then search for bundles in 'loading' status
            for (name in this._bundles) {
                bundle = this._bundles[name];
                // Only load files from bundles that're explicilty requested to be loaded.
                if (bundle.loading && bundle.hasFile(url)) {
                    result = bundle;
                    break;
                }
            }

            return result;
        }
    });

    return {
        BundleRegistry: BundleRegistry
    };
}());

Object.assign(pc, function () {
    'use strict';

    /**
     * @private
     * @constructor
     * @name pc.BundleRegistry
     * @param {pc.AssetRegistry} assets The asset registry
     * @classdesc Keeps track of which assets are in bundles and loads files from bundles.
     */
    var BundleRegistry = function (assets) {
        this._assets = assets;

        // index of bundle assets
        this._bundleAssets = {};
        // index asset id to one more bundle assets
        this._assetsInBundles = {};
        // index file urls to one or more bundle assets
        this._urlsInBundles = {};
        // contains requests to load file URLs indexed by URL
        this._fileRequests = {};

        this._assets.on('add', this._onAssetAdded, this);
        this._assets.on('remove', this._onAssetRemoved, this);
    };

    Object.assign(BundleRegistry.prototype, {
        // Add asset in internal indexes
        _onAssetAdded: function (asset) {
            // if this is a bundle asset then add it and
            // index its referenced assets
            if (asset.type === 'bundle') {
                this._bundleAssets[asset.id] = asset;

                this._registerBundleEventListeners(asset.id);

                for (var i = 0, len = asset.data.assets.length; i < len; i++) {
                    this._indexAssetInBundle(asset.data.assets[i], asset);
                }
            } else {
                // if this is not a bundle then index its URLs
                if (this._assetsInBundles[asset.id]) {
                    this._indexAssetFileUrls(asset);
                }
            }
        },

        _registerBundleEventListeners: function (bundleAssetId) {
            this._assets.on('load:' + bundleAssetId, this._onBundleLoaded, this);
            this._assets.on('error:' + bundleAssetId, this._onBundleError, this);
        },

        _unregisterBundleEventListeners: function (bundleAssetId) {
            this._assets.off('load:' + bundleAssetId, this._onBundleLoaded, this);
            this._assets.off('error:' + bundleAssetId, this._onBundleError, this);
        },

        // Index the specified asset id and its file URLs so that
        // the registry knows that the asset is in that bundle
        _indexAssetInBundle: function (assetId, bundleAsset) {
            if (! this._assetsInBundles[assetId]) {
                this._assetsInBundles[assetId] = [bundleAsset];
            } else {
                var bundles = this._assetsInBundles[assetId];
                var idx = bundles.indexOf(bundleAsset);
                if (idx === -1) {
                    bundles.push(bundleAsset);
                }
            }

            var asset = this._assets.get(assetId);
            if (asset) {
                this._indexAssetFileUrls(asset);
            }
        },

        // Index the file URLs of the specified asset
        _indexAssetFileUrls: function (asset) {
            var urls = this._getAssetFileUrls(asset);
            if (! urls) return;

            for (var i = 0, len = urls.length; i < len; i++) {
                var url = urls[i];
                // Just set the URL to point to the same bundles as the asset does.
                // This is a performance/memory optimization and it assumes that
                // the URL will not exist in any other asset. If that does happen then
                // this will not work as expected if the asset is removed, as the URL will
                // be removed too.
                this._urlsInBundles[url] = this._assetsInBundles[asset.id];
            }
        },

        // Get all the possible URLs of an asset
        _getAssetFileUrls: function (asset) {
            var url = asset.getFileUrl();
            if (! url) return null;

            url = this._normalizeUrl(url);
            var urls = [url];

            // a font might have additional files
            // so add them in the list
            if (asset.type === 'font') {
                var numFiles = asset.data.info.maps.length;
                for (var i = 1; i < numFiles; i++) {
                    urls.push(url.replace('.png', i + '.png'));
                }
            }

            return urls;
        },

        // Removes query parameters from a URL
        _normalizeUrl: function (url) {
            return url && url.split('?')[0];
        },

        // Remove asset from internal indexes
        _onAssetRemoved: function (asset) {
            if (asset.type === 'bundle') {
                // remove bundle from index
                delete this._bundleAssets[asset.id];

                // remove event listeners
                this._unregisterBundleEventListeners(asset.id);

                // remove bundle from _assetsInBundles and _urlInBundles indexes
                var idx, id;
                for (id in this._assetsInBundles) {
                    var array = this._assetsInBundles[id];
                    idx = array.indexOf(asset);
                    if (idx !== -1) {
                        array.splice(idx, 1);
                        if (! array.length) {
                            delete this._assetsInBundles[id];

                            // make sure we do not leave that array in
                            // any _urlInBundles entries
                            for (var url in this._urlsInBundles) {
                                if (this._urlsInBundles[url] === array) {
                                    delete this._urlsInBundles[url];
                                }
                            }
                        }
                    }
                }

                // fail any pending requests for this bundle
                this._onBundleError('Bundle ' + asset.id + ' was removed', asset);

            } else if (this._assetsInBundles[asset.id]) {
                // remove asset from _assetInBundles
                delete this._assetsInBundles[asset.id];

                // remove asset urls from _urlsInBundles
                var urls = this._getAssetFileUrls(asset);
                for (var i = 0, len = urls.length; i < len; i++) {
                    delete this._urlsInBundles[urls[i]];
                }
            }

        },

        // If we have any pending file requests
        // that can be satisfied by the specified bundle
        // then resolve them
        _onBundleLoaded: function (bundleAsset) {
            // this can happen if the bundleAsset failed
            // to create its resource
            if (! bundleAsset.resource) {
                this._onBundleError('Bundle ' + bundleAsset.id + ' failed to load', bundleAsset);
                return;
            }

            // on next tick resolve the pending asset requests
            // don't do it on the same tick because that ties the loading
            // of the bundle to the loading of all the assets
            requestAnimationFrame(function () {
                // make sure the registry hasn't been destroyed already
                if (!this._fileRequests) {
                    return;
                }

                for (var url in this._fileRequests) {
                    var bundles = this._urlsInBundles[url];
                    if (!bundles || bundles.indexOf(bundleAsset) === -1) continue;

                    var decodedUrl = decodeURIComponent(url);
                    var err = null;
                    if (!bundleAsset.resource.hasBlobUrl(decodedUrl)) {
                        err = 'Bundle ' + bundleAsset.id + ' does not contain URL ' + url;
                    }

                    var requests = this._fileRequests[url];
                    for (var i = 0, len = requests.length; i < len; i++) {
                        if (err) {
                            requests[i](err);
                        } else {
                            requests[i](null, bundleAsset.resource.getBlobUrl(decodedUrl));
                        }
                    }

                    delete this._fileRequests[url];
                }
            }.bind(this));
        },

        // If we have outstanding file requests for any
        // of the URLs in the specified bundle then search for
        // other bundles that can satisfy these requests.
        // If we do not find any other bundles then fail
        // those pending file requests with the specified error.
        _onBundleError: function (err, bundleAsset) {
            for (var url in this._fileRequests) {
                var bundle = this._findLoadedOrLoadingBundleForUrl(url);
                if (! bundle) {
                    var requests = this._fileRequests[url];
                    for (var i = 0, len = requests.length; i < len; i++) {
                        requests[i](err);
                    }

                    delete this._fileRequests[url];

                }
            }
        },

        // Finds a bundle that contains the specified URL but
        // only returns the bundle if it's either loaded or being loaded
        _findLoadedOrLoadingBundleForUrl: function (url) {
            var bundles = this._urlsInBundles[url];
            if (! bundles) return null;

            // look for loaded bundle first...
            var len = bundles.length;
            var i;
            for (i = 0; i < len; i++) {
                // 'loaded' can be true but if there was an error
                // then 'resource' would be null
                if (bundles[i].loaded && bundles[i].resource) {
                    return bundles[i];
                }
            }

            // ...then look for loading bundles
            for (i = 0; i < len; i++) {
                if (bundles[i].loading) {
                    return bundles[i];
                }
            }

            return null;
        },

        /**
         * @private
         * @function
         * @name pc.BundleRegistry#listBundlesForAsset
         * @description Lists all of the available bundles that reference the specified asset id.
         * @param {pc.Asset} asset The asset
         * @returns {pc.Asset[]} An array of bundle assets or null if the asset is not in any bundle.
         */
        listBundlesForAsset: function (asset) {
            return this._assetsInBundles[asset.id] || null;
        },

        /**
         * @private
         * @function
         * @name pc.BundleRegistry#list
         * @description Lists all of the available bundles. This includes bundles that are not loaded.
         * @returns {pc.Asset[]} An array of bundle assets.
         */
        list: function () {
            var result = [];
            for (var id in this._bundleAssets) {
                result.push(this._bundleAssets[id]);
            }

            return result;
        },

        /**
         * @private
         * @function
         * @name pc.BundleRegistry#hasUrl
         * @description Returns true if there is a bundle that contains the specified URL
         * @param {String} url The url
         * @returns {Boolean} True or false
         */
        hasUrl: function (url) {
            return !!this._urlsInBundles[url];
        },

        /**
         * @private
         * @function
         * @name pc.BundleRegistry#canLoadUrl
         * @description Returns true if there is a bundle that contains the specified URL
         * and that bundle is either loaded or currently being loaded.
         * @param {String} url The url
         * @returns {Boolean} True or false
         */
        canLoadUrl: function (url) {
            return !!this._findLoadedOrLoadingBundleForUrl(url);
        },

        /**
         * @private
         * @function
         * @name pc.BundleRegistry#loadUrl
         * @description Loads the specified file URL from a bundle that is either loaded or currently being loaded.
         * @param {String} url The URL. Make sure you are using a relative URL that does not contain any query parameters.
         * @param {Function} callback The callback is called when the file has been loaded or if an error occures. The callback
         * expects the first argment to be the error message (if any) and the second argument is the file blob URL.
         * @example
         * var url = asset.getFileUrl().split('?')[0]; // get normalized asset URL
         * this.app.bundles.loadFile(url, function (err, blobUrl) {
         *     // do something with the blob URL
         * });
         */
        loadUrl: function (url, callback) {
            var bundle = this._findLoadedOrLoadingBundleForUrl(url);
            if (! bundle) {
                callback('URL ' + url + ' not found in any bundles');
                return;
            }

            // Only load files from bundles that're explicilty requested to be loaded.
            if (bundle.loaded) {
                var decodedUrl = decodeURIComponent(url);
                if (!bundle.resource.hasBlobUrl(decodedUrl)) {
                    callback('Bundle ' + bundle.id + ' does not contain URL ' + url);
                    return;
                }

                callback(null, bundle.resource.getBlobUrl(decodedUrl));
            } else if (this._fileRequests.hasOwnProperty(url)) {
                this._fileRequests[url].push(callback);
            } else {
                this._fileRequests[url] = [callback];
            }
        },

        /**
         * @private
         * @function
         * @name pc.ResourceLoader#destroy
         * @description Destroys the registry, and releases its resources. Does not unload bundle assets
         * as these should be unloaded by the {@link pc.AssetRegistry}.
         */
        destroy: function () {
            this._assets.off('add', this._onAssetAdded, this);
            this._assets.off('remove', this._onAssetRemoved, this);

            for (var id in this._bundleAssets) {
                this._unregisterBundleEventListeners(id);
            }

            this._assets = null;
            this._bundleAssets = null;
            this._assetsInBundles = null;
            this._urlsInBundles = null;
            this._fileRequests = null;
        }
    });

    return {
        BundleRegistry: BundleRegistry
    };
}());

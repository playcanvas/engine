Object.assign(pc, function () {
    'use strict';

    /**
     * @constructor
     * @name pc.BundleLoader
     * @classdesc Load resource data, potentially from remote sources.
     */
    var BundleLoader = function () {
        this._bundles = {};
        this._bundleRequests = {};
        this._assetRequests = {};
    };

    Object.assign(BundleLoader.prototype, {
        add: function (name, url, assetUrls) {
            // If already added, ignore
            if (this._bundles[name]) return;

            this._bundles[name] = {
                loaded: false,
                loading: false,
                url: url,
                assets: {}
            };

            for (var i in assetUrls) {
                var assetUrl = assetUrls[i];
                this._bundles[name].assets[assetUrl] = null;
            }
        },

        load: function (name, callback) {
            var bundle = this._bundles[name];
            if (!bundle) {
                return callback('No bundle found with name: ' + name);
            }

            if (bundle.loaded) {
                // in cache
                callback();
            } else if (bundle.loading) {
                // existing request
                this._bundleRequests[name].push(callback);
            } else {
                // new request
                this._bundleRequests[name] = [callback];
                bundle.loading = true;
                var options = {
                    cache: true,
                    responseType: "blob"
                };

                pc.http.get(bundle.url, options, function (err, response) {
                    if (err) {
                        for (var i in this._bundleRequests[name]) {
                            this._bundleRequests[name][i](err);
                        }
                        delete this._bundleRequests[name];
                        return;
                    }

                    // todo: change this to our own untar and don't use promises.
                    untar(response).then(function (files) {
                        var i, assetUrl;
                        for (i in files) {
                            assetUrl = files[i].name; // todo: change this to relative url
                            if (!bundle.assets[assetUrl]) {
                                bundle.assets[assetUrl] = files[i].getBlobUrl();
                            }
                        }

                        bundle.loading = false;
                        bundle.loaded = true;

                        for (i in this._bundleRequests[name]) {
                            this._bundleRequests[name][i]();
                        }

                        delete this._bundleRequests[name];

                        // Run callbacks waiting for an asset to be loaded from the bundle.
                        for (assetUrl in bundle.assets) {
                            if (this._assetRequests.hasOwnProperty(assetUrl)) {
                                for (i in this._assetRequests[assetUrl]) {
                                    this._assetRequests[assetUrl][i](null, bundle.assets[assetUrl]);
                                }

                                delete this._assetRequests[assetUrl];
                            }
                        }
                    }.bind(this));
                }.bind(this));
            }
        },

        // todo: Add enforceAssetUnload logic to only unload assets if there are no more references left or if user
        // explicitly asks everything to be forcefully deleted.
        unload: function (name) {
            if (this._bundles.hasOwnProperty(name)) {
                var assets = this._bundles[name].assets;
                for (var assetUrl in assets) {
                    URL.revokeObjectURL(assets[assetUrl]);
                    assets[assetUrl] = null;
                }

                // todo: What if bundle isn't loaded yet and still loading.
                this._bundles[name].loaded = false;
            }
        },

        hasAsset: function (url) {
            for (i in this._bundles) {
                var bundle = this._bundles[i];
                if (bundle.loaded || bundle.loading) {
                    if (bundle.assets.hasOwnProperty(url)) {
                        return true;
                    }
                }
            }

            return false;
        },

        loadAsset: function (url, cb) {
            for (i in this._bundles) {
                var bundle = this._bundles[i];
                // Only load asset from bundles that're explicilty requested to be loaded.
                if (bundle.loaded || bundle.loading) {
                    if (bundle.assets.hasOwnProperty(url)) {
                        if (bundle.loaded) {
                            cb(null, bundle.assets[url]);
                        } else if (this._assetRequests.hasOwnProperty(url)) {
                            this._assetRequests[url].push(cb);
                        } else {
                            this._assetRequests[url] = [cb];
                        }
                        return;
                    }
                }
            }

            cb('Asset not in a bundle');
        },

        /**
         * @function
         * @name pc.ResourceLoader#destroy
         * @description Destroys the bundle loader.
         */
        destroy: function () {
            for (i in this._bundles) {
                this.unload(i);
            }

            this._bundles = {};
            this._requests = {};
        }
    });

    return {
        BundleLoader: BundleLoader
    };
}());

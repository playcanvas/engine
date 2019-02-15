Object.assign(pc, function () {
    'use strict';
    /**
     * @private
     * @constructor
     * @name pc.BundleHandler
     * @param {pc.Application} app The application
     * @classdesc Loads Bundle Assets
     */
    var BundleHandler = function (app) {
        this._app = app;
        this._assets = app.assets;
        this._worker = null;

        this._preloading = false;

        app.on('preload:start', this._onPreloadStart, this);
        app.on('preload:end', this._onPreloadEnd, this);
    };

    Object.assign(BundleHandler.prototype, {
        load: function (url, callback) {
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            var self = this;

            pc.http.get(url.load, {
                responseType: pc.Http.ResponseType.ARRAY_BUFFER
            }, function (err, response) {
                if (! err) {
                    try {
                        self._untar(response, callback);
                    } catch (ex) {
                        callback("Error loading bundle resource " + url.original + ": " + ex);
                    }
                } else {
                    callback("Error loading bundle resource " + url.original + ": " + err);
                }
            });
        },

        _untar: function (response, callback) {
            var self = this;

            // Use web workers if available otherwise
            // fallback to untar'ing in the main thread.
            // Do not use workers if we are preloading
            // because it will be faster and we don't need this
            // to run asynchronously in the preload phase
            if (pc.platform.workers && !this._preloading) {
                // create web worker if necessary
                if (!self._worker) {
                    self._worker = new pc.UntarWorker(self._assets.prefix);
                }

                self._worker.untar(response, function (err, files) {
                    callback(err, files);

                    // if we have no more requests for this worker then
                    // destroy it
                    if (! self._worker.hasPendingRequests()) {
                        self._worker.destroy();
                        self._worker = null;
                    }
                });
            } else {
                var archive = new pc.Untar(response);
                var files = archive.untar(self._assets.prefix);
                callback(null, files);
            }
        },

        open: function (url, data) {
            return new pc.Bundle(data);
        },

        patch: function (asset, assets) {
        },

        _onPreloadStart: function () {
            this._preloading = true;
        },

        _onPreloadEnd: function () {
            this._preloading = false;
        }

    });

    return {
        BundleHandler: BundleHandler
    };
}());

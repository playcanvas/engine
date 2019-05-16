Object.assign(pc, function () {
    'use strict';
    /**
     * @private
     * @constructor
     * @name pc.BundleHandler
     * @param {pc.AssetRegistry} assets The asset registry
     * @classdesc Loads Bundle Assets
     */
    var BundleHandler = function (assets) {
        this._assets = assets;
        this._worker = null;
        this.retryRequests = false;
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
                responseType: pc.Http.ResponseType.ARRAY_BUFFER,
                retry: this.retryRequests
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

            // use web workers if available otherwise
            // fallback to untar'ing in the main thread
            if (pc.platform.workers) {
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
        }

    });

    return {
        BundleHandler: BundleHandler
    };
}());

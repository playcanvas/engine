import { platform } from '../core/platform.js';

import { http, Http } from '../net/http.js';

import { Bundle } from '../bundles/bundle.js';

import { Untar, UntarWorker } from './untar.js';

/**
 * @private
 * @class
 * @name BundleHandler
 * @implements {pc.ResourceHandler}
 * @param {pc.AssetRegistry} assets - The asset registry.
 * @classdesc Loads Bundle Assets.
 */
class BundleHandler {
    constructor(assets) {
        this._assets = assets;
        this._worker = null;
        this.maxRetries = 0;
    }

    load(url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        var self = this;

        http.get(url.load, {
            responseType: Http.ResponseType.ARRAY_BUFFER,
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
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
    }

    _untar(response, callback) {
        var self = this;

        // use web workers if available otherwise
        // fallback to untar'ing in the main thread
        if (platform.workers) {
            // create web worker if necessary
            if (!self._worker) {
                self._worker = new UntarWorker(self._assets.prefix);
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
            var archive = new Untar(response);
            var files = archive.untar(self._assets.prefix);
            callback(null, files);
        }
    }

    open(url, data) {
        return new Bundle(data);
    }

    patch(asset, assets) {
    }
}

export { BundleHandler };

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
    };

    Object.assign(BundleHandler.prototype, {
        load: function (url, callback) {
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            var prefix = this._assets.prefix;

            pc.http.get(url.load, {
                responseType: pc.Http.ResponseType.ARRAY_BUFFER
            }, function (err, response) {
                if (! err) {
                    try {
                        var untar = new pc.Untar(response);
                        var files = [];
                        while (untar.hasNext()) {
                            var file = untar.readNextFile();
                            if (prefix && file.name) {
                                file.name = prefix + file.name;
                            }
                            files.push(file);
                        }

                        callback(null, files);
                    } catch (ex) {
                        callback("Error loading bundle resource " + url.original + ": " + ex);
                    }
                } else {
                    callback("Error loading bundle resource " + url.original + ": " + err);
                }
            });
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

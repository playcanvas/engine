Object.assign(pc, function () {
    'use strict';

    var BundleHandler = function () {};

    var HTTP_OPTIONS = {
        responseType: pc.Http.ResponseType.ARRAY_BUFFER
    };

    Object.assign(BundleHandler.prototype, {
        load: function (url, callback) {
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            pc.http.get('lol', HTTP_OPTIONS, function (err, response) {
                if (! err) {
                    // TODO: more error handling for FileReader and untar
                    untar(response).then(function (files) {
                        callback(null, files);
                    }).catch(function (err) {
                        callback("Error loading bundle resource " + url.original + ": " + err);
                    });
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
